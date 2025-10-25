import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { AtGuard } from './guards/at.guard';
import { RtGuard } from './guards/rt.guard';
import { SignInDto, SignUpDto } from './dto/auth.dto';
import { UsersService } from '../users/users.service';
import { env } from '../config/env.config';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private usersService: UsersService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('rt', token, {
      httpOnly: true,
      sameSite: 'lax', // or 'strict'
      secure: false,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
  }

  private clearRefreshCookie(res: Response) {
    const secure = env.COOKIE_SECURE === 'true';
    const domain = env.COOKIE_DOMAIN;
    res.clearCookie('rt', {
      httpOnly: true,
      sameSite: 'none',
      secure: false,
      path: '/',
    });
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh } = await this.auth.signup(dto);
    this.setRefreshCookie(res, refresh);
    return { access_token };
  }

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const logger = new Logger('AuthController');
    
    try {
      logger.log(`🚀 Signin request received for email: ${dto.email}`);
      logger.log(`📊 Request data: email=${dto.email}, passwordLength=${dto.password?.length || 'null'}`);
      
      logger.log('🔄 Calling AuthService.signin...');
      const { access_token, refresh } = await this.auth.signin(dto);
      
      logger.log('✅ AuthService.signin completed successfully');
      logger.log(`📏 Tokens received: accessToken=${access_token?.length || 'null'}, refreshToken=${refresh?.length || 'null'}`);
      
      logger.log('🍪 Setting refresh cookie...');
      this.setRefreshCookie(res, refresh);
      logger.log('✅ Refresh cookie set successfully');
      
      logger.log('🎉 Signin controller completed successfully');
      return { access_token };
      
    } catch (error) {
      logger.error('💥 Signin controller failed:', error);
      logger.error('📊 Controller error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        email: dto.email,
        passwordLength: dto.password?.length || 'null'
      });
      
      // Re-throw to maintain proper HTTP status codes
      throw error;
    }
  }

  @UseGuards(RtGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @GetUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sub, tv, refreshToken } = user;
    const tokens = await this.auth.refreshTokens(sub, tv, refreshToken);
    this.setRefreshCookie(res, tokens.refresh);
    const dbUser = await this.usersService.findById(sub);
    return {
      access_token: tokens.access_token,
      user: dbUser
        ? { userId: dbUser.id, email: dbUser.email, name: dbUser.name }
        : null,
    };
  }

  @UseGuards(AtGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @GetUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user.sub);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @UseGuards(AtGuard)
  @Get('me')
  async me(@GetUser() user: any) {
    const dbUser = await this.usersService.findById(user.sub);
    return { userId: user.sub, email: user.email, name: dbUser?.name || null };
  }
}
