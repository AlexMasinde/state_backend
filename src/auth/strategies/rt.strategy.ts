import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { env } from '../../config/env.config';

type JwtPayload = { sub: string; email: string; tv: number; jti: string };

function extractRefreshTokenFromCookie(req: Request): string | null {
  if (!req || !req.cookies) return null;
  console.log('cookies', req.cookies);
  return req.cookies['rt'] || null;
}

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractRefreshTokenFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(), // fallback
      ]),
      secretOrKey: env.JWT_RT_SECRET,
      passReqToCallback: true,
      ignoreExpiration: false,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const token =
      extractRefreshTokenFromCookie(req) ||
      ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) throw new UnauthorizedException('Missing refresh token');
    // Append raw refresh token for reuse detection
    return { ...payload, refreshToken: token };
  }
}
