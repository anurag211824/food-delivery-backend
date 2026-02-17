import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Account & Profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) { }

  @Post()
  @ApiOperation({ summary: 'Save new address', description: 'Supports GPS detect or manual entry' })
  @ApiResponse({ status: 201, description: 'Address created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() dto: CreateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addressesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get saved addresses', description: 'Manage multiple addresses' })
  @ApiResponse({ status: 200, description: 'List of user addresses' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.addressesService.findAll(req.user.id);
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Set default address' })
  @ApiResponse({ status: 200, description: 'Default address updated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your address' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async setDefault(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressesService.setDefault(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete address' })
  @ApiResponse({ status: 200, description: 'Address deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your address' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressesService.remove(id, req.user.id);
  }
}