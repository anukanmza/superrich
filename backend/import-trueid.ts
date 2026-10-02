import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading TrueID data...');
  const text = fs.readFileSync('/Users/anukanphetphanomkun/.gemini/antigravity-ide/brain/e2eb2c05-41f1-4c97-bc59-984dff524472/.system_generated/steps/167/content.md', 'utf-8');
  
  const lines = text.split('\n');
  const resultsByDate: Record<string, { top3?: string, top2?: string, bottom2?: string }> = {};

  for (const line of lines) {
    // Match date and the number sequence at the end of the line
    const match = line.match(/-\s*(\d+)\s+([ก-๙]+)\s+(\d{4})[^\d]*([\d\s,]{2,})/);
    if (match) {
      const day = match[1];
      let month = match[2];
      const year = match[3];
      const numbers = match[4].replace(/[\s,]/g, '');
      
      // Fix typos in article
      if (month.includes('กรกฏา')) month = 'กรกฎาคม';
      if (month.includes('กุมภาพัน')) month = 'กุมภาพันธ์';
      
      const dateStr = `${day} ${month} ${year}`;
      if (!resultsByDate[dateStr]) resultsByDate[dateStr] = {};
      
      if (numbers.length === 6) {
        // รางวัลที่ 1
        resultsByDate[dateStr].top3 = numbers.slice(3, 6);
        resultsByDate[dateStr].top2 = numbers.slice(4, 6);
      } else if (numbers.length === 2) {
        // เลขท้าย 2 ตัว
        resultsByDate[dateStr].bottom2 = numbers;
      }
    }
  }

  console.log('Clearing old mock data...');
  await prisma.periodArchive.deleteMany(); // Clear mock data to use real data

  console.log('Inserting real data into database...');
  let count = 0;
  for (const [date, res] of Object.entries(resultsByDate)) {
    if (res.top3 && res.bottom2) {
      const resultsJson = JSON.stringify({
        "3บน": res.top3,
        "2บน": res.top2,
        "2ล่าง": res.bottom2
      });

      await prisma.periodArchive.create({
        data: {
          period: date,
          bills: "[]",
          cutouts: "{}",
          results: resultsJson,
          settings: "{}"
        }
      });
      count++;
    }
  }

  console.log(`Successfully imported ${count} real periods from TrueID.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
