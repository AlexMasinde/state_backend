import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AtGuard } from '../auth/guards/at.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

export type EventWithCreator = {
  eventId: string;
  eventName: string;
  dateAdded: Date;
  eventDate: Date;
  participants: string;
  status: string;
  location: string;
  organizer: string;
  createdBy: string | null;
  createdByName: string | null;
  updatedBy?: string | null;
  dateModified?: Date | null;
};

@UseGuards(AtGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  create(
    @Body() createEventDto: CreateEventDto,
    @GetUser() user: any,
  ): Promise<EventWithCreator> {
    return this.eventService.create(createEventDto, user);
  }

  @Get()
  findAll(): Promise<EventWithCreator[]> {
    return this.eventService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') eventId: string): Promise<EventWithCreator> {
    return this.eventService.findOne(eventId);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  update(
    @Param('id') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
    @GetUser() user: any,
  ): Promise<EventWithCreator> {
    return this.eventService.update(eventId, updateEventDto, user);
  }

  @Delete(':id')
  remove(@Param('id') eventId: string): Promise<void> {
    return this.eventService.remove(eventId);
  }
}
