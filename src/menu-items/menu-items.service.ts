import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MenuItem } from "@prisma/client";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class MenuItemsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async create(dto: CreateMenuItemDto,managerId:string):Promise<MenuItem> {
    const category = await this.prisma.menuCategory.findUnique({
      where:{id:dto.categoryId},
      include:{restaurant:true}
    })

    if(!category){
      throw new NotFoundException("Category not Found")
    }

    if(category.restaurant.managerId !== managerId){
      throw new ForbiddenException("You do not have permission to add items to this category.")
    }

    const newItem = await this.prisma.menuItem.create({
     data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        image: dto.image,
        type: dto.type, // VEG, NON_VEG, etc.
        spiceLevel: dto.spiceLevel,
        isBestseller: dto.isBestseller ?? false,
        prepTime: dto.prepTime,
        categoryId: dto.categoryId,
      }
    });
    
    await this.cacheManager.clear();
    return newItem;
  }

  async findAll() {
    return this.prisma.menuItem.findMany({
      where:{},
      include:{category:true}
    })
  }

  async findAllByRestaurant(restaurantId:string): Promise<MenuItem[]>{
    return this.prisma.menuItem.findMany(
      {
        where:{
          category: {restaurantId:restaurantId}
        }
      }
    )
  }

  async findOne(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where:{id}
    });

    if(!item){
      throw new NotFoundException("Menu item not found")
    }

    return item
  }

  async update(id: string, updateMenuItemDto: UpdateMenuItemDto) {
    const item = await this.prisma.menuItem.findUnique({
      where: {id}
    })

    if (!item) {
      throw new NotFoundException("Menu item not found");
    }

    const updatedItem = await this.prisma.menuItem.update({
      where: { id },
      data: updateMenuItemDto,
    });
    
    await this.cacheManager.clear();
    return updatedItem;
  }

  async remove(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: {id}
    })

    if (!item) {
      throw new NotFoundException("Menu item not found");
    }

    const deletedItem = await this.prisma.menuItem.delete({
      where: { id }
    });
    
    await this.cacheManager.clear();
    return deletedItem;
  }
}
