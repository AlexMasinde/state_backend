import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SignUpDto, SignInDto, Tokens } from './dto/auth.dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { env } from '../config/env.config';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignUpDto): Promise<Tokens> {
    const logger = new Logger('AuthService');
    
    try {
      logger.log(`🔐 Starting signup process for email: ${dto.email}`);
      process.stdout.write(`🔐 Starting signup process for email: ${dto.email}\n`);
      
      logger.log('🔐 Step 1: Hashing password with Argon2...');
      process.stdout.write('🔐 Hashing password with Argon2...\n');
      const passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
      });
      logger.log(`✅ Password hashed successfully, hash length: ${passwordHash.length}`);
      process.stdout.write(`✅ Password hash length: ${passwordHash.length}\n`);
      
      logger.log('💾 Step 2: Creating user in database...');
      process.stdout.write('💾 Creating user in database...\n');
      const user = await this.users.create(
        dto.email.toLowerCase(),
        dto.name,
        passwordHash,
      );
      logger.log(`✅ User created successfully: ID=${user.id}, Email=${user.email}`);
      process.stdout.write(`✅ User created: ID=${user.id}\n`);

      logger.log('🎫 Step 3: Signing JWT tokens...');
      process.stdout.write('🎫 Signing JWT tokens...\n');
      const { access_token, refresh } = await this.signTokens(
        user.id,
        user.email,
        user.tokenVersion,
      );
      logger.log('✅ JWT tokens signed successfully');
      process.stdout.write('✅ JWT tokens signed\n');
      
      logger.log('💾 Step 4: Storing refresh token...');
      process.stdout.write('💾 Storing refresh token...\n');
      await this.storeRefreshToken(user.id, refresh);
      
      logger.log('✅ Signup process completed successfully');
      process.stdout.write('✅ Signup process completed successfully\n');
      return { access_token, refresh };
      
    } catch (error) {
      logger.error('💥 Signup process failed:', error);
      process.stdout.write(`💥 Signup failed: ${error.name} - ${error.message}\n`);
      logger.error('📊 Signup error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        email: dto.email
      });
      throw error;
    }
  }

  async signin(dto: SignInDto): Promise<Tokens> {
    const logger = new Logger('AuthService');
    
    try {
      logger.log(`🔍 Starting signin process for email: ${dto.email}`);
      
      // Step 1: Look up user
      logger.log('📋 Step 1: Looking up user in database...');
      const user = await this.users.findByEmail(dto.email.toLowerCase());
      
      if (!user) {
        logger.warn(`❌ User not found for email: ${dto.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      
      logger.log(`✅ User found: ID=${user.id}, Email=${user.email}, Name=${user.name}`);
      logger.log(`📊 User data: tokenVersion=${user.tokenVersion}, hasPasswordHash=${!!user.passwordHash}`);
      
      // Step 2: Verify password
      logger.log('🔐 Step 2: Verifying password with Argon2...');
      logger.log(`🔍 Password hash length: ${user.passwordHash?.length || 'null'}`);
      
      const valid = await argon2.verify(user.passwordHash, dto.password);
      
      if (!valid) {
        logger.warn(`❌ Password verification failed for user: ${user.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      
      logger.log('✅ Password verification successful');
      
      // Step 3: Sign tokens
      logger.log('🎫 Step 3: Signing JWT tokens...');
      logger.log(`🔑 Token data: userId=${user.id}, email=${user.email}, tokenVersion=${user.tokenVersion}`);
      
      const { access_token, refresh } = await this.signTokens(
        user.id,
        user.email,
        user.tokenVersion,
      );
      
      logger.log('✅ JWT tokens signed successfully');
      logger.log(`📏 Access token length: ${access_token?.length || 'null'}`);
      logger.log(`📏 Refresh token length: ${refresh?.length || 'null'}`);
      
      // Step 4: Store refresh token
      logger.log('💾 Step 4: Storing refresh token in database...');
      await this.storeRefreshToken(user.id, refresh);
      
      logger.log('✅ Refresh token stored successfully');
      logger.log('🎉 Signin process completed successfully');
      
      return { access_token, refresh };
      
    } catch (error) {
      logger.error('💥 Signin process failed with error:', error);
      logger.error('📊 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      
      // Re-throw the original error to maintain proper HTTP status codes
      throw error;
    }
  }

  async logout(userId: string) {
    await this.users.updateRefreshTokenHash(userId, null);
  }

  async refreshTokens(
    userId: string,
    tokenVersion: number,
    refreshToken: string,
  ): Promise<Tokens> {
    const user = await this.users.findById(userId);
    if (!user || !user.refreshTokenHash)
      throw new ForbiddenException('Access denied');

    // Reuse detection
    const match = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!match) {
      // Possible theft: revoke all existing refresh tokens (bump version & clear hash)
      await this.users.incrementTokenVersion(userId);
      await this.users.updateRefreshTokenHash(userId, null);
      throw new ForbiddenException('Refresh token mismatch');
    }

    // Rotate
    const { access_token, refresh } = await this.signTokens(
      user.id,
      user.email,
      user.tokenVersion,
    );
    await this.storeRefreshToken(user.id, refresh);
    return { access_token, refresh };
  }

  private async storeRefreshToken(userId: string, rt: string) {
    const logger = new Logger('AuthService');
    
    try {
      logger.log(`💾 Starting refresh token storage for user: ${userId}`);
      logger.log(`📏 Refresh token length: ${rt?.length || 'null'}`);
      
      logger.log('🔐 Hashing refresh token with Argon2...');
      const hash = await argon2.hash(rt, { type: argon2.argon2id });
      logger.log(`✅ Refresh token hashed successfully, hash length: ${hash?.length || 'null'}`);
      
      logger.log('💾 Updating user refresh token hash in database...');
      await this.users.updateRefreshTokenHash(userId, hash);
      logger.log('✅ Refresh token hash stored in database successfully');
      
    } catch (error) {
      logger.error('💥 Refresh token storage failed:', error);
      logger.error('📊 Storage error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        userId,
        tokenLength: rt?.length || 'null'
      });
      throw error;
    }
  }

  private async signTokens(
    userId: string,
    email: string,
    tokenVersion: number,
  ) {
    const logger = new Logger('AuthService');
    
    try {
      logger.log('🔑 Starting token signing process...');
      
      const atSecret = env.JWT_AT_SECRET;
      const rtSecret = env.JWT_RT_SECRET;
      const atExpires = '1d';
      const rtExpires = '7d';

      logger.log(`🔐 JWT secrets status: AT=${!!atSecret}, RT=${!!rtSecret}`);
      logger.log(`📏 Secret lengths: AT=${atSecret?.length || 0}, RT=${rtSecret?.length || 0}`);

      // jti helps with audit/forensics if you later persist it
      const atJti = randomUUID();
      const rtJti = randomUUID();

      const payload = { sub: userId, email, tv: tokenVersion };
      logger.log(`📋 Token payload: ${JSON.stringify(payload)}`);

      logger.log('🎫 Signing access token...');
      const access_token = await this.jwt.signAsync(
        { ...payload, jti: atJti },
        { secret: atSecret, expiresIn: atExpires },
      );
      logger.log('✅ Access token signed successfully');

      logger.log('🎫 Signing refresh token...');
      const refresh = await this.jwt.signAsync(
        { ...payload, jti: rtJti },
        { secret: rtSecret, expiresIn: rtExpires },
      );
      logger.log('✅ Refresh token signed successfully');

      return { access_token, refresh };
      
    } catch (error) {
      logger.error('💥 Token signing failed:', error);
      logger.error('📊 Token signing error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        userId,
        email,
        tokenVersion
      });
      throw error;
    }
  }
}
