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
    remove(id: number): Promise<{
        id: number;
        customerId: number;
        total: number;
        createdAt: Date;
        status: string;
    }>;
    update(id: number, data: {
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
    archiveCurrentPeriod(periodName: string, cutoutsJson: string, resultsJson: string): Promise<{
        id: number;
        bills: string;
        createdAt: Date;
        period: string;
        cutouts: string;
        results: string;
        settings: string;
    }>;
    getArchives(): Promise<{
        id: number;
        createdAt: Date;
        period: string;
    }[]>;
    getArchiveById(id: number): Promise<{
        id: number;
        bills: string;
        createdAt: Date;
        period: string;
        cutouts: string;
        results: string;
        settings: string;
    } | null>;
    removeArchive(id: number): Promise<{
        id: number;
        bills: string;
        createdAt: Date;
        period: string;
        cutouts: string;
        results: string;
        settings: string;
    }>;
}
