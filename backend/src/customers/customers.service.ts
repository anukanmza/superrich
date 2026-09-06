import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customer.findMany({
      include: { bills: true },
    });
  }

  async findOne(id: number) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: { bills: true },
    });
  }

  async create(data: any) {
    return this.prisma.customer.create({
      data,
    });
  }

  async update(id: number, data: any) {
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
