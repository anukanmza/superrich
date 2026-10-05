import { Module } from '@nestjs/common';
import { LaoAnalysisService } from './lao-analysis.service.js';
import { LaoAnalysisController } from './lao-analysis.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [LaoAnalysisController],
  providers: [LaoAnalysisService],
})
export class LaoAnalysisModule {}
