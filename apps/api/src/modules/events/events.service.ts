import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  DATABASE,
  eq,
  gte,
  isNull,
  personalEvents,
  sql,
  type Db,
} from '@repo/database';
import { SaveEventDto } from './event.dto';

@Injectable()
export class EventsService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  list(userId: string) {
    return this.db
      .select()
      .from(personalEvents)
      .where(
        and(
          eq(personalEvents.userId, userId),
          isNull(personalEvents.deletedAt),
          gte(
            sql`COALESCE(${personalEvents.endsAt}, ${personalEvents.startsAt})`,
            new Date(),
          ),
        ),
      )
      .orderBy(asc(personalEvents.startsAt), asc(personalEvents.id))
      .limit(100);
  }

  private values(input: SaveEventDto) {
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (
      !Number.isFinite(startsAt.getTime()) ||
      (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))
    ) {
      throw new BadRequestException('End time must be after the start time.');
    }
    if (!input.title.trim())
      throw new BadRequestException('Enter an event title.');
    return {
      title: input.title.trim(),
      startsAt,
      endsAt,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    };
  }

  async create(userId: string, input: SaveEventDto) {
    const [event] = await this.db
      .insert(personalEvents)
      .values({ ...this.values(input), userId })
      .returning();
    return event;
  }

  async update(userId: string, id: string, input: SaveEventDto) {
    const [event] = await this.db
      .update(personalEvents)
      .set({ ...this.values(input), updatedAt: new Date() })
      .where(
        and(
          eq(personalEvents.id, id),
          eq(personalEvents.userId, userId),
          isNull(personalEvents.deletedAt),
        ),
      )
      .returning();
    if (!event) throw new NotFoundException('Event not found.');
    return event;
  }

  async remove(userId: string, id: string) {
    const [event] = await this.db
      .update(personalEvents)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(personalEvents.id, id),
          eq(personalEvents.userId, userId),
          isNull(personalEvents.deletedAt),
        ),
      )
      .returning({ id: personalEvents.id });
    if (!event) throw new NotFoundException('Event not found.');
  }
}
