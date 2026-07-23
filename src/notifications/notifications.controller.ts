import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── MY NOTIFICATIONS ─────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get my notifications (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated notifications with unread count',
  })
  async getMyNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationsService.getMyNotifications(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  // ─── MARK ONE AS READ ─────────────────────────────────────────────────
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async markAsRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  // ─── MARK ALL AS READ ─────────────────────────────────────────────────
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  // ─── ADMIN: BROADCAST ─────────────────────────────────────────────────
  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: '[Admin] Send notification to ALL users',
    description:
      'Creates in-app notifications for every user. Will also trigger FCM when configured.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: '🎉 Sunday Special!' },
        body: { type: 'string', example: 'Get 30% off on all orders today!' },
      },
    },
  })
  async broadcast(@Body('title') title: string, @Body('body') body: string) {
    return this.notificationsService.sendToAll(title, body, 'PROMO');
  }

  // ─── REGISTER PUSH TOKEN ──────────────────────────────────────────────
  @Post('register-push-token')
  @ApiOperation({ summary: 'Register Expo Push Token for the current session' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        },
      },
    },
  })
  async registerPushToken(
    @Req() req: AuthenticatedRequest,
    @Body('token') token: string,
  ) {
    const sessionId = req['session']?.id;
    if (!sessionId) {
      throw new Error('No active session found.');
    }
    return this.notificationsService.registerPushToken(sessionId, token);
  }

  // ─── GET PUSH TOKEN ──────────────────────────────────────────────────
  @Get('push-token')
  @ApiOperation({
    summary: 'Get the push token registered for the current session',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the current session push token',
  })
  async getPushToken(@Req() req: AuthenticatedRequest) {
    const sessionId = req['session']?.id;
    if (!sessionId) {
      throw new Error('No active session found.');
    }
    return this.notificationsService.getPushToken(sessionId);
  }

  // ─── UPDATE PUSH TOKEN ───────────────────────────────────────────────
  @Patch('push-token')
  @ApiOperation({
    summary: 'Update or clear the push token for the current session',
    description:
      'Send a new token to update, or null to unregister push notifications for this device.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          nullable: true,
          example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          description: 'New push token, or null to unregister',
        },
      },
    },
  })
  async updatePushToken(
    @Req() req: AuthenticatedRequest,
    @Body('token') token: string | null,
  ) {
    const sessionId = req['session']?.id;
    if (!sessionId) {
      throw new Error('No active session found.');
    }
    return this.notificationsService.updatePushToken(sessionId, token);
  }
}
