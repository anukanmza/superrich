import { CustomersService } from './customers.service.js';
export declare class CustomersController {
    private readonly customersService;
    constructor(customersService: CustomersService);
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
    findOne(id: string): Promise<({
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
    update(id: string, data: any): Promise<{
        id: number;
        name: string;
        phone: string | null;
        disc: number | null;
        color: string | null;
        tc: string | null;
    }>;
    remove(id: string): Promise<{
        id: number;
        name: string;
        phone: string | null;
        disc: number | null;
        color: string | null;
        tc: string | null;
    }>;
}
