import { Controller, Get, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Post()
  update(@Body() settings: Record<string, any>) {
    return this.settingsService.update(settings);
  }
}
