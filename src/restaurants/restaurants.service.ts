import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restaurant } from '@prisma/client';

@Injectable()
export class RestaurantsService {

  constructor(private prisma:PrismaService){}
  async create (createRestaurantDto: CreateRestaurantDto,managerId:string):Promise<Restaurant> {

    const existing = await this.prisma.restaurant.findUnique({
      where: {managerId}
    })

    if(existing){
      throw new ConflictException("You already have a restaurant");
    }

    return this.prisma.restaurant.create({
      data: {
        name: createRestaurantDto.name,
        description: createRestaurantDto.description,
        image: createRestaurantDto.image,
        costForTwo: createRestaurantDto.costForTwo,
        cuisineTypes: createRestaurantDto.cuisineTypes,
        address: createRestaurantDto.address,
        lat: createRestaurantDto.lat,
        lng: createRestaurantDto.lng,
        managerId,
        isActive:true,
        isOpen:true,
        isVerified:false,
        fssaiCode: createRestaurantDto.fssaiCode,
        gstNumber: createRestaurantDto.gstNumber,
      }
    })
   
  }

  async findAll() {
    return await this.prisma.restaurant.findMany({
      where:{isActive:true}
    })
  }

  async findOne(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where:{id}
    })

    if(!restaurant){
      throw new NotFoundException( `Restaurant with ID ${id} not found`)
    }

    return restaurant
  }

  update(id: string, updateRestaurantDto: UpdateRestaurantDto) {
    return `This action updates a #${id} restaurant`;
  }

  remove(id: string) {
    return `This action removes a #${id} restaurant`;
  }
}
