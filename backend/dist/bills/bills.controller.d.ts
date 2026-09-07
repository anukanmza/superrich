import { BillsService } from './bills.service.js';
export declare class BillsController {
    private readonly billsService;
    constructor(billsService: BillsService);
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
    create(data: any): Promise<{
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
    getArchives(): Promise<{
        id: number;
        createdAt: Date;
        period: string;
    }[]>;
    getArchiveById(id: string): Promise<{
        id: number;
        bills: string;
        createdAt: Date;
        period: string;
        cutouts: string;
        results: string;
        settings: string;
    } | null>;
    removeArchive(id: string): Promise<{
        id: number;
        bills: string;
        createdAt: Date;
        period: string;
        cutouts: string;
        results: string;
        settings: string;
    }>;
    archiveCurrentPeriod(data: {
        periodName: string;
        cutoutsJson: string;
        resultsJson: string;
    }): Promise<{
        id: number;
        bills: string;
        createdAt: Date;
        period: string;
        cutouts: string;
        results: string;
        settings: string;
    }>;
    remove(id: string): Promise<{
        id: number;
        customerId: number;
        total: number;
        createdAt: Date;
        status: string;
    }>;
    update(id: string, data: any): Promise<{
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
