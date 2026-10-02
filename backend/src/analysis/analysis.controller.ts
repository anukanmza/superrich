import { Controller, Get, Post, Body } from '@nestjs/common';
import { AnalysisService } from './analysis.service.js';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get()
  async getAnalysis() {
    return this.analysisService.analyzeCurrentPeriod();
  }

  @Get('latest-prediction')
  async getLatestPrediction() {
    return this.analysisService.getLatestPrediction();
  }

  @Get('history')
  async getHistory() {
    return this.analysisService.getHistory();
  }

  @Post('history')
  async addHistory(@Body() body: { period: string, top3: string, bot2: string, aiTop3?: string[], aiTop2?: string[], aiBot2?: string[] }) {
    return this.analysisService.addHistory(body);
  }

  @Post('fix-db')
  async fixDb() {
    return this.analysisService.fixDb();
  }

  @Get('stats')
  async getStats() {
    return this.analysisService.getStats();
  }
}
