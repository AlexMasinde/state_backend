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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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

@UseGuards(AtGuard, RolesGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @Roles('admin') // Only admins can create events
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
  @Roles('admin') // Only admins can update events
  @UsePipes(new ValidationPipe({ whitelist: true }))
  update(
    @Param('id') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
    @GetUser() user: any,
  ): Promise<EventWithCreator> {
    return this.eventService.update(eventId, updateEventDto, user);
  }

  @Delete(':id')
  @Roles('admin') // Only admins can delete events
  remove(@Param('id') eventId: string): Promise<void> {
    return this.eventService.remove(eventId);
  }
}
