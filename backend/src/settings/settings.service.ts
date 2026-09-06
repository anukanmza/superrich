import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const settings = await this.prisma.setting.findMany();
    const result: Record<string, any> = {};
    for (const s of settings) {
      try {
        result[s.key] = JSON.parse(s.value);
      } catch (e) {
        result[s.key] = s.value;
      }
    }
    return result;
  }

  async update(settings: Record<string, any>) {
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
}
