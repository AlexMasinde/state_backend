import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participant } from './participant.entity';
import { EventModule } from '../event/event.module';
import { UsersModule } from '../users/users.module';
import { SmsModule } from '../sms/sms.module';
import { VoterModule } from '../voter/voter.module';
import { ParticipantsService } from './participants.service';
import { ParticipantsController } from './participants.controller';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Participant]), EventModule, UsersModule, SmsModule, VoterModule],
  providers: [ParticipantsService, RolesGuard],
  controllers: [ParticipantsController],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
