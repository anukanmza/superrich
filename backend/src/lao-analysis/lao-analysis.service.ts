import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type PredType = 'd4' | 'top3' | 'tod3' | 'top2' | 'bot2';
type PredItem = { num: string; strategy: string; reason?: string };

const TYPE_LABEL: Record<PredType, string> = {
  d4: '4 ตัวตรง',
  top3: '3 ตัวตรง',
  tod3: '3 ตัวโต๊ด',
  top2: '2 ตัวบน',
  bot2: '2 ตัวล่าง',
};
const TYPE_LEN: Record<PredType, number> = { d4: 4, top3: 3, tod3: 3, top2: 2, bot2: 2 };
const PRED_TYPES: PredType[] = ['d4', 'top3', 'tod3', 'top2', 'bot2'];

export const STRATEGIES: Record<string, string> = {
  HOT: 'เลขร้อน (ออกบ่อยช่วงหลัง)',
  COLD_GAP: 'เลขค้างนาน (ไม่ออกมานาน)',
  PAIR_FOLLOW: 'เลขที่มักออกตามงวดก่อน',
  DIGIT_POS: 'หลักเด่นแต่ละตำแหน่ง',
  MIRROR: 'เลขกลับ / เลขพี่น้อง (+1/-1) / เลขกลับด้าน',
  SUM: 'ผลรวมหลักเด่น',
  PREV_DERIVE: 'สูตรคำนวณจากงวดก่อน',
  OTHER: 'อื่นๆ',
};

const PREDICTIONS_PER_TYPE = 8;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash'];

@Injectable()
export class LaoAnalysisService {
  constructor(private prisma: PrismaService) {}

  // ---------- helpers ----------
  private splitResult(result4: string) {
    return { top3: result4.slice(1), top2: result4.slice(2), bot2: result4.slice(0, 2) };
  }

  /** Parse "dd/mm/yyyy" (พ.ศ. or ค.ศ.) -> Date, else null */
  private parseDrawDate(period: string): Date | null {
    const m = period.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return null;
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += y > 50 ? 2500 : 2000; // 2-digit year guess (69 -> 2569)
    if (y > 2400) y -= 543;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, mo - 1, d));
    return isNaN(date.getTime()) ? null : date;
  }

  private sortedDigits(s: string) {
    return s.split('').sort().join('');
  }

  private permCount(s: string) {
    const uniq = new Set(s.split('')).size;
    if (s.length !== 3) return 1;
    return uniq === 3 ? 6 : uniq === 2 ? 3 : 1;
  }

  private isHit(type: PredType, num: string, r: { result4: string; top3: string; top2: string; bot2: string }) {
    switch (type) {
      case 'd4': return num === r.result4;
      case 'top3': return num === r.top3;
      case 'tod3': return this.sortedDigits(num) === this.sortedDigits(r.top3);
      case 'top2': return num === r.top2;
      case 'bot2': return num === r.bot2;
    }
  }

  /** Probability that a single predicted item hits by pure chance */
  private itemChance(type: PredType, num: string) {
    switch (type) {
      case 'd4': return 1 / 10000;
      case 'top3': return 1 / 1000;
      case 'tod3': return this.permCount(num) / 1000;
      default: return 1 / 100;
    }
  }

  /** Probability that a whole prediction list (one type) hits by pure chance */
  private listChance(type: PredType, items: PredItem[]) {
    if (type === 'tod3') {
      const groups = new Set(items.map(i => this.sortedDigits(i.num)));
      let sum = 0;
      groups.forEach(g => (sum += this.permCount(g)));
      return Math.min(1, sum / 1000);
    }
    const uniq = new Set(items.map(i => i.num)).size;
    const space = type === 'd4' ? 10000 : type === 'top3' ? 1000 : 100;
    return Math.min(1, uniq / space);
  }

  private parseItems(json: string | null | undefined): PredItem[] {
    if (!json) return [];
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  /** Normalise AI output: digits only, correct length, dedupe, known strategy, max 8 */
  private normalizeItems(raw: any, type: PredType): PredItem[] {
    const len = TYPE_LEN[type];
    const out: PredItem[] = [];
    const seen = new Set<string>();
    if (!Array.isArray(raw)) return out;
    for (const it of raw) {
      const numRaw = typeof it === 'object' && it !== null ? it.num : it;
      let num = String(numRaw ?? '').replace(/\D/g, '');
      if (!num) continue;
      if (num.length < len) num = num.padStart(len, '0');
      if (num.length !== len) continue;
      const key = type === 'tod3' ? this.sortedDigits(num) : num;
      if (seen.has(key)) continue;
      seen.add(key);
      let strategy = String((it && it.strategy) || 'OTHER').toUpperCase().trim();
      if (!STRATEGIES[strategy]) strategy = 'OTHER';
      const reason = it && it.reason ? String(it.reason).slice(0, 200) : undefined;
      out.push({ num, strategy, reason });
      if (out.length >= PREDICTIONS_PER_TYPE) break;
    }
    return out;
  }

  private async getHistoryAsc() {
    const rows = await this.prisma.laoHistoricalData.findMany();
    return rows.sort((a, b) => {
      const ta = a.drawDate ? a.drawDate.getTime() : a.createdAt.getTime();
      const tb = b.drawDate ? b.drawDate.getTime() : b.createdAt.getTime();
      return ta - tb || a.id - b.id;
    });
  }

  // ---------- statistics computed in code (fed to the prompt) ----------
  private computeStats(rows: { period: string; result4: string; top3: string; top2: string; bot2: string }[]) {
    const N = rows.length;
    if (N === 0) return null;

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const freq = (arr: string[]) => {
      const m: Record<string, number> = {};
      arr.forEach(x => (m[x] = (m[x] || 0) + 1));
      return m;
    };
    const topN = (m: Record<string, number>, n: number) =>
      Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}(${v})`);

    const lastK = (k: number) => rows.slice(Math.max(0, N - k));

    // Hot numbers
    const hot = (key: 'top2' | 'bot2', k: number) => topN(freq(lastK(k).map(r => r[key])), 10);

    // Gaps: how many draws since each 2-digit number last appeared
    const gaps = (key: 'top2' | 'bot2') => {
      const last: Record<string, number> = {};
      rows.forEach((r, i) => (last[r[key]] = i));
      const list: { num: string; gap: number }[] = [];
      for (let i = 0; i < 100; i++) {
        const num = pad2(i);
        list.push({ num, gap: last[num] === undefined ? N : N - 1 - last[num] });
      }
      return list.sort((a, b) => b.gap - a.gap).slice(0, 15).map(x => `${x.num}(${x.gap === N ? 'ไม่เคยออก' : x.gap + ' งวด'})`);
    };

    // Digit frequency per position (last 30)
    const posNames = ['หลักพัน', 'หลักร้อย', 'หลักสิบ', 'หลักหน่วย'];
    const digitPos = posNames.map((name, p) => {
      const m = freq(lastK(30).map(r => r.result4[p]));
      return `${name}: ${topN(m, 5).join(', ')}`;
    });

    // Running digits (any position, last 10 / 30)
    const running = (k: number) => {
      const m: Record<string, number> = {};
      lastK(k).forEach(r => new Set(r.result4.split('')).forEach(d => (m[d] = (m[d] || 0) + 1)));
      return topN(m, 6);
    };

    // Patterns
    const isDouble = (s: string) => s[0] === s[1];
    const doubleTop2 = rows.filter(r => isDouble(r.top2)).length;
    const doubleBot2 = rows.filter(r => isDouble(r.bot2)).length;
    const tripleLike = rows.filter(r => new Set(r.top3.split('')).size < 3).length;
    const oddEven = lastK(20).map(r => (parseInt(r.top2[1], 10) % 2 ? 'คี่' : 'คู่')).join(' ');
    const highLow = lastK(20).map(r => (parseInt(r.top2, 10) >= 50 ? 'สูง' : 'ต่ำ')).join(' ');
    const digitSum = (s: string) => s.split('').reduce((a, d) => a + parseInt(d, 10), 0) % 10;
    const sumFreq = topN(freq(lastK(30).map(r => String(digitSum(r.top3)))), 5);

    // Follow pattern: after a draw whose last digit is X, which digits appear next
    const latest = rows[N - 1];
    const lastUnit = latest.result4[3];
    const followCount: Record<string, number> = {};
    let followSamples = 0;
    for (let i = 0; i < N - 1; i++) {
      if (rows[i].result4[3] === lastUnit) {
        followSamples++;
        new Set(rows[i + 1].result4.split('')).forEach(d => (followCount[d] = (followCount[d] || 0) + 1));
      }
    }

    // Derived candidates from the latest draw (computed, not guessed)
    const mirrorMap: Record<string, string> = { '0': '5', '1': '6', '2': '7', '3': '8', '4': '9', '5': '0', '6': '1', '7': '2', '8': '3', '9': '4' };
    const mirror = (s: string) => s.split('').map(d => mirrorMap[d]).join('');
    const shift = (s: string, n: number) => s.split('').map(d => String((parseInt(d, 10) + n + 10) % 10)).join('');
    const reverse = (s: string) => s.split('').reverse().join('');
    const sum4 = latest.result4.split('').reduce((a, d) => a + parseInt(d, 10), 0);

    return {
      totalDraws: N,
      recent: lastK(20).map(r => `${r.period}=${r.result4}`).join(' | '),
      hotTop2_10: hot('top2', 10), hotTop2_30: hot('top2', 30), hotTop2_all: hot('top2', N),
      hotBot2_10: hot('bot2', 10), hotBot2_30: hot('bot2', 30), hotBot2_all: hot('bot2', N),
      gapTop2: gaps('top2'), gapBot2: gaps('bot2'),
      digitPos,
      running10: running(10), running30: running(30),
      doubleTop2Pct: Math.round((doubleTop2 / N) * 100),
      doubleBot2Pct: Math.round((doubleBot2 / N) * 100),
      top3RepeatDigitPct: Math.round((tripleLike / N) * 100),
      oddEven, highLow, sumFreq,
      follow: { lastUnit, samples: followSamples, digits: topN(followCount, 5) },
      derived: {
        latest: latest.result4,
        reverse: reverse(latest.result4),
        mirror: mirror(latest.result4),
        plus1: shift(latest.result4, 1),
        minus1: shift(latest.result4, -1),
        sumDigits: sum4,
        sumMod10: sum4 % 10,
      },
    };
  }

  // ---------- strategy scoreboard (skill memory) ----------
  private computeScoreboard(evaluated: any[]) {
    const board: Record<string, { uses: number; hits: number; expected: number }> = {};
    for (const r of evaluated) {
      const lists: Record<PredType, PredItem[]> = {
        d4: this.parseItems(r.aiPredicted4),
        top3: this.parseItems(r.aiPredictedTop3),
        tod3: this.parseItems(r.aiPredictedTod3),
        top2: this.parseItems(r.aiPredictedTop2),
        bot2: this.parseItems(r.aiPredictedBot2),
      };
      for (const t of PRED_TYPES) {
        for (const it of lists[t]) {
          const s = STRATEGIES[it.strategy] ? it.strategy : 'OTHER';
          board[s] = board[s] || { uses: 0, hits: 0, expected: 0 };
          board[s].uses++;
          board[s].expected += this.itemChance(t, it.num);
          if (this.isHit(t, it.num, r)) board[s].hits++;
        }
      }
    }
    return Object.entries(board)
      .map(([strategy, v]) => ({
        strategy,
        label: STRATEGIES[strategy],
        uses: v.uses,
        hits: v.hits,
        expectedHits: Math.round(v.expected * 100) / 100,
        ratio: v.expected > 0 ? Math.round((v.hits / v.expected) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.ratio - a.ratio || b.hits - a.hits);
  }

  // ---------- main analysis ----------
  async analyze(apiKeyOverride?: string, modelOverride?: string) {
    const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpException('ไม่พบ API Key กรุณาตั้งค่า API Key ก่อน', HttpStatus.BAD_REQUEST);
    }

    try {
      const rows = await this.getHistoryAsc();
      if (rows.length < 5) {
        throw new HttpException(`ข้อมูลผลรางวัลย้อนหลังยังน้อยเกินไป (มี ${rows.length} งวด) กรุณาเพิ่มอย่างน้อย 5 งวดก่อนวิเคราะห์`, HttpStatus.BAD_REQUEST);
      }
      const stats = this.computeStats(rows)!;
      const evaluated = rows.filter(r => r.predictionId !== null);
      const scoreboard = this.computeScoreboard(evaluated);

      // Hit examples (most recent first, max 6)
      const hitExamples: string[] = [];
      for (const r of [...evaluated].reverse()) {
        const details = this.parseItems(r.hitDetails) as any[];
        for (const h of details) {
          hitExamples.push(`งวด ${r.period} (ผล ${r.result4}): ${TYPE_LABEL[h.type as PredType] || h.type} เลข ${h.num} สูตร ${h.strategy}${h.reason ? ` เหตุผล: ${h.reason}` : ''}`);
          if (hitExamples.length >= 6) break;
        }
        if (hitExamples.length >= 6) break;
      }

      const scoreboardText = scoreboard.length
        ? scoreboard.map(s => `- ${s.strategy}: ใช้ ${s.uses} ครั้ง, ถูก ${s.hits} ครั้ง, ถ้าสุ่มคาดว่าถูก ${s.expectedHits} ครั้ง (อัตราส่วน ${s.ratio}x)`).join('\n')
        : '- ยังไม่มีข้อมูล (ยังไม่เคยตรวจผล)';

      const prompt = `
คุณคือนักวิเคราะห์สถิติหวยลาว (ผลรางวัลเลข 4 ตัว)
นิยามรางวัล: ถ้าผลคือ ABCD
- 4 ตัวตรง = ABCD
- 3 ตัวตรง = BCD (3 ตัวท้าย)
- 3 ตัวโต๊ด = BCD สลับตำแหน่งได้
- 2 ตัวบน = CD (2 ตัวท้าย)
- 2 ตัวล่าง = AB (2 ตัวหน้า)

ข้อเท็จจริงที่ต้องยอมรับ: ผลรางวัลมาจากการสุ่ม ไม่มีสูตรใดรับประกันผล ให้ใช้สถิติด้านล่างเพื่อเลือกเลขอย่างเป็นระบบ และห้ามอ้างความมั่นใจเป็นเปอร์เซ็นต์

=== สถิติที่ระบบคำนวณแล้ว (เชื่อถือตัวเลขนี้ ห้ามนับใหม่เอง) ===
จำนวนงวดในฐานข้อมูล: ${stats.totalDraws}
ผล 20 งวดล่าสุด (เก่า→ใหม่): ${stats.recent}

2 ตัวบน เลขร้อน 10 งวด: ${stats.hotTop2_10.join(', ')}
2 ตัวบน เลขร้อน 30 งวด: ${stats.hotTop2_30.join(', ')}
2 ตัวบน เลขร้อนทั้งหมด: ${stats.hotTop2_all.join(', ')}
2 ตัวบน เลขค้างนานสุด: ${stats.gapTop2.join(', ')}

2 ตัวล่าง เลขร้อน 10 งวด: ${stats.hotBot2_10.join(', ')}
2 ตัวล่าง เลขร้อน 30 งวด: ${stats.hotBot2_30.join(', ')}
2 ตัวล่าง เลขร้อนทั้งหมด: ${stats.hotBot2_all.join(', ')}
2 ตัวล่าง เลขค้างนานสุด: ${stats.gapBot2.join(', ')}

หลักเด่นแต่ละตำแหน่ง (30 งวด, ตัวเลข(จำนวนครั้ง)):
${stats.digitPos.join('\n')}
เลขวิ่ง 10 งวด: ${stats.running10.join(', ')}
เลขวิ่ง 30 งวด: ${stats.running30.join(', ')}

สัดส่วนเลขเบิ้ล 2 ตัวบน: ${stats.doubleTop2Pct}% | 2 ตัวล่าง: ${stats.doubleBot2Pct}% | 3 ตัวท้ายมีเลขซ้ำ: ${stats.top3RepeatDigitPct}%
คู่/คี่ หลักหน่วย 20 งวด: ${stats.oddEven}
สูง/ต่ำ 2 ตัวบน 20 งวด: ${stats.highLow}
ผลรวม 3 ตัวท้าย (mod 10) ที่ออกบ่อย 30 งวด: ${stats.sumFreq.join(', ')}

เลขตาม: งวดล่าสุดลงท้ายด้วย ${stats.follow.lastUnit} ในอดีต (${stats.follow.samples} ครั้ง) งวดถัดไปมักมีเลข: ${stats.follow.digits.join(', ') || 'ข้อมูลไม่พอ'}

ค่าที่คำนวณจากงวดล่าสุด (${stats.derived.latest}):
กลับด้าน=${stats.derived.reverse}, เลขกลับ(1↔6,2↔7,3↔8,4↔9,5↔0)=${stats.derived.mirror}, +1=${stats.derived.plus1}, -1=${stats.derived.minus1}, ผลรวมหลัก=${stats.derived.sumDigits} (หลักหน่วย ${stats.derived.sumMod10})

=== สมุดบันทึกสูตร (ผลงานจริงของแต่ละสูตรในอดีต) ===
${scoreboardText}

ตัวอย่างงวดที่เคยทายถูก:
${hitExamples.length ? hitExamples.join('\n') : '- ยังไม่มี'}

=== กติกาการเลือกเลข ===
1. สูตรที่ใช้ได้ (ใส่รหัสใน strategy): ${Object.entries(STRATEGIES).filter(([k]) => k !== 'OTHER').map(([k, v]) => `${k}=${v}`).join(', ')}
2. ให้น้ำหนักสูตรที่อัตราส่วนมากกว่า 1x มากขึ้น แต่ข้อมูลยังน้อย จึงต้องกระจายใช้อย่างน้อย 3 สูตรในแต่ละประเภท ห้ามทุ่มสูตรเดียว
3. แต่ละประเภทให้ ${PREDICTIONS_PER_TYPE} ชุด ห้ามซ้ำ (3 ตัวโต๊ดห้ามเป็นชุดตัวเลขเดียวกันที่สลับตำแหน่ง)
4. เลขต้องสอดคล้องกัน เช่น 2 ตัวบนควรสัมพันธ์กับ 3 ตัวตรงและ 4 ตัวตรงบางชุด
5. reason ให้สั้น อ้างอิงตัวเลขสถิติข้างบน

ตอบเป็น JSON เท่านั้น ตามโครงสร้างนี้:
{
  "analysisText": "บทวิเคราะห์ภาษาไทย อธิบายภาพรวมสถิติ สูตรที่เลือกใช้และเหตุผล และคำเตือนความเสี่ยง",
  "predicted4":    [{"num":"1234","strategy":"HOT","reason":"..."}],
  "predictedTop3": [{"num":"234","strategy":"DIGIT_POS","reason":"..."}],
  "predictedTod3": [{"num":"234","strategy":"MIRROR","reason":"..."}],
  "predictedTop2": [{"num":"34","strategy":"COLD_GAP","reason":"..."}],
  "predictedBot2": [{"num":"12","strategy":"PAIR_FOLLOW","reason":"..."}]
}
`;

      const { rawText, modelUsed } = await this.callGemini(apiKey, prompt, modelOverride);

      let resultObj: any;
      try {
        let clean = rawText.trim();
        if (clean.startsWith('```json')) clean = clean.substring(7);
        if (clean.startsWith('```')) clean = clean.substring(3);
        if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
        resultObj = JSON.parse(clean.trim());
      } catch {
        console.error('Lao: invalid JSON from Gemini:', rawText);
        throw new HttpException('AI ตอบกลับมาในรูปแบบที่ไม่ถูกต้อง กรุณากดวิเคราะห์ใหม่อีกครั้ง หรือลองเปลี่ยนโมเดล', HttpStatus.BAD_GATEWAY);
      }

      const preds = {
        d4: this.normalizeItems(resultObj.predicted4, 'd4'),
        top3: this.normalizeItems(resultObj.predictedTop3, 'top3'),
        tod3: this.normalizeItems(resultObj.predictedTod3, 'tod3'),
        top2: this.normalizeItems(resultObj.predictedTop2, 'top2'),
        bot2: this.normalizeItems(resultObj.predictedBot2, 'bot2'),
      };
      if (PRED_TYPES.every(t => preds[t].length === 0)) {
        throw new HttpException('AI ไม่ได้ส่งเลขทายกลับมา กรุณาลองใหม่อีกครั้ง', HttpStatus.BAD_GATEWAY);
      }

      const now = new Date();
      const saved = await this.prisma.laoPrediction.create({
        data: {
          targetPeriod: `งวดถัดไป (วิเคราะห์ ${now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })})`,
          predicted4: JSON.stringify(preds.d4),
          predictedTop3: JSON.stringify(preds.top3),
          predictedTod3: JSON.stringify(preds.tod3),
          predictedTop2: JSON.stringify(preds.top2),
          predictedBot2: JSON.stringify(preds.bot2),
          analysisText: String(resultObj.analysisText || ''),
          model: modelUsed,
        },
      });

      return this.formatPrediction(saved);
    } catch (err: any) {
      console.error('Lao analysis error:', err.message);
      if (err instanceof HttpException) throw err;
      throw new HttpException('เกิดข้อผิดพลาดระหว่างการวิเคราะห์ด้วย AI กรุณาลองใหม่อีกครั้ง', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async callGemini(apiKey: string, prompt: string, modelOverride?: string) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = modelOverride ? [modelOverride] : DEFAULT_MODELS;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const allErrors: string[] = [];
    let lastErrorMessage = '';

    for (const modelName of modelsToTry) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.6, responseMimeType: 'application/json' } as any,
      });
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          if (text) return { rawText: text, modelUsed: modelName };
          break;
        } catch (e: any) {
          const msg = e?.message || String(e);
          lastErrorMessage = msg;
          allErrors.push(`${modelName} (attempt ${attempt + 1}): ${msg}`);
          console.log(`Lao: model ${modelName} attempt ${attempt + 1} failed:`, msg);
          if (attempt < RETRY_DELAYS_MS.length && this.isTransientError(msg)) {
            await sleep(RETRY_DELAYS_MS[attempt]);
            continue;
          }
          break;
        }
      }
    }
    console.error('Lao: Gemini failed. Details:', allErrors.join(' | '));
    throw new HttpException(this.toFriendlyErrorMessage(lastErrorMessage), HttpStatus.SERVICE_UNAVAILABLE);
  }

  private isTransientError(msg: string): boolean {
    return /\b(503|429|500)\b|Service Unavailable|high demand|overloaded|Too Many Requests|RESOURCE_EXHAUSTED|Internal Server Error|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);
  }

  private toFriendlyErrorMessage(msg: string): string {
    if (/API_KEY_INVALID|API key not valid|\b401\b|\b403\b|PERMISSION_DENIED/i.test(msg)) return 'API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบ API Key';
    if (/\b404\b|not found|is not supported/i.test(msg)) return 'ไม่พบโมเดล AI ที่เลือก หรือ API Key นี้ไม่รองรับโมเดลนี้ กรุณาเลือกโมเดลอื่น';
    if (/\b429\b|Too Many Requests|RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'ใช้งาน AI เกินโควต้าชั่วคราว กรุณารอสักครู่แล้วลองใหม่ หรือเปลี่ยนโมเดล';
    if (/\b503\b|Service Unavailable|high demand|overloaded/i.test(msg)) return 'เซิร์ฟเวอร์ AI ไม่ว่างชั่วคราว (ระบบลองซ้ำให้แล้ว 3 ครั้ง) กรุณาลองใหม่อีกครั้งในอีกสักครู่ หรือเปลี่ยนโมเดล';
    if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(msg)) return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ AI ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    return 'ไม่สามารถวิเคราะห์ด้วย AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง หรือเปลี่ยนโมเดล';
  }

  private formatPrediction(p: any) {
    return {
      id: p.id,
      targetPeriod: p.targetPeriod,
      analysis: p.analysisText || '',
      model: p.model,
      predicted4: this.parseItems(p.predicted4),
      predictedTop3: this.parseItems(p.predictedTop3),
      predictedTod3: this.parseItems(p.predictedTod3),
      predictedTop2: this.parseItems(p.predictedTop2),
      predictedBot2: this.parseItems(p.predictedBot2),
      createdAt: p.createdAt,
    };
  }

  // ---------- endpoints ----------
  async getLatestPrediction() {
    const latest = await this.prisma.laoPrediction.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!latest) return null;
    const checked = await this.prisma.laoHistoricalData.findFirst({ where: { predictionId: latest.id } });
    return { ...this.formatPrediction(latest), checkedPeriod: checked ? checked.period : null };
  }

  async getHistory() {
    const rows = await this.getHistoryAsc();
    return rows.reverse();
  }

  private validateResult(period: string, result4: string) {
    const p = (period || '').trim();
    const r = (result4 || '').replace(/\s/g, '');
    if (!p) throw new HttpException('กรุณากรอกชื่องวด', HttpStatus.BAD_REQUEST);
    if (!/^\d{4}$/.test(r)) throw new HttpException('ผลรางวัลต้องเป็นตัวเลข 4 หลัก เช่น 1234', HttpStatus.BAD_REQUEST);
    return { period: p, result4: r };
  }

  async addHistory(body: { period: string; result4: string; checkLatest?: boolean }) {
    const { period, result4 } = this.validateResult(body.period, body.result4);
    const existing = await this.prisma.laoHistoricalData.findUnique({ where: { period } });
    if (existing) throw new HttpException(`งวด "${period}" มีอยู่ในระบบแล้ว`, HttpStatus.CONFLICT);

    const split = this.splitResult(result4);
    const data: any = { period, drawDate: this.parseDrawDate(period), result4, ...split };

    if (body.checkLatest) {
      const latest = await this.prisma.laoPrediction.findFirst({ orderBy: { createdAt: 'desc' } });
      if (latest) {
        const alreadyChecked = await this.prisma.laoHistoricalData.findFirst({ where: { predictionId: latest.id } });
        if (alreadyChecked) {
          throw new HttpException(`ผลทายล่าสุดถูกตรวจกับงวด "${alreadyChecked.period}" ไปแล้ว กรุณากดวิเคราะห์ใหม่ก่อน หรือเอาเครื่องหมายตรวจผลออก`, HttpStatus.CONFLICT);
        }
        const r = { result4, ...split };
        const lists: Record<PredType, PredItem[]> = {
          d4: this.parseItems(latest.predicted4),
          top3: this.parseItems(latest.predictedTop3),
          tod3: this.parseItems(latest.predictedTod3),
          top2: this.parseItems(latest.predictedTop2),
          bot2: this.parseItems(latest.predictedBot2),
        };
        const hitDetails: any[] = [];
        const hitFlag: Record<PredType, boolean> = { d4: false, top3: false, tod3: false, top2: false, bot2: false };
        for (const t of PRED_TYPES) {
          for (const it of lists[t]) {
            if (this.isHit(t, it.num, r)) {
              hitFlag[t] = true;
              hitDetails.push({ type: t, num: it.num, strategy: it.strategy, reason: it.reason });
            }
          }
        }
        Object.assign(data, {
          predictionId: latest.id,
          aiPredicted4: latest.predicted4,
          aiPredictedTop3: latest.predictedTop3,
          aiPredictedTod3: latest.predictedTod3,
          aiPredictedTop2: latest.predictedTop2,
          aiPredictedBot2: latest.predictedBot2,
          isHit4: hitFlag.d4,
          isHitTop3: hitFlag.top3,
          isHitTod3: hitFlag.tod3,
          isHitTop2: hitFlag.top2,
          isHitBot2: hitFlag.bot2,
          hitDetails: JSON.stringify(hitDetails),
        });
      }
    }

    return this.prisma.laoHistoricalData.create({ data });
  }

  async importHistory(text: string) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) throw new HttpException('ไม่พบข้อมูลที่จะนำเข้า', HttpStatus.BAD_REQUEST);
    if (lines.length > 1000) throw new HttpException('นำเข้าได้สูงสุดครั้งละ 1000 งวด', HttpStatus.BAD_REQUEST);

    const existing = new Set((await this.prisma.laoHistoricalData.findMany({ select: { period: true } })).map(r => r.period));
    const toCreate: any[] = [];
    const skipped: { line: string; reason: string }[] = [];

    for (const line of lines) {
      const m = line.match(/^(.+?)[\s,;\t]+(\d{4})$/);
      if (!m) { skipped.push({ line, reason: 'รูปแบบไม่ถูกต้อง (ต้องเป็น "งวด เลข4ตัว")' }); continue; }
      const period = m[1].replace(/[,;]+$/, '').trim();
      const result4 = m[2];
      if (existing.has(period)) { skipped.push({ line, reason: 'งวดนี้มีอยู่แล้ว' }); continue; }
      existing.add(period);
      toCreate.push({ period, drawDate: this.parseDrawDate(period), result4, ...this.splitResult(result4) });
    }

    if (toCreate.length) await this.prisma.laoHistoricalData.createMany({ data: toCreate, skipDuplicates: true });
    return { added: toCreate.length, skipped };
  }

  async deleteHistory(id: number) {
    const row = await this.prisma.laoHistoricalData.findUnique({ where: { id } });
    if (!row) throw new HttpException('ไม่พบข้อมูลงวดนี้', HttpStatus.NOT_FOUND);
    await this.prisma.laoHistoricalData.delete({ where: { id } });
    return { ok: true };
  }

  async getStats() {
    const [totalPredictions, rows] = await Promise.all([this.prisma.laoPrediction.count(), this.getHistoryAsc()]);
    const evaluated = rows.filter(r => r.predictionId !== null);

    const perType = PRED_TYPES.map(t => {
      const field = { d4: 'aiPredicted4', top3: 'aiPredictedTop3', tod3: 'aiPredictedTod3', top2: 'aiPredictedTop2', bot2: 'aiPredictedBot2' }[t];
      const hitField = { d4: 'isHit4', top3: 'isHitTop3', tod3: 'isHitTod3', top2: 'isHitTop2', bot2: 'isHitBot2' }[t];
      let hits = 0;
      let expected = 0;
      evaluated.forEach((r: any) => {
        if (r[hitField]) hits++;
        expected += this.listChance(t, this.parseItems(r[field]));
      });
      const n = evaluated.length;
      return {
        type: t,
        label: TYPE_LABEL[t],
        hits,
        evaluated: n,
        accuracyPct: n ? Math.round((hits / n) * 1000) / 10 : 0,
        randomPct: n ? Math.round((expected / n) * 10000) / 100 : 0,
      };
    });

    return {
      totalPredictions,
      totalHistorical: rows.length,
      evaluatedCount: evaluated.length,
      perType,
      scoreboard: this.computeScoreboard(evaluated),
      strategies: STRATEGIES,
    };
  }
}
