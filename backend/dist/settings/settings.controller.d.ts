import { SettingsService } from './settings.service.js';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    findAll(): Promise<Record<string, any>>;
    update(settings: Record<string, any>): Promise<Record<string, any>>;
}
