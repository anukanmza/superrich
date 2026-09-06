import { Controller, Get, Post, Body } from '@nestjs/common';
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
}
