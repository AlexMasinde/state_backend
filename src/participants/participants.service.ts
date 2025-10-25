import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant } from './participant.entity';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { EventService } from '../event/event.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    private readonly eventService: EventService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateParticipantDto): Promise<Participant> {
    const event = await this.eventService.findOne(dto.eventId);
    if (!event) throw new NotFoundException('Event not found');
    const now = new Date();
    const participant = this.participantRepository.create({
      ...dto,
      event,
      createdAt: now,
      updatedAt: now,
    });
    return this.participantRepository.save(participant);
  }

  async findAllParticipants(): Promise<Participant[]> {
    return this.participantRepository.find({
      relations: ['event', 'checkedInBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(eventId: string): Promise<Participant[]> {
    return this.participantRepository.find({
      where: { event: { eventId } },
      relations: ['event', 'checkedInBy'],
    });
  }

  async findOne(id: string): Promise<Participant> {
    const participant = await this.participantRepository.findOne({
      where: { id },
      relations: ['event', 'checkedInBy'],
    });
    if (!participant) throw new NotFoundException('Participant not found');
    return participant;
  }

  async update(id: string, dto: UpdateParticipantDto): Promise<Participant> {
    const participant = await this.findOne(id);
    Object.assign(participant, dto);
    participant.updatedAt = new Date();
    return this.participantRepository.save(participant);
  }

  async remove(id: string): Promise<void> {
    const participant = await this.findOne(id);
    await this.participantRepository.remove(participant);
  }

  async checkIn(id: string, userId: string): Promise<Participant> {
    const participant = await this.findOne(id);
    if (participant.checkedIn)
      throw new ForbiddenException('Already checked in');
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    participant.checkedIn = true;
    participant.checkedInBy = user;
    participant.checkedInAt = new Date();
    participant.updatedAt = new Date();
    return this.participantRepository.save(participant);
  }

  async bulkCreate(
    dtos: CreateParticipantDto[],
  ): Promise<{ success: boolean; count: number }> {
    // Get the event for the first participant (all should have the same eventId)
    const eventId = dtos[0]?.eventId;
    if (!eventId) {
      throw new NotFoundException('Event ID is required');
    }
    
    const event = await this.eventService.findOne(eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const now = new Date();
    const participants = dtos.map((dto) =>
      this.participantRepository.create({
        ...dto,
        event,
        createdAt: now,
        updatedAt: now,
      }),
    );
    
    await this.participantRepository.insert(participants);
    return { success: true, count: participants.length };
  }

  async search(eventId: string, searchTerm: string): Promise<Participant[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const query = this.participantRepository
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.event', 'event')
      .leftJoinAndSelect('participant.checkedInBy', 'checkedInBy')
      .where('participant.event.eventId = :eventId', { eventId })
      .andWhere(
        '(LOWER(participant.name) LIKE LOWER(:searchTerm) OR ' +
        'LOWER(participant.idNumber) LIKE LOWER(:searchTerm) OR ' +
        'LOWER(participant.phoneNumber) LIKE LOWER(:searchTerm))',
        { searchTerm: `%${searchTerm.trim()}%` }
      )
      .orderBy('participant.name', 'ASC')
      .limit(50); // Limit results for performance

    return query.getMany();
  }

  async getStats(eventId: string): Promise<{
    total: number;
    checkedIn: number;
    notCheckedIn: number;
    checkInRate: number;
  }> {
    const total = await this.participantRepository.count({
      where: { event: { eventId } },
    });

    const checkedIn = await this.participantRepository.count({
      where: { event: { eventId }, checkedIn: true },
    });

    const notCheckedIn = total - checkedIn;
    const checkInRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return {
      total,
      checkedIn,
      notCheckedIn,
      checkInRate,
    };
  }
}
