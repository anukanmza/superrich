'use client';

import React, { useEffect, useState } from 'react';
import {
  runLaoAnalysis,
  getLaoLatestPrediction,
  getLaoHistory,
  getLaoStats,
  addLaoHistory,
  importLaoHistory,
  deleteLaoHistory,
} from '../../lib/api';

type PredItem = { num: string; strategy: string; reason?: string };
type Prediction = {
  id: number;
  targetPeriod: string;
  analysis: string;
  model?: string | null;
  predicted4: PredItem[];
  predictedTop3: PredItem[];
  predictedTod3: PredItem[];
  predictedTop2: PredItem[];
  predictedBot2: PredItem[];
  createdAt: string;
  checkedPeriod?: string | null;
};

// Shared with the Thai AI tab so the user only sets the key/model once
const LS_KEY = 'lotto_ai_apikey';
const LS_MODEL = 'lotto_ai_model';

const MODEL_OPTIONS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];

const TYPE_CARDS: { key: keyof Prediction; label: string; color: string }[] = [
  { key: 'predicted4', label: '4 ตัวตรง', color: '#cba6f7' },
  { key: 'predictedTop3', label: '3 ตัวตรง', color: '#f9e2af' },
  { key: 'predictedTod3', label: '3 ตัวโต๊ด', color: '#fab387' },
  { key: 'predictedTop2', label: '2 ตัวบน', color: '#89dceb' },
  { key: 'predictedBot2', label: '2 ตัวล่าง', color: '#f38ba8' },
];

const STRATEGY_COLORS: Record<string, string> = {
  HOT: '#f38ba8',
  COLD_GAP: '#89b4fa',
  PAIR_FOLLOW: '#a6e3a1',
  DIGIT_POS: '#f9e2af',
  MIRROR: '#cba6f7',
  SUM: '#94e2d5',
  PREV_DERIVE: '#fab387',
  OTHER: '#6c7086',
};

const maskKey = (k: string) => {
  if (!k) return '';
  if (k.length <= 10) return k.slice(0, 2) + '••••';
  return `${k.slice(0, 6)}••••••${k.slice(-4)}`;
};

export default function LaoAnalysisPage() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // settings
  const [savedKey, setSavedKey] = useState('');
  const [savedModel, setSavedModel] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);

  // forms
  const [panel, setPanel] = useState<'none' | 'single' | 'bulk'>('none');
  const [period, setPeriod] = useState('');
  const [result4, setResult4] = useState('');
  const [checkLatest, setCheckLatest] = useState(true);
  const [bulkText, setBulkText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [importReport, setImportReport] = useState<{ added: number; skipped: { line: string; reason: string }[] } | null>(null);

  const readSaved = () => {
    try {
      const k = (localStorage.getItem(LS_KEY) || '').trim();
      const m = localStorage.getItem(LS_MODEL) || '';
      setSavedKey(k);
      setSavedModel(m);
      return { k, m };
    } catch {
      return { k: '', m: '' };
    }
  };

  const loadAll = async () => {
    try {
      const [s, h, latest] = await Promise.all([getLaoStats(), getLaoHistory(), getLaoLatestPrediction()]);
      setStats(s);
      setHistory(h || []);
      setPrediction(latest);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    readSaved();
    loadAll();
  }, []);

  useEffect(() => {
    if (showSettings) {
      const { k, m } = readSaved();
      setKeyInput(k);
      setModelInput(m);
      setShowKeyText(false);
    }
  }, [showSettings]);

  const saveSettings = () => {
    try {
      const k = keyInput.trim();
      localStorage.setItem(LS_KEY, k);
      localStorage.setItem(LS_MODEL, modelInput);
      setSavedKey(k);
      setSavedModel(modelInput);
      setShowSettings(false);
    } catch (e: any) {
      alert('ไม่สามารถบันทึกได้: ' + e.message);
    }
  };

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { k, m } = readSaved();
      const result = await runLaoAnalysis({ apiKey: k || undefined, model: m || undefined });
      setPrediction({ ...result, checkedPeriod: null });
      setStats(await getLaoStats());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSingle = async () => {
    if (!period.trim()) return alert('กรุณากรอกชื่องวด');
    if (!/^\d{4}$/.test(result4.trim())) return alert('ผลรางวัลต้องเป็นตัวเลข 4 หลัก');
    setIsSaving(true);
    try {
      const canCheck = checkLatest && prediction && !prediction.checkedPeriod;
      const row = await addLaoHistory({ period: period.trim(), result4: result4.trim(), checkLatest: !!canCheck });
      let msg = `บันทึกงวด ${row.period} เรียบร้อย`;
      if (canCheck) {
        const hits = JSON.parse(row.hitDetails || '[]');
        msg += hits.length ? `\n🎉 ทายถูก ${hits.length} รายการ` : '\nงวดนี้ AI ทายไม่ถูก';
      }
      alert(msg);
      setPeriod('');
      setResult4('');
      setPanel('none');
      await loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    if (!bulkText.trim()) return alert('กรุณาวางข้อมูลก่อน');
    setIsSaving(true);
    setImportReport(null);
    try {
      const rep = await importLaoHistory(bulkText);
      setImportReport(rep);
      if (rep.added > 0) setBulkText('');
      await loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, p: string) => {
    if (!confirm(`ลบข้อมูลงวด "${p}" ใช่ไหม?`)) return;
    try {
      await deleteLaoHistory(id);
      await loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const hitSetOf = (row: any) => {
    try {
      return new Set<string>((JSON.parse(row.hitDetails || '[]') as any[]).map(h => h.type));
    } catch {
      return new Set<string>();
    }
  };

  const strategyLabel = (code: string) => (stats?.strategies?.[code] as string) || code;
  const canCheckLatest = !!prediction && !prediction.checkedPeriod;

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] overflow-auto p-4">
      <header className="flex justify-between items-center mb-6 border-b border-[#1e2433] pb-4">
        <h1 className="text-xl font-bold text-[#cba6f7]">🇱🇦 AI วิเคราะห์หวยลาว</h1>
        <span className="text-xs text-[#6c7086]">ฐานข้อมูลแยกจากหวยไทย</span>
      </header>

      <div className="flex flex-col items-center pb-12">
        {/* Top panel */}
        <div className="w-full max-w-5xl flex gap-6 mb-8 items-stretch justify-center flex-wrap">
          {/* Stats */}
          <section className="bg-[#11151e] border border-[#2a3244] rounded-xl p-4 flex-1 min-w-[320px] shadow-lg">
            <h2 className="text-[#a6e3a1] font-bold text-lg mb-3">🎯 สถิติความแม่นยำ</h2>
            {stats ? (
              <>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div className="bg-[#1e1e2e] p-3 rounded-lg">
                    <div className="text-[#6c7086] text-xs mb-1">AI ให้หวย</div>
                    <div className="font-bold text-lg text-[#89b4fa]">{stats.totalPredictions} ครั้ง</div>
                  </div>
                  <div className="bg-[#1e1e2e] p-3 rounded-lg">
                    <div className="text-[#6c7086] text-xs mb-1">ผลรางวัลในระบบ</div>
                    <div className="font-bold text-lg text-[#cba6f7]">{stats.totalHistorical} งวด</div>
                  </div>
                  <div className="bg-[#1e1e2e] p-3 rounded-lg">
                    <div className="text-[#6c7086] text-xs mb-1">ตรวจผลแล้ว</div>
                    <div className="font-bold text-lg text-[#a6e3a1]">{stats.evaluatedCount} งวด</div>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6c7086] border-b border-[#313244]">
                      <th className="text-left py-1">ประเภท</th>
                      <th className="text-right py-1">ถูก</th>
                      <th className="text-right py-1">AI</th>
                      <th className="text-right py-1" title="ค่าเฉลี่ยถ้าเดาสุ่มด้วยจำนวนชุดเท่ากัน">ถ้าสุ่มเดา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.perType.map((t: any) => (
                      <tr key={t.type} className="border-b border-[#1e2433] text-[#cdd6f4]">
                        <td className="py-1">{t.label}</td>
                        <td className="text-right font-mono">{t.hits}/{t.evaluated}</td>
                        <td className={`text-right font-mono font-bold ${t.evaluated && t.accuracyPct > t.randomPct ? 'text-[#a6e3a1]' : ''}`}>{t.accuracyPct}%</td>
                        <td className="text-right font-mono text-[#6c7086]">{t.randomPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.evaluatedCount < 30 && (
                  <p className="text-[10px] text-[#f9e2af] mt-2">⚠️ ตรวจผลไปแล้วไม่ถึง 30 งวด ตัวเลขยังมีโอกาสเป็นความบังเอิญสูง</p>
                )}
              </>
            ) : (
              <p className="text-[#6c7086] text-sm">กำลังโหลด...</p>
            )}
          </section>

          {/* Actions */}
          <section className="bg-[#11151e] border border-[#2a3244] rounded-xl p-6 flex-1 min-w-[320px] shadow-lg flex flex-col relative">
            <button
              id="lao-settings-toggle"
              onClick={() => setShowSettings(!showSettings)}
              className="absolute top-4 right-4 text-sm text-[#89b4fa] hover:underline bg-[#89b4fa]/10 px-3 py-1 rounded-full border border-[#89b4fa]/30"
            >
              ⚙️ ตั้งค่า AI
            </button>
            <p className="text-[#6c7086] mb-4 mt-8 text-center text-sm">
              ระบบคำนวณสถิติจากผลย้อนหลัง แล้วให้ AI เลือกเลขตามสูตร พร้อมจดจำว่าสูตรไหนเคยทายถูก
            </p>

            <div className="w-full mb-4 bg-[#181825] border border-[#313244] rounded-lg px-4 py-3 text-xs flex flex-col gap-1.5">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[#6c7086]">🔑 API Key</span>
                {savedKey ? (
                  <span className="font-mono text-[#a6e3a1] bg-[#a6e3a1]/10 px-2 py-0.5 rounded">{maskKey(savedKey)}</span>
                ) : (
                  <span className="text-[#f9e2af] bg-[#f9e2af]/10 px-2 py-0.5 rounded">ค่าเริ่มต้นของระบบ</span>
                )}
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-[#6c7086]">🤖 โมเดล</span>
                <span className="font-mono text-[#89b4fa] bg-[#89b4fa]/10 px-2 py-0.5 rounded">{savedModel || 'ค่าเริ่มต้น (gemini-2.5-flash)'}</span>
              </div>
              <div className="text-[10px] text-[#45475a]">ใช้ค่าเดียวกับแท็บ AI หวยไทย</div>
            </div>

            {showSettings && (
              <div className="w-full bg-[#181825] border border-[#313244] rounded-lg p-4 mb-4 text-left">
                <label className="text-xs text-[#a6adc8] block mb-1">API Key</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    id="lao-gemini-key"
                    autoComplete="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="วาง Gemini API Key (เว้นว่างเพื่อใช้ค่าระบบ)"
                    style={showKeyText ? undefined : ({ WebkitTextSecurity: 'disc' } as any)}
                    className="flex-1 bg-[#11111b] border border-[#313244] rounded p-2 text-[#cdd6f4] text-xs font-mono focus:border-[#89b4fa] outline-none"
                  />
                  <button type="button" onClick={() => setShowKeyText(v => !v)} className="px-3 text-xs rounded border border-[#313244] text-[#a6adc8]">
                    {showKeyText ? '🙈' : '👁️'}
                  </button>
                </div>
                <label className="text-xs text-[#a6adc8] block mb-1">โมเดล AI</label>
                <select
                  id="lao-model-select"
                  value={modelInput}
                  onChange={e => setModelInput(e.target.value)}
                  className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#cdd6f4] text-xs mb-4"
                >
                  <option value="">-- ค่าเริ่มต้น (gemini-2.5-flash → 3.5-flash) --</option>
                  {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div className="flex justify-end">
                  <button id="lao-save-settings" onClick={saveSettings} className="bg-[#a6e3a1] text-[#11111b] px-4 py-2 rounded text-xs font-bold hover:opacity-90">
                    💾 บันทึกการตั้งค่า
                  </button>
                </div>
              </div>
            )}

            <button
              id="lao-run-analysis"
              onClick={handleRun}
              disabled={isLoading}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-all w-full ${
                isLoading
                  ? 'bg-[#181825] text-[#6c7086] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#cba6f7] to-[#89b4fa] text-[#11111b] hover:opacity-90 shadow-[0_0_15px_rgba(203,166,247,0.3)]'
              }`}
            >
              {isLoading ? '⏳ กำลังวิเคราะห์ (อาจใช้เวลาถึง 1 นาที)...' : '✨ เริ่มวิเคราะห์หวยลาว'}
            </button>

            <div className="flex gap-3 mt-4 w-full">
              <button
                id="lao-open-single"
                onClick={() => setPanel(panel === 'single' ? 'none' : 'single')}
                className="flex-1 text-xs text-[#a6e3a1] bg-[#181825] border border-[#a6e3a1]/20 py-2 rounded hover:bg-[#a6e3a1]/10"
              >
                🎯 กรอกผลงวดล่าสุด & ตรวจผล
              </button>
              <button
                id="lao-open-bulk"
                onClick={() => setPanel(panel === 'bulk' ? 'none' : 'bulk')}
                className="flex-1 text-xs text-[#89b4fa] bg-[#181825] border border-[#89b4fa]/20 py-2 rounded hover:bg-[#89b4fa]/10"
              >
                📥 นำเข้าผลย้อนหลังหลายงวด
              </button>
            </div>
          </section>
        </div>

        {/* Single result form */}
        {panel === 'single' && (
          <section className="w-full max-w-3xl bg-[#1e1e2e] border border-[#a6e3a1]/30 rounded-xl p-6 shadow-xl mb-8">
            <h2 className="text-[#a6e3a1] font-bold mb-4 border-b border-[#313244] pb-2">🎯 กรอกผลรางวัลงวดล่าสุด</h2>
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div>
                <label className="text-xs text-[#6c7086] block mb-1">งวด (เช่น 03/10/2569)</label>
                <input id="lao-period" value={period} onChange={e => setPeriod(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#cdd6f4] text-sm" placeholder="dd/mm/yyyy" />
              </div>
              <div>
                <label className="text-xs text-[#6c7086] block mb-1">ผลรางวัลเลข 4 ตัว</label>
                <input id="lao-result4" value={result4} maxLength={4} onChange={e => setResult4(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#a6e3a1] text-lg font-mono tracking-widest" placeholder="1234" />
              </div>
            </div>
            {result4.length === 4 && (
              <div className="text-xs text-[#a6adc8] mb-4 flex gap-4 flex-wrap">
                <span>3 ตัวตรง: <b className="text-[#f9e2af] font-mono">{result4.slice(1)}</b></span>
                <span>2 ตัวบน: <b className="text-[#89dceb] font-mono">{result4.slice(2)}</b></span>
                <span>2 ตัวล่าง: <b className="text-[#f38ba8] font-mono">{result4.slice(0, 2)}</b></span>
              </div>
            )}
            <label className={`flex items-center gap-2 text-sm mb-4 ${canCheckLatest ? 'text-[#cdd6f4]' : 'text-[#45475a]'}`}>
              <input type="checkbox" checked={canCheckLatest && checkLatest} disabled={!canCheckLatest} onChange={e => setCheckLatest(e.target.checked)} />
              ตรวจกับผลทายล่าสุดของ AI
              {!prediction && <span className="text-xs">(ยังไม่มีผลทาย)</span>}
              {prediction?.checkedPeriod && <span className="text-xs">(ผลทายล่าสุดตรวจกับงวด {prediction.checkedPeriod} แล้ว)</span>}
            </label>
            <div className="flex justify-end gap-2 border-t border-[#313244] pt-4">
              <button onClick={() => setPanel('none')} className="px-6 py-2 rounded bg-[#313244] text-[#cdd6f4] font-bold text-sm">ยกเลิก</button>
              <button id="lao-save-single" onClick={handleAddSingle} disabled={isSaving} className="px-6 py-2 rounded bg-gradient-to-r from-[#cba6f7] to-[#a6e3a1] text-[#11111b] font-bold text-sm">
                {isSaving ? 'กำลังบันทึก...' : 'บันทึก & ตรวจผล'}
              </button>
            </div>
          </section>
        )}

        {/* Bulk import */}
        {panel === 'bulk' && (
          <section className="w-full max-w-3xl bg-[#1e1e2e] border border-[#89b4fa]/30 rounded-xl p-6 shadow-xl mb-8">
            <h2 className="text-[#89b4fa] font-bold mb-2 border-b border-[#313244] pb-2">📥 นำเข้าผลรางวัลย้อนหลังหลายงวด</h2>
            <p className="text-xs text-[#6c7086] mb-3">วางทีละบรรทัด รูปแบบ <code className="text-[#f9e2af]">งวด เลข4ตัว</code> งวดที่มีอยู่แล้วจะถูกข้าม</p>
            <textarea
              id="lao-bulk-text"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={10}
              className="w-full bg-[#11111b] border border-[#313244] rounded p-3 text-[#cdd6f4] text-sm font-mono"
              placeholder={'01/10/2569 1234\n03/10/2569 5678'}
            />
            {importReport && (
              <div className="mt-3 text-xs bg-[#11111b] border border-[#313244] rounded p-3">
                <div className="text-[#a6e3a1] font-bold">เพิ่มสำเร็จ {importReport.added} งวด</div>
                {importReport.skipped.length > 0 && (
                  <div className="mt-2 text-[#f9e2af] max-h-32 overflow-auto">
                    ข้าม {importReport.skipped.length} บรรทัด:
                    {importReport.skipped.map((s, i) => (
                      <div key={i} className="text-[#a6adc8]">• <span className="font-mono">{s.line}</span> — {s.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-[#313244] pt-4 mt-4">
              <button onClick={() => { setPanel('none'); setImportReport(null); }} className="px-6 py-2 rounded bg-[#313244] text-[#cdd6f4] font-bold text-sm">ปิด</button>
              <button id="lao-import" onClick={handleImport} disabled={isSaving} className="px-6 py-2 rounded bg-[#89b4fa] text-[#11111b] font-bold text-sm">
                {isSaving ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
              </button>
            </div>
          </section>
        )}

        {error && (
          <div className="w-full max-w-3xl bg-[#f38ba8]/10 border border-[#f38ba8]/30 rounded-lg p-4 text-[#f38ba8] mb-6 text-center">{error}</div>
        )}

        {/* Prediction result */}
        {prediction && (
          <section className="w-full max-w-5xl mb-6">
            <div className="flex justify-between items-end mb-4 border-b border-[#2a3244] pb-2 flex-wrap gap-2">
              <h2 className="text-[#89b4fa] font-bold text-xl">🎯 เลขเด่นประจำงวด (ประเภทละ 8 ชุด)</h2>
              <div className="text-xs text-[#6c7086]">
                🕒 {new Date(prediction.createdAt).toLocaleString('th-TH')} {prediction.model && <>· 🤖 {prediction.model}</>}
                {prediction.checkedPeriod && <span className="ml-2 text-[#a6e3a1]">✓ ตรวจกับงวด {prediction.checkedPeriod} แล้ว</span>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {TYPE_CARDS.map(card => {
                const items = (prediction[card.key] as PredItem[]) || [];
                return (
                  <div key={card.key} className="bg-[#1e1e2e] border border-[#313244] rounded-lg p-3">
                    <div className="text-center font-bold mb-3" style={{ color: card.color }}>{card.label}</div>
                    <div className="flex flex-col gap-1.5">
                      {items.map((it, i) => (
                        <div key={i} title={it.reason || ''} className="flex items-center justify-between gap-2 px-2 py-1 rounded border" style={{ borderColor: card.color + '40', background: card.color + '10' }}>
                          <span className="font-mono text-lg" style={{ color: card.color }}>{it.num}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ color: STRATEGY_COLORS[it.strategy] || '#6c7086', background: (STRATEGY_COLORS[it.strategy] || '#6c7086') + '20' }}>
                            {it.strategy}
                          </span>
                        </div>
                      ))}
                      {items.length === 0 && <div className="text-center text-xs text-[#45475a]">ไม่มีข้อมูล</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-[#45475a] mt-2">เอาเมาส์ชี้ที่เลขเพื่อดูเหตุผลที่ AI เลือก</p>

            {prediction.analysis && (
              <div className="bg-[#11151e] border border-[#2a3244] rounded-xl p-6 mt-6 shadow-lg">
                <h3 className="text-[#cba6f7] font-bold mb-3">🧠 บทวิเคราะห์จาก AI</h3>
                <div className="text-sm text-[#cdd6f4] whitespace-pre-wrap leading-relaxed">{prediction.analysis}</div>
              </div>
            )}
          </section>
        )}

        {/* Strategy scoreboard */}
        {stats && (
          <section className="w-full max-w-5xl bg-[#11151e] border border-[#2a3244] rounded-xl p-6 mb-6 shadow-lg">
            <h2 className="text-[#f9e2af] font-bold text-lg mb-1">📒 สมุดบันทึกสูตร</h2>
            <p className="text-xs text-[#6c7086] mb-4">นับจากงวดที่ตรวจผลแล้ว อัตราส่วนมากกว่า 1x แปลว่าถูกบ่อยกว่าการเดาสุ่ม (ต้องใช้หลายสิบงวดถึงจะเชื่อถือได้)</p>
            {stats.scoreboard.length === 0 ? (
              <p className="text-sm text-[#45475a] text-center py-4">ยังไม่มีข้อมูล ให้ AI วิเคราะห์ แล้วกรอกผลพร้อมติ๊ก "ตรวจกับผลทายล่าสุด"</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#6c7086] text-xs border-b border-[#313244]">
                    <th className="text-left py-2">สูตร</th>
                    <th className="text-right">ใช้</th>
                    <th className="text-right">ถูก</th>
                    <th className="text-right">ถ้าสุ่มคาดว่าถูก</th>
                    <th className="text-right">อัตราส่วน</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.scoreboard.map((s: any) => (
                    <tr key={s.strategy} className="border-b border-[#1e2433] text-[#cdd6f4]">
                      <td className="py-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-2" style={{ color: STRATEGY_COLORS[s.strategy], background: (STRATEGY_COLORS[s.strategy] || '#6c7086') + '20' }}>{s.strategy}</span>
                        <span className="text-xs text-[#a6adc8]">{strategyLabel(s.strategy)}</span>
                      </td>
                      <td className="text-right font-mono">{s.uses}</td>
                      <td className="text-right font-mono">{s.hits}</td>
                      <td className="text-right font-mono text-[#6c7086]">{s.expectedHits}</td>
                      <td className={`text-right font-mono font-bold ${s.ratio > 1 ? 'text-[#a6e3a1]' : 'text-[#6c7086]'}`}>{s.ratio}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* History */}
        <section className="w-full max-w-5xl bg-[#11151e] border border-[#2a3244] rounded-xl p-6 shadow-lg">
          <h2 className="text-[#89b4fa] font-bold text-lg mb-4">🗂️ ประวัติผลรางวัลและการตรวจผล ({history.length} งวด)</h2>
          {history.length === 0 ? (
            <p className="text-sm text-[#45475a] text-center py-4">ยังไม่มีข้อมูล ใช้ปุ่ม "นำเข้าผลย้อนหลังหลายงวด" เพื่อเริ่มต้น</p>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#11151e]">
                  <tr className="text-[#6c7086] text-xs border-b border-[#313244]">
                    <th className="text-left py-2">งวด</th>
                    <th className="text-center">4 ตัว</th>
                    <th className="text-center">3 ตัว</th>
                    <th className="text-center">2 บน</th>
                    <th className="text-center">2 ล่าง</th>
                    <th className="text-left">ผลตรวจ AI</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => {
                    const hits = hitSetOf(r);
                    const badge = (t: string, label: string) => (
                      <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded mr-1 ${hits.has(t) ? 'bg-[#a6e3a1]/20 text-[#a6e3a1] font-bold' : 'bg-[#313244]/50 text-[#45475a]'}`}>{label}</span>
                    );
                    return (
                      <tr key={r.id} className="border-b border-[#1e2433] text-[#cdd6f4] h-9">
                        <td className="py-1">{r.period}</td>
                        <td className="text-center font-mono text-[#cba6f7]">{r.result4}</td>
                        <td className="text-center font-mono text-[#f9e2af]">{r.top3}</td>
                        <td className="text-center font-mono text-[#89dceb]">{r.top2}</td>
                        <td className="text-center font-mono text-[#f38ba8]">{r.bot2}</td>
                        <td>
                          {r.predictionId ? (
                            <>{badge('d4', '4ตรง')}{badge('top3', '3ตรง')}{badge('tod3', '3โต๊ด')}{badge('top2', '2บน')}{badge('bot2', '2ล่าง')}</>
                          ) : (
                            <span className="text-[10px] text-[#45475a]">ข้อมูลย้อนหลัง</span>
                          )}
                        </td>
                        <td className="text-right">
                          <button onClick={() => handleDelete(r.id, r.period)} className="text-[10px] text-[#f38ba8]/60 hover:text-[#f38ba8]" title="ลบ">🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-[10px] text-[#45475a] mt-6 text-center max-w-2xl">
          ผลรางวัลเป็นการสุ่ม ระบบนี้ช่วยวิเคราะห์สถิติอย่างเป็นระบบ แต่ไม่สามารถรับประกันผลได้
        </p>
      </div>
    </div>
  );
}
