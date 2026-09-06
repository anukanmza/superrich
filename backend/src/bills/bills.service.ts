import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BillsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.bill.findMany({
      include: {
        customer: true,
        entries: true,
      },
    });
  }

  async create(data: { customerId: number; entries: any[] }) {
    // calculate total
    const total = data.entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

    return this.prisma.bill.create({
      data: {
        customerId: data.customerId,
        total,
        entries: {
          create: data.entries,
        },
      },
      include: {
        entries: true,
      },
    });
  }

  async remove(id: number) {
    // delete related entries first
    await this.prisma.entry.deleteMany({
      where: { billId: id },
    });
    // then delete the bill
    return this.prisma.bill.delete({
      where: { id },
    });
  }
}
