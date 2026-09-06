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
let SettingsService = class SettingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        const settings = await this.prisma.setting.findMany();
        const result = {};
        for (const s of settings) {
            try {
                result[s.key] = JSON.parse(s.value);
            }
            catch (e) {
                result[s.key] = s.value;
            }
        }
        return result;
    }
    async update(settings) {
        const keys = Object.keys(settings);
        for (const key of keys) {
            const valueStr = JSON.stringify(settings[key]);
            await this.prisma.setting.upsert({
                where: { key },
                update: { value: valueStr },
                create: { key, value: valueStr },
            });
        }
        return this.findAll();
    }
};
SettingsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], SettingsService);
export { SettingsService };
//# sourceMappingURL=settings.service.js.map