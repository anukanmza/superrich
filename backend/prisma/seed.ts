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
    const customer = await prisma.customer.create({
      data: c,
    });
    console.log(`Created customer with id: ${customer.id}`);
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
