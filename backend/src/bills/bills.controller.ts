import { Controller, Get, Post, Body, Delete, Put, Param } from '@nestjs/common';
import { BillsService } from './bills.service.js';

@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  findAll() {
    return this.billsService.findAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.billsService.create(data);
  }

  @Get('archives')
  getArchives() {
    return this.billsService.getArchives();
  }

  @Get('archives/:id')
  getArchiveById(@Param('id') id: string) {
    return this.billsService.getArchiveById(+id);
  }

  @Post('archive')
  archiveCurrentPeriod(@Body() data: { periodName: string, cutoutsJson: string, resultsJson: string }) {
    return this.billsService.archiveCurrentPeriod(data.periodName, data.cutoutsJson, data.resultsJson);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.billsService.remove(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.billsService.update(+id, data);
  }
}
