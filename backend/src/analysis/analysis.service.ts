import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AnalysisService {
  async analyzeCurrentPeriod() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpException('API Key Not Found', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      // Read historical data locally to avoid touching the DB
      const historyPath = path.join(process.cwd(), 'src', 'analysis', 'historical.json');
      const historyData = fs.readFileSync(historyPath, 'utf8');

      // Call Gemini API directly via fetch
      const prompt = `
ในฐานะผู้เชี่ยวชาญด้านความน่าจะเป็นและการวิเคราะห์ข้อมูลรางวัลสลากกินแบ่งรัฐบาล
โปรดวิเคราะห์ข้อมูลผลรางวัลย้อนหลังเหล่านี้ (จำลอง 5 ปี):
${historyData}

ให้พิจารณาปัจจัยเสริมเพิ่มเติม เช่น โอกาสเลขเบิ้ล เลขหาม และพฤติกรรมการออกรางวัลที่อาจมีการ "ล็อค" ของรัฐบาล ตามสถิติความถี่
ช่วยทำนายตัวเลขที่มีโอกาสออกมากที่สุดในงวดปัจจุบัน (ทั้ง 3 ตัวบน และ 2 ตัวล่าง)
โดยให้สรุปมาเป็น 3 ประเด็นหลัก:
1. เลข 3 ตัวบนที่เด่นที่สุด 3 ชุด
2. เลข 2 ตัวล่างที่เด่นที่สุด 3 ชุด
3. คำแนะนำเชิงความเสี่ยงสำหรับเจ้ามือ (เช่น ควรระวังการรับแทงเลขใดเป็นพิเศษ)

ตอบกลับเป็นภาษาไทยที่อ่านง่ายและกระชับ
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API Error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่สามารถวิเคราะห์ข้อมูลได้';

      return { analysis: text };
    } catch (err: any) {
      console.error('Analysis error:', err.message);
      throw new HttpException(err.message || 'Error processing AI analysis', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
