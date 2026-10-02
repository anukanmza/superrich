import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async getPredictions() {
    // ดึงข้อมูลย้อนหลัง 5 ปี (ประมาณ 120 งวด)
    const history = await this.prisma.periodArchive.findMany({
      take: 120,
      orderBy: { id: 'desc' },
    });

    if (history.length === 0) {
      return { error: "ไม่มีข้อมูลสถิติย้อนหลังเพียงพอสำหรับการวิเคราะห์" };
    }

    // จัดรูปแบบข้อมูลส่งให้ AI
    const statsText = history.map(h => {
      let r: any = { "3บน": "-", "2บน": "-", "2ล่าง": "-" };
      try {
        r = JSON.parse(h.results);
      } catch(e) {}
      return `งวดวันที่ ${h.period}: 3ตัวบน=${r["3บน"]}, 2ตัวบน=${r["2บน"]}, 2ตัวล่าง=${r["2ล่าง"]}`;
    }).join('\n');

    const prompt = `
คุณคือระบบ AI ผู้เชี่ยวชาญด้านสถิติความน่าจะเป็น นี่คือข้อมูลสถิติผลการออกรางวัลย้อนหลัง 5 ปี (ประมาณ 120 งวด):
${statsText}


จงวิเคราะห์ข้อมูลทั้งหมดเพื่อหาแพทเทิร์น และให้คำแนะนำสำหรับงวดถัดไปดังนี้:
1. เลข 3 ตัวบน ที่มีโอกาสออกมากที่สุด 8 ชุด พร้อมเหตุผลสั้นๆ เชิงสถิติ (เช่น ออกบ่อย, เลขขาดหาย)
2. เลข 2 ตัวบน ที่มีโอกาสออกมากที่สุด 8 ชุด พร้อมเหตุผลสั้นๆ
3. เลข 2 ตัวล่าง ที่มีโอกาสออกมากที่สุด 8 ชุด พร้อมเหตุผลสั้นๆ

ตอบกลับในรูปแบบ JSON เท่านั้น ห้ามพิมพ์ข้อความอื่น โดยมีโครงสร้างดังนี้:
{
  "top3": [
    { "number": "123", "reason": "เหตุผล..." } // มี 8 รายการ
  ],
  "top2": [
    { "number": "12", "reason": "เหตุผล..." } // มี 8 รายการ
  ],
  "bottom2": [
    { "number": "45", "reason": "เหตุผล..." } // มี 8 รายการ
  ],
  "summary": "ข้อความอธิบายภาพรวมจาก AI (เช่น แนวโน้มเลขคู่คี่ หรือเลขที่เด่นที่สุด)"
}
`;

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // ดึงเฉพาะส่วนที่เป็น JSON ออกมาจากคำตอบของ AI
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : responseText.replace(/```json|```/g, '');
      
      return JSON.parse(jsonString);
    } catch (error: any) {
      console.error('AI Prediction Error:', error);
      return { error: `ไม่สามารถประมวลผล AI ได้: ${error.message || 'Unknown error'}` };
    }
  }
}
