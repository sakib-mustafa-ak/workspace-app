import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Inject,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as User } from '../auth/interfaces/current-user.interface';
import { SaveEventDto } from './event.dto';
import { EventsService } from './events.service';

@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.events.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() input: SaveEventDto) {
    return this.events.create(user.id, input);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SaveEventDto,
  ) {
    return this.events.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.events.remove(user.id, id);
  }
}

@Module({ controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
