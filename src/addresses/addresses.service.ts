import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  // Accept BOTH dto and userId
  async create(dto: CreateAddressDto, userId: string) {
    const count = await this.prisma.address.count({ where: { userId } });
    return this.prisma.address.create({
      data: { ...dto, userId, isDefault: count === 0 },
    });
  }

  // Accept userId to filter
  async findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  // Add this missing method
  async setDefault(id: string, userId: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new ForbiddenException();

    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });
  }

  // Accept BOTH id and userId for security
  async remove(id: string, userId: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new ForbiddenException();
    return this.prisma.address.delete({ where: { id } });
  }
}