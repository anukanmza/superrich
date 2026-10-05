import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { LaoAnalysisService } from './lao-analysis.service.js';

@Controller('lao-analysis')
export class LaoAnalysisController {
  constructor(private readonly service: LaoAnalysisService) {}

  @Post()
  async run(@Body() body: { apiKey?: string; model?: string }) {
    return this.service.analyze(body?.apiKey, body?.model);
  }

  @Get('latest-prediction')
  async latest() {
    return this.service.getLatestPrediction();
  }

  @Get('history')
  async history() {
    return this.service.getHistory();
  }

  @Post('history')
  async addHistory(@Body() body: { period: string; result4: string; checkLatest?: boolean }) {
    return this.service.addHistory(body);
  }

  @Post('history/import')
  async importHistory(@Body() body: { text: string }) {
    return this.service.importHistory(body?.text);
  }

  @Delete('history/:id')
  async deleteHistory(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteHistory(id);
  }

  @Get('stats')
  async stats() {
    return this.service.getStats();
  }
}
