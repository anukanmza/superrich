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

  async update(id: number, data: { entries: any[] }) {
    const total = data.entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

    // Replace all entries
    // We do this by deleting all existing entries and creating new ones in a transaction
    return this.prisma.$transaction(async (prisma) => {
      await prisma.entry.deleteMany({
        where: { billId: id },
      });

      return prisma.bill.update({
        where: { id },
        data: {
          total,
          entries: {
            create: data.entries,
          },
        },
        include: {
          entries: true,
        },
      });
    });
  }

  async archiveCurrentPeriod(periodName: string, cutoutsJson: string, resultsJson: string) {
    // Get all bills
    const allBills = await this.findAll();

    // Get all settings
    const allSettings = await this.prisma.setting.findMany();
    const settingsObj = {};
    allSettings.forEach(s => {
      settingsObj[s.key] = s.value;
    });

    // Create archive
    const archive = await this.prisma.periodArchive.create({
      data: {
        period: periodName,
        bills: JSON.stringify(allBills),
        cutouts: cutoutsJson,
        results: resultsJson,
        settings: JSON.stringify(settingsObj)
      }
    });

    // Clear active data in a transaction
    await this.prisma.$transaction([
      this.prisma.entry.deleteMany({}),
      this.prisma.bill.deleteMany({}),
    ]);

    return archive;
  }

  async getArchives() {
    return this.prisma.periodArchive.findMany({
      select: {
        id: true,
        period: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      }
    });
  }

  async getArchiveById(id: number) {
    return this.prisma.periodArchive.findUnique({
      where: { id }
    });
  }
}
