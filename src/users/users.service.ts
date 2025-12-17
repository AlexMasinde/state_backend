import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private emailService: EmailService,
  ) {}

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email, isActive: true } });
  }

  async findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(email: string, name: string, passwordHash: string) {
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');
    const user = this.repo.create({ email, name, passwordHash });
    return this.repo.save(user);
  }

  async updateRefreshTokenHash(
    userId: string,
    refreshTokenHash: string | null,
  ) {
    await this.repo.update({ id: userId }, { refreshTokenHash });
  }

  async incrementTokenVersion(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException();
    user.tokenVersion += 1;
    await this.repo.save(user);
  }

  async findAll() {
    return this.repo.find({
      select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'], // Don't return password
    });
  }

  generateSecurePassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const buffer = randomBytes(length);
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset[buffer[i] % charset.length];
    }
    
    return password;
  }

  async createUser(dto: CreateUserDto) {
    const logPrefix = `[UsersService] [${new Date().toISOString()}]`;
    console.log(`${logPrefix} 🛠️ ENTERING createUser for email: ${dto.email}`);
    
    try {
      console.log(`${logPrefix} 🔍 Check for existing user...`);
      const existing = await this.findByEmail(dto.email);
      if (existing) {
        console.warn(`${logPrefix} ⚠️ Email already in use: ${dto.email}`);
        throw new ConflictException('Email already in use');
      }
      
      // Generate secure random password
      console.log(`${logPrefix} 🔐 Generating secure password...`);
      const generatedPassword = this.generateSecurePassword();
      console.log(`${logPrefix} 🔐 Hashing password with argon2...`);
      
      const passwordHash = await argon2.hash(generatedPassword, {
        type: argon2.argon2id,
      });
      console.log(`${logPrefix} ✅ Password hashed.`);
      
      const user = this.repo.create({
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        role: 'user', // New users default to 'user' role
        isActive: true,
      });
      
      console.log(`${logPrefix} 💾 Saving user to database...`);
      const saved = await this.repo.save(user);
      console.log(`${logPrefix} ✅ User saved to DB with ID: ${saved.id}`);
      
      // Send credentials via email
      console.log(`${logPrefix} 📧 Attempting to send credentials email...`);
      if (!this.emailService) {
         console.error(`${logPrefix} ⚠️ WARNING: this.emailService is UNDEFINED`);
      }

      try {
        await this.emailService.sendUserCredentials(
          dto.email,
          dto.name,
          generatedPassword
        );
        console.log(`${logPrefix} ✅ Credentials email sent successfully`);
      } catch (error) {
        // Log error but don't fail user creation if email fails
        console.error(`${logPrefix} ⚠️ Failed to send email credentials:`, error);
      }
      
      return {
        id: saved.id,
        email: saved.email,
        name: saved.name,
        role: saved.role,
        createdAt: saved.createdAt,
      };

    } catch (err) {
       console.error(`${logPrefix} 💥 UNCAUGHT ERROR in createUser service:`, err);
       throw err; 
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    
    if (dto.email && dto.email !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing) throw new ConflictException('Email already in use');
    }
    
    const updateData: any = { ...dto };
    
    if (dto.password) {
      updateData.passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
      });
      delete updateData.password;
    }
    
    await this.repo.update(id, updateData);
    const updated = await this.findById(id);
    
    // Return without password hash
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      createdAt: updated.createdAt,
    };
  }

  async delete(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (!user.isActive) {
      throw new ConflictException('User is already deactivated');
    }

    user.isActive = false;
    await this.repo.save(user);

    return { message: 'User deactivated successfully' };
  }

  async reactivate(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (user.isActive) {
      throw new ConflictException('User is already active');
    }

    user.isActive = true;
    await this.repo.save(user);

    return { message: 'User reactivated successfully' };
  }
}
