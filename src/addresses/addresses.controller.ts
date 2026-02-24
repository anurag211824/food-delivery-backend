import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

const AddressExample = {
  id: 'clxyz456',
  userId: 'clxyz123',
  type: 'HOME',
  addressLine: '15 Rajpur Road, Dehradun',
  landmark: 'Opposite Silvercity Mall',
  lat: 30.3256,
  lng: 78.0437,
  isDefault: true,
};

@ApiTags('Account & Profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) { }

  @Post()
  @ApiOperation({
    summary: 'Save a new address',
    description: 'Add a delivery address for the logged-in user. Supports GPS co-ordinates or a manually typed address.'
  })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({
    status: 201,
    description: 'Address saved successfully',
    schema: { example: AddressExample }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated — send Bearer token' })
  async create(@Body() dto: CreateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addressesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get my saved addresses',
    description: 'Returns all delivery addresses saved by the logged-in user.'
  })
  @ApiResponse({
    status: 200,
    description: 'List of addresses',
    schema: { example: [AddressExample] }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated — send Bearer token' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.addressesService.findAll(req.user.id);
  }

  @Patch(':id/set-default')
  @ApiOperation({
    summary: 'Set default address',
    description: 'Mark one address as the default delivery address. Clears the default flag on all other addresses first.'
  })
  @ApiParam({ name: 'id', example: 'clxyz456', description: 'Address ID to set as default' })
  @ApiResponse({
    status: 200,
    description: 'Default address updated',
    schema: { example: { ...AddressExample, isDefault: true } }
  })
  @ApiResponse({ status: 403, description: 'Forbidden — this address does not belong to you' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async setDefault(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressesService.setDefault(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an address',
    description: 'Edit any field of a saved address. Only the address owner can update it.'
  })
  @ApiParam({ name: 'id', example: 'clxyz456', description: 'Address ID to update' })
  @ApiBody({ type: UpdateAddressDto })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully',
    schema: { example: AddressExample }
  })
  @ApiResponse({ status: 403, description: 'Forbidden — this address does not belong to you' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addressesService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an address',
    description: 'Permanently remove a saved address. You can only delete your own addresses.'
  })
  @ApiParam({ name: 'id', example: 'clxyz456', description: 'Address ID to delete' })
  @ApiResponse({
    status: 200,
    description: 'Address deleted successfully',
    schema: { example: { message: 'Address deleted' } }
  })
  @ApiResponse({ status: 403, description: 'Forbidden — this address does not belong to you' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressesService.remove(id, req.user.id);
  }
}