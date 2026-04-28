import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
    
    // Check if a participant with this idNumber already exists
    const normalizedId = String(dto.idNumber).trim();
    const existing = await this.participantRepository.findOne({
      where: { idNumber: normalizedId },
      relations: ['event', 'checkedInBy'],
    });
    
    if (existing) {
      // Update the existing participant with new data and reassign to the new event
      Object.assign(existing, {
        ...enrichedData,
        event,
        checkedIn: false,
        checkedInBy: null,
        checkedInAt: null,
        updatedAt: now,
      });
      return this.participantRepository.save(existing);
    }
    
    // Create a new participant
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

    const query = String(searchTerm).trim();
    
    // 1. Phone number match
    // Matches: 07.../01... (10 digits), 254.../+254... (12/13 chars), or bare 7.../1... (9 digits)
    const phoneRegex = /^(07|01)\d{8}$|^(254|\+254)(7|1)\d{8}$|^(7|1)\d{8}$/;
    if (phoneRegex.test(query)) {
      return this.searchByPhone(eventId, query);
    }
    
    // 2. ID match
    // If it contains only digits (and maybe spaces/dashes), it's an ID search.
    const strippedQuery = query.replace(/[\s-]/g, '');
    const numericRegex = /^\d+$/;
    if (numericRegex.test(strippedQuery)) {
      const participant = await this.participantRepository.findOne({
        where: { 
          event: { eventId },
          idNumber: strippedQuery 
        },
        relations: ['event', 'checkedInBy'],
      });
      return participant ? [participant] : [];
    }
    
    // 3. Name match fallback
    const tokens = query.split(/\s+/).filter(t => t.length > 0);
    
    // Pass 1: All tokens must match (most precise, e.g. "George Morara" matches "George Morara Masinde")
    const andQb = this.participantRepository.createQueryBuilder('participant')
      .leftJoinAndSelect('participant.event', 'event')
      .leftJoinAndSelect('participant.checkedInBy', 'checkedInBy')
      .where('participant.event.eventId = :eventId', { eventId });
    tokens.forEach((token, index) => {
      andQb.andWhere(`participant.name LIKE :andToken${index}`, { [`andToken${index}`]: `%${token}%` });
    });
    let results = await andQb.getMany();
    
    // Pass 2: Any token matches (broader, e.g. "George Masinde" finds "George Morara" via "George")
    if (results.length === 0 && tokens.length > 1) {
      const orQb = this.participantRepository.createQueryBuilder('participant')
        .leftJoinAndSelect('participant.event', 'event')
        .leftJoinAndSelect('participant.checkedInBy', 'checkedInBy')
        .where('participant.event.eventId = :eventId', { eventId });
      const orConditions = tokens.map((_, index) => `participant.name LIKE :orToken${index}`).join(' OR ');
      const orParams: Record<string, string> = {};
      tokens.forEach((token, index) => { orParams[`orToken${index}`] = `%${token}%`; });
      orQb.andWhere(`(${orConditions})`, orParams);
      results = await orQb.getMany();
    }
    
    // Pass 3: Phonetic fallback (catches misspellings like "Njoroje" → "Njoroge")
    if (results.length === 0) {
      const phoneticQb = this.participantRepository.createQueryBuilder('participant')
        .leftJoinAndSelect('participant.event', 'event')
        .leftJoinAndSelect('participant.checkedInBy', 'checkedInBy')
        .where('participant.event.eventId = :eventId', { eventId })
        .andWhere(`SOUNDEX(participant.name) = SOUNDEX(:query)`, { query });
        
      results = await phoneticQb.getMany();
    }
    
    return results;
  }

  async searchByPhone(eventId: string, phoneNumber: string): Promise<Participant[]> {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      return [];
    }

    // Normalize any Kenyan phone format down to the core 9 digits (e.g. 712345678)
    let core = String(phoneNumber).trim();
    // Strip +254 or 254 prefix
    core = core.replace(/^\+?254/, '');
    // Strip leading zero
    core = core.replace(/^0+/, '');

    // Now 'core' should be 9 digits like 702192319
    // Search against all possible stored formats
    const participants = await this.participantRepository
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.event', 'event')
      .leftJoinAndSelect('participant.checkedInBy', 'checkedInBy')
      .where('participant.event.eventId = :eventId', { eventId })
      .andWhere(
        '(participant.phoneNumber = :core OR participant.phoneNumber = :withZero OR participant.phoneNumber = :with254 OR participant.phoneNumber = :withPlus254)',
        { 
          core,
          withZero: `0${core}`,
          with254: `254${core}`,
          withPlus254: `+254${core}`,
        }
      )
      .getMany();

    return participants;
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

  async getGlobalStats(): Promise<{
    total: number;
    checkedIn: number;
    notCheckedIn: number;
    checkInRate: number;
  }> {
    const total = await this.participantRepository.count();

    const checkedIn = await this.participantRepository.count({
      where: { checkedIn: true },
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
        name: dto.name, // Always use the submitted name
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

  async bulkCreateOrUpdate(dtos: CreateParticipantDto[], enrichmentData: Map<string, any>): Promise<void> {
    if (dtos.length === 0) return;
    
    const eventId = dtos[0].eventId;
    const event = await this.eventService.findOne(eventId);
    if (!event) throw new NotFoundException('Event not found');

    // 1. Deduplicate IDs within this batch and filter out invalid records
    const uniqueDtosMap = new Map<string, CreateParticipantDto>();
    for (const dto of dtos) {
      const id = String(dto.idNumber || '').trim();
      const name = String(dto.name || '').trim();
      if (id && name) {
        uniqueDtosMap.set(id, dto); // Latest occurrence in batch wins
      }
    }

    const idNumbers = Array.from(uniqueDtosMap.keys());
    if (idNumbers.length === 0) return;
    
    // 2. Find existing participants in bulk
    const existingParticipants = await this.participantRepository.find({
      where: { idNumber: In(idNumbers) },
    });
    
    const existingMap = new Map(existingParticipants.map(p => [p.idNumber, p]));
    const now = new Date();
    const toSave: Participant[] = [];
    
    // 3. Prepare entities for saving
    for (const [idNumber, dto] of uniqueDtosMap) {
      const enrichment = enrichmentData.get(idNumber) || {};
      const existing = existingMap.get(idNumber);
      
      const participant = existing || new Participant();
      
      Object.assign(participant, {
        ...dto,
        ...enrichment,
        name: dto.name, // Preserve original name
        idNumber, // Normalized
        event,
        checkedIn: false,
        checkedInBy: null,
        checkedInAt: null,
        updatedAt: now,
        createdAt: existing ? existing.createdAt : now,
      });
      
      toSave.push(participant);
    }
    
    // 4. Save in chunks
    try {
      await this.participantRepository.save(toSave, { chunk: 200 });
      this.logger.log(`✅ Bulk upserted ${toSave.length} participants (Batch deduplicated from ${dtos.length})`);
    } catch (error) {
      this.logger.error(`❌ DB Bulk save failed: ${error.message}`);
      throw error;
    }
  }
}
