import { Controller, Get, Post, Body, Delete, Param } from '@nestjs/common';
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

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.billsService.remove(+id);
  }
}
