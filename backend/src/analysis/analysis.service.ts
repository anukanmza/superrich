import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { historicalData as defaultHistoricalData } from './historical.js';

@Injectable()
export class AnalysisService {
  constructor(private prisma: PrismaService) {}

  async analyzeCurrentPeriod(apiKeyOverride?: string, modelOverride?: string) {
    const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpException('API Key Not Found. Please provide an API key.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      // Fetch historical data from DB
      let historyRecords = await this.prisma.aiHistoricalData.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      let historyDataStr = "";
      if (historyRecords.length > 0) {
        historyDataStr = JSON.stringify(historyRecords.map(r => {
          let rec: any = { period: r.period, '3บนออก': r.top3, '2ล่างออก': r.bot2 };
          if (r.aiPredictedTop3) {
            rec['ทาย3บนถูกไหม'] = r.isHitTop3 ? 'ถูก' : 'ผิด';
            rec['ทาย2บนถูกไหม'] = r.isHitTop2 ? 'ถูก' : 'ผิด';
            rec['ทาย2ล่างถูกไหม'] = r.isHitBot2 ? 'ถูก' : 'ผิด';
          }
          return rec;
        }));
      } else {
        historyDataStr = "ยังไม่มีประวัติงวดก่อนหน้า";
      }

      // Call Gemini API directly via fetch, requesting JSON format
      const prompt = `
ในฐานะผู้เชี่ยวชาญด้านความน่าจะเป็นและการวิเคราะห์ข้อมูลรางวัลสลากกินแบ่งรัฐบาล
โปรดวิเคราะห์ข้อมูลผลรางวัลย้อนหลังเหล่านี้:
${historyDataStr}

ให้พิจารณาปัจจัยเสริมเพิ่มเติม เช่น โอกาสเลขเบิ้ล เลขหาม และพฤติกรรมการออกรางวัลที่อาจมีการ "ล็อค" ของรัฐบาล ตามสถิติความถี่
ช่วยทำนายตัวเลขที่มีโอกาสออกมากที่สุดในงวดปัจจุบัน (ทั้ง 3 ตัวบน, 2 ตัวบน และ 2 ตัวล่าง) โดยแต่ละประเภทให้เลือกมา 8 ชุด

กรุณาตอบกลับในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "analysisText": "คำอธิบายเชิงลึกแบบภาษาไทย (อธิบายเหตุผล, สถิติ, และคำแนะนำเชิงความเสี่ยงที่เจ้ามือควรระวัง)",
  "predictedTop3": ["123", "456", "...", "..."], // อาเรย์ของสตริง 8 ชุด
  "predictedTop2": ["12", "34", "...", "..."],   // อาเรย์ของสตริง 8 ชุด
  "predictedBot2": ["56", "78", "...", "..."]    // อาเรย์ของสตริง 8 ชุด
}
ห้ามมีข้อความอื่นนอกเหนือจาก JSON object
`;

      // Use official SDK which natively supports the new AQ keys and handles endpoint routing correctly
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      
      let modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      if (modelOverride) {
        modelsToTry = [modelOverride];
      }
      let rawText = '';
      let allErrors: string[] = [];

      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.7,
            }
          });
          
          const result = await model.generateContent(prompt);
          rawText = result.response.text();
          if (rawText) break;
        } catch (e: any) {
          allErrors.push(`${modelName}: ${e.message}`);
          console.log(`SDK Model ${modelName} failed:`, e.message);
        }
      }

      if (!rawText) {
        let availableModels = 'Unknown';
        try {
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          const modelsData = await modelsRes.json();
          if (modelsData.models) {
            availableModels = modelsData.models.map((m: any) => m.name).join(', ');
          } else {
            availableModels = JSON.stringify(modelsData);
          }
        } catch (err) {
          availableModels = 'Failed to fetch model list';
        }
        throw new Error(`Gemini SDK Error. Errors: ${allErrors.join(' | ')}. Available models: ${availableModels}`);
      }
      
      let resultObj;
      try {
        let cleanText = rawText.trim();
        if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
        if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
        cleanText = cleanText.trim();
        resultObj = JSON.parse(cleanText);
      } catch (e) {
        throw new Error("Invalid JSON from Gemini: " + rawText);
      }

      // Save prediction to DB (using a dummy target period name for now, in a real app this would be the actual upcoming period)
      // Determine next period roughly based on current date
      const d = new Date();
      const targetPeriod = `งวดต่อไป (${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear() + 543})`;

      await this.prisma.aiPrediction.create({
        data: {
          targetPeriod: targetPeriod,
          predictedTop3: JSON.stringify(resultObj.predictedTop3 || []),
          predictedTop2: JSON.stringify(resultObj.predictedTop2 || []),
          predictedBot2: JSON.stringify(resultObj.predictedBot2 || []),
          analysisText: resultObj.analysisText,
        }
      });

      return { 
        analysis: resultObj.analysisText,
        predictedTop3: resultObj.predictedTop3,
        predictedTop2: resultObj.predictedTop2,
        predictedBot2: resultObj.predictedBot2
      };
    } catch (err: any) {
      console.error('Analysis error:', err.message);
      throw new HttpException(err.message || 'Error processing AI analysis', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getHistory() {
    return this.prisma.aiHistoricalData.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async addHistory(data: { period: string, top3: string, bot2: string, aiTop3?: string[], aiTop2?: string[], aiBot2?: string[] }) {
    const period = (data.period || '').trim();
    const top3 = (data.top3 || '').trim();
    const bot2 = (data.bot2 || '').trim();
    if (!period || !top3 || !bot2) {
      throw new HttpException('กรุณากรอกงวดและผลรางวัลให้ครบถ้วน', HttpStatus.BAD_REQUEST);
    }

    const existing = await this.prisma.aiHistoricalData.findUnique({ where: { period } });
    if (existing) {
      throw new HttpException(`งวด "${period}" มีอยู่ในระบบแล้ว`, HttpStatus.CONFLICT);
    }

    // Clean prediction lists: trim, drop blanks; treat empty list as "no prediction"
    const clean = (arr?: string[]) => {
      if (!Array.isArray(arr)) return undefined;
      const out = arr.map(s => String(s).trim()).filter(Boolean);
      return out.length ? out : undefined;
    };
    data = { period, top3, bot2, aiTop3: clean(data.aiTop3), aiTop2: clean(data.aiTop2), aiBot2: clean(data.aiBot2) };
    
    const isHitTop3 = data.aiTop3 ? data.aiTop3.includes(data.top3) : false;
    // 2 ตัวบน คือ 2 ตัวท้ายของรางวัลที่ 1 (3ตัวบน)
    const actualTop2 = data.top3.length >= 2 ? data.top3.substring(data.top3.length - 2) : '';
    const isHitTop2 = data.aiTop2 ? data.aiTop2.includes(actualTop2) : false;
    const isHitBot2 = data.aiBot2 ? data.aiBot2.includes(data.bot2) : false;

    return this.prisma.aiHistoricalData.create({
      data: {
        period: data.period,
        top3: data.top3,
        bot2: data.bot2,
        aiPredictedTop3: data.aiTop3 ? JSON.stringify(data.aiTop3) : null,
        aiPredictedTop2: data.aiTop2 ? JSON.stringify(data.aiTop2) : null,
        aiPredictedBot2: data.aiBot2 ? JSON.stringify(data.aiBot2) : null,
        isHitTop3,
        isHitTop2,
        isHitBot2
      }
    });
  }

  async fixDb() {
    await this.prisma.aiHistoricalData.updateMany({
      data: {
        aiPredictedTop3: null,
        aiPredictedTop2: null,
        aiPredictedBot2: null,
        isHitTop3: false,
        isHitTop2: false,
        isHitBot2: false,
      }
    });
    return { message: "Fixed DB: all AI predictions cleared from history" };
  }

  async getLatestPrediction() {
    const latest = await this.prisma.aiPrediction.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    if (!latest) return null;
    
    return {
      analysis: latest.analysisText || "ผลการวิเคราะห์ล่าสุด (ดึงจากประวัติเดิม)",
      predictedTop3: JSON.parse(latest.predictedTop3),
      predictedTop2: JSON.parse(latest.predictedTop2),
      predictedBot2: JSON.parse(latest.predictedBot2),
      createdAt: latest.createdAt
    };
  }

  async getStats() {
    const predictionsCount = await this.prisma.aiPrediction.count();
    const historyCount = await this.prisma.aiHistoricalData.count();

    // Calculate real accuracy from DB (records where any AI prediction was recorded).
    // NOTE: read-only — never auto-modify data here.
    const evaluatedRecords = await this.prisma.aiHistoricalData.findMany({
      where: {
        OR: [
          { aiPredictedTop3: { not: null } },
          { aiPredictedTop2: { not: null } },
          { aiPredictedBot2: { not: null } },
        ],
      },
    });

    let accuracyTop3 = "0%";
    let accuracyTop2 = "0%";
    let accuracyBot2 = "0%";
    let top3Hits = 0;
    let top2Hits = 0;
    let bot2Hits = 0;

    if (evaluatedRecords.length > 0) {
      top3Hits = evaluatedRecords.filter(r => r.isHitTop3).length;
      top2Hits = evaluatedRecords.filter(r => r.isHitTop2).length;
      bot2Hits = evaluatedRecords.filter(r => r.isHitBot2).length;
      
      accuracyTop3 = Math.round((top3Hits / evaluatedRecords.length) * 100) + "%";
      accuracyTop2 = Math.round((top2Hits / evaluatedRecords.length) * 100) + "%";
      accuracyBot2 = Math.round((bot2Hits / evaluatedRecords.length) * 100) + "%";
    }

    return {
      totalPredictions: predictionsCount,
      totalHistorical: historyCount,
      accuracyTop3,
      accuracyTop2,
      accuracyBot2,
      top3Hits,
      top2Hits,
      bot2Hits,
      evaluatedCount: evaluatedRecords.length,
      lastChecked: new Date().toISOString()
    };
  }
}
