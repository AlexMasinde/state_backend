import { IsString, IsNotEmpty, IsEnum, IsDateString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  eventName: string;

  @IsDateString()
  eventDate: string;

  @IsString()
  participants: string;

  @IsEnum(['open', 'in progress', 'closed', 'cancelled'])
  status: 'open' | 'in progress' | 'closed' | 'cancelled';

  @IsString()
  location: string;

  @IsString()
  organizer: string;
}
