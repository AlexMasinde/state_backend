import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Injectable()
export class VoterService {
  private readonly logger = new Logger(VoterService.name);
  private readonly frappeApiUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    this.frappeApiUrl = process.env.FRAPPE_API_URL;
    this.apiKey = process.env.FRAPPE_API_KEY;
    this.apiSecret = process.env.FRAPPE_API_SECRET;

    if (!this.frappeApiUrl || !this.apiKey || !this.apiSecret) {
      this.logger.warn('⚠️ Voter service configuration missing. Voter lookups will be skipped.');
    } else {
      this.logger.log('✅ Voter service configuration loaded successfully');
    }
  }

  async checkVoterRegistration(idNumber: string): Promise<any | null> {
    const normalizedIdNumber = String(idNumber).trim();

    try {
      // If voter service not configured, return null
      if (!this.frappeApiUrl || !this.apiKey || !this.apiSecret) {
        this.logger.debug(`Voter service not configured, skipping lookup for ID: ${normalizedIdNumber}`);
        return null;
      }

      // Make request to Frappe API using fetch
      const response = await fetch(
        `${this.frappeApiUrl}/api/method/election_management.api.get_voter_information`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.apiKey}:${this.apiSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id_number: normalizedIdNumber }),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        }
      );

      // Check if request was successful
      if (!response.ok) {
        this.logger.warn(`⚠️ Voter lookup failed for ID: ${normalizedIdNumber}, status: ${response.status}`);
        
        if (response.status === 404) {
          return null; // Voter not found
        } else if (response.status === 401) {
          this.logger.error('🔐 Authentication failed (401)');
          return null; // Don't throw error, just skip lookup
        } else {
          return null; // Any other error, skip lookup
        }
      }

      const data = await response.json();

      // Log the response for debugging
      this.logger.debug('🔍 Voter Service Response:', {
        idNumber: normalizedIdNumber,
        hasData: !!data?.message,
      });

      // For individual lookups, map data to match our project structure
      if (data && data.message && data.message.id_number) {
        const voterData = data.message;
        const adult = voterData.adult_population;
        const registered = voterData.registered_voters;
        
        this.logger.log('✅ Person found in voter system:', {
          idNumber: voterData.id_number,
          hasAdultPopulation: !!adult,
          hasRegisteredVoter: !!registered
        });
        
        // Only process if person is found in registered voters
        if (registered && registered.id_or_passport_number === normalizedIdNumber) {
          this.logger.log('🗳️ Registered voter found:', {
            idNumber: registered.id_or_passport_number,
            name: `${registered.first_name} ${registered.middle_name} ${registered.surname}`.trim()
          });
          
          // Combine first, middle, and surname for registered voters
          const fullName = `${registered.first_name} ${registered.middle_name} ${registered.surname}`.trim();
          
          // Map to participant structure
          return {
            idNumber: registered.id_or_passport_number,
            fullName: fullName,
            county: registered.county,
            constituency: registered.constituency,
            ward: registered.ward,
            pollingStation: registered.polling_center,
            isRegisteredVoter: true,
            gender: registered.sex,
            dateOfBirth: registered.date_of_birth,
            // Cultural data from adult_population
            tribe: adult?.tribe || null,
            clan: adult?.clan || null,
            family: adult?.family || null
          };
        } else {
          this.logger.log('❌ Person not found in voter register for ID:', normalizedIdNumber);
          return null;
        }
      } else {
        // Voter not found in the register
        this.logger.log('❌ Voter not found for ID:', normalizedIdNumber);
        return null;
      }

    } catch (error) {
      this.logger.error('💥 Voter lookup error:', {
        idNumber: normalizedIdNumber,
        error: error.message,
        name: error.name,
        code: error.code
      });
      
      // Handle different types of errors gracefully
      if (error.name === 'AbortError') {
        this.logger.warn('⏰ Request timeout for ID:', normalizedIdNumber);
        return null; // Don't throw, just skip lookup
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.logger.error('🌐 Network error for ID:', normalizedIdNumber);
        return null; // Don't throw, just skip lookup
      } else {
        this.logger.error('❓ Unknown error for ID:', normalizedIdNumber);
        return null; // Don't throw, just skip lookup
      }
    }
  }
}
