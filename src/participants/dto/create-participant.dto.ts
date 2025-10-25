import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateParticipantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  idNumber: string;

  @IsNotEmpty()
  @IsString()
  group: string;

  @IsNotEmpty()
  @IsString()
  origin: string;

  @IsNotEmpty()
  @IsUUID()
  eventId: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;
}
