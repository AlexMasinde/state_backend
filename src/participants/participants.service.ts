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
import { SmsService } from '../sms/sms.service';
import { VoterService } from '../voter/voter.service';

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    private readonly eventService: EventService,
    private readonly usersService: UsersService,
    private readonly smsService: SmsService,
    private readonly voterService: VoterService,
  ) {}

  async create(dto: CreateParticipantDto): Promise<Participant> {
    const event = await this.eventService.findOne(dto.eventId);
    if (!event) throw new NotFoundException('Event not found');
    
    // Enrich with voter data if available
    const enrichedData = await this.enrichWithVoterData(dto);
    const now = new Date();
    
    const participant = new Participant();
    Object.assign(participant, {
      ...enrichedData,
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
    
    const savedParticipant = await this.participantRepository.save(participant);
    
    // // Send SMS confirmation if phone number exists
    // if (participant.phoneNumber && participant.event) {
    //   try {
    //     await this.smsService.sendCheckInConfirmation(
    //       participant.phoneNumber,
    //       participant.name,
    //       participant.event.eventName
    //     );
    //   } catch (error) {
    //     this.logger.error(`Failed to send SMS to participant ${participant.id}:`, error);
    //     // Don't fail the check-in if SMS fails
    //   }
    // }
    
    return savedParticipant;
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
    
    // For large datasets (100+ participants), use query builder for better performance
    if (dtos.length > 100) {
      const chunkSize = 500; // Insert in chunks of 500 for optimal database performance
      const totalChunks = Math.ceil(dtos.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = dtos.slice(i * chunkSize, (i + 1) * chunkSize);
        
        const values = chunk.map((dto) => ({
          name: dto.name,
          idNumber: dto.idNumber,
          phoneNumber: dto.phoneNumber,
          group: dto.group,
          origin: dto.origin,
          eventId: event.eventId,
          createdAt: now,
          updatedAt: now,
        }));

        // Use createQueryBuilder for better performance
        await this.participantRepository
          .createQueryBuilder()
          .insert()
          .into('participant')
          .values(values)
          .execute();
      }
      
      return { success: true, count: dtos.length };
    } else {
      // For smaller datasets, use the standard insert
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

  // Helper method to enrich participant data with voter information
  private async enrichWithVoterData(dto: CreateParticipantDto): Promise<any> {
    const normalizedIdNumber = String(dto.idNumber).trim();
    
    // Try to fetch voter data
    const voterData = await this.voterService.checkVoterRegistration(normalizedIdNumber);
    
    if (voterData && voterData.isRegisteredVoter) {
      // Person found in voter register - use voter data
      return {
        name: voterData.fullName || dto.name, // Use voter name if available
        idNumber: normalizedIdNumber,
        phoneNumber: dto.phoneNumber,
        group: dto.group,
        origin: dto.origin,
        checkedIn: false, // Required field
        // Voter data
        county: voterData.county,
        constituency: voterData.constituency,
        ward: voterData.ward,
        pollingStation: voterData.pollingStation,
        registeredVoter: true,
        tribe: voterData.tribe,
        clan: voterData.clan,
        family: voterData.family,
        gender: voterData.gender,
        dateOfBirth: voterData.dateOfBirth,
      };
    } else {
      // Person NOT found - use basic data only
      return {
        name: dto.name,
        idNumber: normalizedIdNumber,
        phoneNumber: dto.phoneNumber,
        group: dto.group,
        origin: dto.origin,
        checkedIn: false, // Required field
        // No voter data
        county: null,
        constituency: null,
        ward: null,
        pollingStation: null,
        registeredVoter: false,
        tribe: null,
        clan: null,
        family: null,
        gender: null,
        dateOfBirth: null,
      };
    }
  }
}
