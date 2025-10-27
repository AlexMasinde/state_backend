import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { UsersModule } from '../users/users.module';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), UsersModule],
  providers: [EventService, RolesGuard],
  controllers: [EventController],
  exports: [EventService], // export if other modules (like participants) need it
})
export class EventModule {}
