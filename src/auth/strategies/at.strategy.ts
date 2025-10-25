import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWTConstants } from '../constants';

type JwtPayload = { sub: string; email: string; tv: number; jti: string };

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWTConstants.accessSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    // Attach to req.user
    return payload;
  }
}
