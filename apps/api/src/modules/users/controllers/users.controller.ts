import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserListResponseDto, UserProfileDto } from '../dto/user-response.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  public async getMe(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<UserProfileDto> {
    const profile = await this.users.getProfile(user.id);
    return toUserProfile(profile);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  public async updateMe(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const updated = await this.users.updateProfile(user.id, body);
    return toUserProfile(updated);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  public async getUserById(@Param('id') id: string): Promise<UserProfileDto> {
    const profile = await this.users.getProfile(id);
    return toUserProfile(profile);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ type: UserListResponseDto })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  public async listUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<UserListResponseDto> {
    const result = await this.users.listUsers({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    return {
      users: result.users.map(toUserProfile),
      total: result.total,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user account' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnprocessableEntityResponse({
    description: 'Cannot delete your own account.',
  })
  @ApiForbiddenResponse({ description: 'Account is suspended.' })
  public async deleteUser(
    @CurrentUser() user: CurrentUserModel,
    @Param('id') id: string,
  ): Promise<void> {
    await this.users.deleteAccount(user.id, id);
  }
}

function toUserProfile(row: {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string | null;
  locale: string | null;
  status: unknown;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): UserProfileDto {
  return {
    id: row.id,
    displayName: row.displayName,
    email: row.email,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    timezone: row.timezone,
    locale: row.locale,
    status: row.status as UserProfileDto['status'],
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
