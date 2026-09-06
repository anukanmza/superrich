import { PrismaService } from '../prisma/prisma.service.js';
export declare class CustomersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        bills: {
            id: number;
            customerId: number;
            total: number;
            createdAt: Date;
            status: string;
        }[];
    } & {
        id: number;
        name: string;
        phone: string | null;
        disc: number | null;
        color: string | null;
        tc: string | null;
    })[]>;
    findOne(id: number): Promise<({
        bills: {
            id: number;
            customerId: number;
            total: number;
            createdAt: Date;
            status: string;
        }[];
    } & {
        id: number;
        name: string;
        phone: string | null;
        disc: number | null;
        color: string | null;
        tc: string | null;
    }) | null>;
    create(data: any): Promise<{
        id: number;
        name: string;
        phone: string | null;
        disc: number | null;
        color: string | null;
        tc: string | null;
    }>;
    update(id: number, data: any): Promise<{
        id: number;
        name: string;
        phone: string | null;
        disc: number | null;
        color: string | null;
        tc: string | null;
    }>;
    remove(id: number): Promise<{
        id: number;
        name: string;
        phone: string | null;
        disc: number | null;
        color: string | null;
        tc: string | null;
    }>;
}
