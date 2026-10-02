import { Controller, Get } from '@nestjs/common';
import { AiService } from './ai.service.js';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('predictions')
  async getPredictions() {
    return await this.aiService.getPredictions();
  }
}
