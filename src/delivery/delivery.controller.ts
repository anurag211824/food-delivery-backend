import { Controller, Post, Body, Patch, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { DriverStatus, Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
// import { UpdateDeliveryDto } from './dto/update-delivery.dto';

@ApiTags("Delivery & Logistics")
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.DELIVERY_PARTNER)

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) { }

  @Post()
  @ApiOperation({ summary: "Setup Delivery Profile" })
  @ApiResponse({ status: 201, description: "Profile Created Successfully" })
  async create(@Req() req: AuthenticatedRequest, @Body() createDeliveryDto: CreateDeliveryDto) {
    return this.deliveryService.createProfile(req.user.id, createDeliveryDto);
  }

  // toggle status

  @Patch("status")
  @ApiOperation({ summary: "Toggle Online/Offline Status" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        status: { type: 'string', example: "ONLINE", enum: ["ONLINE", "OFFLINE"] },
      },
    }
  })
  async toggleStatus(@Req() req: AuthenticatedRequest, @Body('status') status: string) {
    if (status !== 'ONLINE' && status !== 'OFFLINE') {
      throw new ForbiddenException("Invalid status")
    }

    return this.deliveryService.toggleStatus(req.user.id, status as DriverStatus);
  }


}
