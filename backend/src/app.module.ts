import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { BillsModule } from './bills/bills.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { AnalysisModule } from './analysis/analysis.module.js';
import { LaoAnalysisModule } from './lao-analysis/lao-analysis.module.js';

@Module({
  imports: [PrismaModule, CustomersModule, BillsModule, SettingsModule, AnalysisModule, LaoAnalysisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
