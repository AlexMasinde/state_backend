import { IsNotEmpty, IsString, IsUUID, IsOptional, IsBoolean } from 'class-validator';

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

  // Optional voter service fields
  @IsOptional()
  @IsString()
  county?: string;

  @IsOptional()
  @IsString()
  constituency?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  pollingStation?: string;

  @IsOptional()
  @IsBoolean()
  registeredVoter?: boolean;

  @IsOptional()
  @IsString()
  tribe?: string;

  @IsOptional()
  @IsString()
  clan?: string;

  @IsOptional()
  @IsString()
  family?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}
