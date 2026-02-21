import { Injectable, NotFoundException,ConflictException } from '@nestjs/common';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { DriverStatus } from '@prisma/client';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) { }

  async createProfile(userId:string,dto: CreateDeliveryDto) {
    const existing = await this.prisma.driverProfile.findUnique({
      where: {userId},
    });

    if(existing) {
      throw new ConflictException("You already have a driver profile!")
    }

    return this.prisma.driverProfile.create({
      data: {
        userId,
        vehicleType: dto.vehicleType,
        licenseNumber: dto.licenseNumber,
        vehiclePlate: dto.vehicleLicensePlate,
      }
    })
  }

  // change status ( online / offline)

  async toggleStatus(userId:string, status: DriverStatus){

    const profile = await this.prisma.driverProfile.findUnique({
      where: {userId},
    });

    if(!profile) {
      throw new NotFoundException("Driver profile not found. Please setup profile first.")
    }
    return this.prisma.driverProfile.update({
      where: {id:profile.id},
      data: {status: status}
    })
  }

  findAll() {
    return `This action returns all delivery`;
  }

  findOne(id: number) {
    return `This action returns a #${id} delivery`;
  }

  update(id: number, updateDeliveryDto: UpdateDeliveryDto) {
    return `This action updates a #${id} delivery`;
  }

  remove(id: number) {
    return `This action removes a #${id} delivery`;
  }
}
