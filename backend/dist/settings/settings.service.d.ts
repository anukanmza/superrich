import { PrismaService } from '../prisma/prisma.service.js';
export declare class SettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<Record<string, any>>;
    update(settings: Record<string, any>): Promise<Record<string, any>>;
}
