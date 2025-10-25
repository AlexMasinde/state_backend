import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
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
}
