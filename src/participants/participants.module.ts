import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participant } from './participant.entity';
import { EventModule } from '../event/event.module';
import { UsersModule } from '../users/users.module';
import { ParticipantsService } from './participants.service';
import { ParticipantsController } from './participants.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Participant]), EventModule, UsersModule],
  providers: [ParticipantsService],
  controllers: [ParticipantsController],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
