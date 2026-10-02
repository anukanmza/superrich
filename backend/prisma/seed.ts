import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const customers = [
    { name: 'ลูกค้าทั่วไป', phone: '', disc: -1, color: '#1e2d3d', tc: '#89b4fa' },
    { name: 'สมชาย ใจดี', phone: '081-234-5678', disc: 15, color: '#1e3329', tc: '#a6e3a1' },
    { name: 'สมหญิง รักดี', phone: '089-876-5432', disc: 20, color: '#2d1e38', tc: '#cba6f7' },
    { name: 'วิชัย มั่งมี', phone: '095-111-2233', disc: 10, color: '#2a2419', tc: '#f9e2af' }
  ];

  for (const c of customers) {
    const existingCustomer = await prisma.customer.findFirst({ where: { name: c.name } });
    if (!existingCustomer) {
      const customer = await prisma.customer.create({ data: c });
      console.log(`Created customer: ${customer.name}`);
    }
  }

  console.log('Seeding PeriodArchives (Mock Data for AI)...');
  
  // Helper to pad numbers with leading zeros (e.g., 5 -> "05")
  const pad = (num: number, len: number) => num.toString().padStart(len, '0');
  
  // Generate 24 mock periods (approx 1 year of data)
  for (let i = 1; i <= 24; i++) {
    // Just mock periods like "1/01/2026", "16/01/2026"
    const month = pad(Math.ceil(i / 2), 2);
    const day = i % 2 !== 0 ? "01" : "16";
    const year = "2025";
    const periodName = `${day}/${month}/${year}`;

    // Random mock results
    // Random 3 top (000-999)
    const top3 = pad(Math.floor(Math.random() * 1000), 3);
    // 2 top is the last 2 digits of 3 top
    const top2 = top3.slice(1);
    // 2 bottom (00-99)
    const bottom2 = pad(Math.floor(Math.random() * 100), 2);

    const resultsJson = JSON.stringify({
      "3บน": top3,
      "2บน": top2,
      "2ล่าง": bottom2
    });

    const existingArchive = await prisma.periodArchive.findFirst({ where: { period: periodName } });
    
    if (!existingArchive) {
      await prisma.periodArchive.create({
        data: {
          period: periodName,
          bills: "[]",
          cutouts: "{}",
          results: resultsJson,
          settings: "{}"
        }
      });
      console.log(`Created mock period: ${periodName} -> 3บน:${top3} 2ล่าง:${bottom2}`);
    }
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
