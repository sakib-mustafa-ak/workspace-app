import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';
import { SearchService } from '../services/search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(
    @Inject(SearchService) private readonly searchService: SearchService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Global search across accessible workspace resources',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search term query string',
  })
  public async search(
    @CurrentUser() user: CurrentUserModel,
    @Query('q') query: string,
  ) {
    return this.searchService.searchGlobal(user.id, query || '');
  }
}
