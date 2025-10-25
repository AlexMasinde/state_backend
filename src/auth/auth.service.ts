import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SignUpDto, SignInDto, Tokens } from './dto/auth.dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { env } from '../config/env.config';
import { randomUUID } from 'crypto';
import { JWTConstants } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignUpDto): Promise<Tokens> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.users.create(
      dto.email.toLowerCase(),
      dto.name,
      passwordHash,
    );

    const { access_token, refresh } = await this.signTokens(
      user.id,
      user.email,
      user.tokenVersion,
    );
    await this.storeRefreshToken(user.id, refresh);
    return { access_token, refresh };
  }

  async signin(dto: SignInDto): Promise<Tokens> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { access_token, refresh } = await this.signTokens(
      user.id,
      user.email,
      user.tokenVersion,
    );
    await this.storeRefreshToken(user.id, refresh);
    return { access_token, refresh };
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
    const hash = await argon2.hash(rt, { type: argon2.argon2id });
    await this.users.updateRefreshTokenHash(userId, hash);
  }

  private async signTokens(
    userId: string,
    email: string,
    tokenVersion: number,
  ) {
    const atSecret = JWTConstants.accessSecret;
    const rtSecret = JWTConstants.refreshSecret;
    const atExpires = JWTConstants.accessExpires;
    const rtExpires = JWTConstants.refreshExpires;

    // jti helps with audit/forensics if you later persist it
    const atJti = randomUUID();
    const rtJti = randomUUID();

    const payload = { sub: userId, email, tv: tokenVersion };

    const access_token = await this.jwt.signAsync(
      { ...payload, jti: atJti },
      { secret: atSecret, expiresIn: atExpires },
    );

    const refresh = await this.jwt.signAsync(
      { ...payload, jti: rtJti },
      { secret: rtSecret, expiresIn: rtExpires },
    );

    return { access_token, refresh };
  }
}
