import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ParticipantsService } from '../participants/participants.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const participantsService = app.get(ParticipantsService);

  console.log('--- Debugging Participant Fields ---');

  try {
    // Fetch all participants (limit 1)
    const participants = await participantsService.findAllParticipants();
    
    if (participants.length > 0) {
      const p = participants[0];
      console.log('Sample Participant JSON:', JSON.stringify(p, null, 2));
      console.log('Has phoneNumber:', 'phoneNumber' in p);
      console.log('Has origin:', 'origin' in p);
    } else {
      console.log('No participants found to debug.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
