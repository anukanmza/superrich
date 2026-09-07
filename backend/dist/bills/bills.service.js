var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
let BillsService = class BillsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.bill.findMany({
            include: {
                customer: true,
                entries: true,
            },
        });
    }
    async create(data) {
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
    async remove(id) {
        await this.prisma.entry.deleteMany({
            where: { billId: id },
        });
        return this.prisma.bill.delete({
            where: { id },
        });
    }
    async update(id, data) {
        const total = data.entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
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
    async archiveCurrentPeriod(periodName, cutoutsJson, resultsJson) {
        const allBills = await this.findAll();
        const allSettings = await this.prisma.setting.findMany();
        const settingsObj = {};
        allSettings.forEach(s => {
            settingsObj[s.key] = s.value;
        });
        const archive = await this.prisma.periodArchive.create({
            data: {
                period: periodName,
                bills: JSON.stringify(allBills),
                cutouts: cutoutsJson,
                results: resultsJson,
                settings: JSON.stringify(settingsObj)
            }
        });
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
    async getArchiveById(id) {
        return this.prisma.periodArchive.findUnique({
            where: { id }
        });
    }
    async removeArchive(id) {
        return this.prisma.periodArchive.delete({
            where: { id }
        });
    }
};
BillsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], BillsService);
export { BillsService };
//# sourceMappingURL=bills.service.js.map