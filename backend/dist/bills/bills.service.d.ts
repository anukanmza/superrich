import { PrismaService } from '../prisma/prisma.service.js';
export declare class BillsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        customer: {
            id: number;
            name: string;
            phone: string | null;
            disc: number | null;
            color: string | null;
            tc: string | null;
        };
        entries: {
            number: string;
            id: number;
            type: string;
            amount: number;
            billId: number;
        }[];
    } & {
        id: number;
        customerId: number;
        total: number;
        createdAt: Date;
        status: string;
    })[]>;
    create(data: {
        customerId: number;
        entries: any[];
    }): Promise<{
        entries: {
            number: string;
            id: number;
            type: string;
            amount: number;
            billId: number;
        }[];
    } & {
        id: number;
        customerId: number;
        total: number;
        createdAt: Date;
        status: string;
    }>;
}
