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
  Query,
} from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { AtGuard } from '../auth/guards/at.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(AtGuard)
@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  create(@Body() dto: CreateParticipantDto) {
    return this.participantsService.create(dto);
  }

  @Post('bulk')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  bulkCreate(@Body() dtos: CreateParticipantDto[]) {
    return this.participantsService.bulkCreate(dtos);
  }

  @Get()
  findAllParticipants() {
    return this.participantsService.findAllParticipants();
  }

  @Get('event/:eventId')
  findAll(@Param('eventId') eventId: string) {
    return this.participantsService.findAll(eventId);
  }

  @Get('event/:eventId/search')
  search(@Param('eventId') eventId: string, @Query('q') searchTerm: string) {
    return this.participantsService.search(eventId, searchTerm);
  }

  @Get('event/:eventId/stats')
  getStats(@Param('eventId') eventId: string) {
    return this.participantsService.getStats(eventId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.participantsService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  update(@Param('id') id: string, @Body() dto: UpdateParticipantDto) {
    return this.participantsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.participantsService.remove(id);
  }

  @Patch(':id/checkin')
  checkIn(@Param('id') id: string, @GetUser() user: any) {
    return this.participantsService.checkIn(id, user.sub);
  }
}
