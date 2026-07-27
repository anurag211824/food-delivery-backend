import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Discovery & Search')
@Controller('api/discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('cuisines')
  @ApiOperation({
    summary: 'Get all active cuisines',
    description:
      'Returns a list of cuisines/categories for the "What\'s on your mind" section.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of cuisines returned successfully',
  })
  async getCuisines() {
    return this.discoveryService.getCuisines();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('recent-searches')
  @ApiOperation({
    summary: "Get user's recent searches",
    description: 'Returns the last 10 search queries for the logged-in user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent searches returned successfully',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getRecentSearches(@Req() req: AuthenticatedRequest) {
    return this.discoveryService.getRecentSearches(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('recent-searches')
  @ApiOperation({
    summary: 'Save a search query',
    description: "Adds a query to the user's recent search history.",
  })
  @ApiBody({ schema: { example: { query: 'Pizza' } } })
  @ApiResponse({ status: 201, description: 'Search query saved' })
  async addRecentSearch(
    @Body('query') query: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.discoveryService.addRecentSearch(req.user.id, query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete('recent-searches')
  @ApiOperation({
    summary: 'Clear all recent searches',
    description: 'Deletes all search history for the logged-in user.',
  })
  @ApiResponse({ status: 200, description: 'History cleared' })
  async clearRecentSearches(@Req() req: AuthenticatedRequest) {
    return this.discoveryService.clearRecentSearches(req.user.id);
  }

  @Get('menu-items')
  @ApiOperation({
    summary: 'Get all menu items with restaurant IDs',
    description:
      'Returns a list of menu items with images and their corresponding restaurant IDs for the search page.',
  })
  @ApiResponse({ status: 200, description: 'Menu items returned successfully' })
  async getMenuItems() {
    return this.discoveryService.getMenuItems();
  }
}
