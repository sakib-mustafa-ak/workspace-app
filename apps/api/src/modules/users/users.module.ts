import { Module } from '@nestjs/common';

import { UsersController } from './controllers/users.controller';
import { UsersEventBus } from './events/users.events';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UsersEventBus],
  exports: [UsersService, UsersEventBus],
})
export class UsersModule {}
