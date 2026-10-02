import { Controller, Get } from '@nestjs/common';
import { AnalysisService } from './analysis.service.js';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get()
  async getAnalysis() {
    return this.analysisService.analyzeCurrentPeriod();
  }
}
