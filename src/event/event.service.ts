import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UsersService } from '../users/users.service';
import { EventWithCreator } from './event.controller';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly usersService: UsersService,
  ) {}

  async create(
    createEventDto: CreateEventDto,
    user?: any,
  ): Promise<EventWithCreator> {
    try {
      const event = this.eventRepository.create({
        ...createEventDto,
        createdBy: user?.sub || null,
        updatedBy: user?.sub || null,
        dateModified: new Date(),
      });
      const saved = await this.eventRepository.save(event);
      let createdByName: string | null = null;
      if (saved.createdBy) {
        const dbUser = await this.usersService.findById(saved.createdBy);
        createdByName = dbUser?.name || null;
      }
      return { ...saved, createdByName };
    } catch (error) {
      this.logger.error(
        `Failed to create event: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not create event');
    }
  }

  async findAll(): Promise<any[]> {
    try {
      const events = await this.eventRepository.find();
      const userIds = Array.from(
        new Set(events.map((e) => e.createdBy).filter(Boolean)),
      );
      const users = await Promise.all(
        userIds.map((id) => this.usersService.findById(id)),
      );
      const userMap = new Map(users.filter(Boolean).map((u) => [u.id, u.name]));
      return events.map((event) => ({
        ...event,
        createdByName: userMap.get(event.createdBy) || null,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch events: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not fetch events');
    }
  }

  async findOne(eventId: string): Promise<any> {
    try {
      this.logger.log(`🔍 Looking for event: ${eventId}`);
      console.log(`🔍 Looking for event: ${eventId}`);
      
      // Check database connection
      const isConnected = this.eventRepository.manager.connection.isConnected;
      this.logger.log(`📡 Database connected: ${isConnected}`);
      console.log(`📡 Database connected: ${isConnected}`);
      
      // Try the query with explicit logging
      const queryBuilder = this.eventRepository.createQueryBuilder('event');
      const event = await queryBuilder
        .where('event.eventId = :eventId', { eventId })
        .getOne();
      
      this.logger.log(`📊 Query result: ${event ? 'Found' : 'Not found'}`);
      console.log(`📊 Query result: ${event ? 'Found' : 'Not found'}`);
      
      if (!event) {
        // Try direct SQL to see if we get a different result
        const directQuery = await this.eventRepository.query(
          'SELECT * FROM events WHERE eventId = ?',
          [eventId]
        );
        this.logger.log(`🔧 Direct query result: ${directQuery.length} rows`);
        console.log(`🔧 Direct query result: ${directQuery.length} rows`);
        
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      }
      
      let createdByName: string | null = null;
      if (event.createdBy) {
        const user = await this.usersService.findById(event.createdBy);
        createdByName = user?.name || null;
      }
      return { ...event, createdByName };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `Failed to fetch event ${eventId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not fetch event');
    }
  }

  async update(
    eventId: string,
    updateEventDto: UpdateEventDto,
    user?: any,
  ): Promise<EventWithCreator> {
    try {
      const event = await this.eventRepository.findOne({ where: { eventId } });
      if (!event)
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      Object.assign(event, updateEventDto);
      event.updatedBy = user?.sub || null;
      event.dateModified = new Date();
      const saved = await this.eventRepository.save(event);
      let createdByName: string | null = null;
      if (saved.createdBy) {
        const dbUser = await this.usersService.findById(saved.createdBy);
        createdByName = dbUser?.name || null;
      }
      return { ...saved, createdByName };
    } catch (error) {
      this.logger.error(
        `Failed to update event ${eventId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not update event');
    }
  }

  async remove(eventId: string): Promise<void> {
    try {
      const event = await this.findOne(eventId);
      await this.eventRepository.remove(event);
    } catch (error) {
      this.logger.error(
        `Failed to remove event ${eventId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not delete event');
    }
  }
}
