import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Account & Profile') // Groups this under Section 1.1 of your plan 
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @ApiOperation({ summary: 'Save new address', description: 'Supports GPS detect or manual entry' })
  async create(@Body() dto: CreateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addressesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get saved addresses', description: 'Manage multiple addresses' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.addressesService.findAll(req.user.id); // [cite: 69]
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Set default address' })
  async setDefault(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressesService.setDefault(id, req.user.id); // 
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete address' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressesService.remove(id, req.user.id); // [cite: 66]
  }
}