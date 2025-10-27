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
    const isProduction = env.NODE_ENV === 'production';
    const secure = isProduction || env.COOKIE_SECURE === 'true';
    const domain = isProduction && env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN : undefined;
    
    res.cookie('rt', token, {
      httpOnly: true,
      sameSite: secure ? 'none' : 'lax', // 'none' requires secure: true for cross-site cookies
      secure: secure,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      ...(domain && { domain }),
    });
  }

  private clearRefreshCookie(res: Response) {
    const isProduction = env.NODE_ENV === 'production';
    const secure = isProduction || env.COOKIE_SECURE === 'true';
    const domain = isProduction && env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN : undefined;
    
    res.clearCookie('rt', {
      httpOnly: true,
      sameSite: secure ? 'none' : 'lax',
      secure: secure,
      path: '/',
      ...(domain && { domain }),
    });
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const logger = new Logger('AuthController');
    
    try {
      logger.log(`🚀 Signup request received for email: ${dto.email}`);
      process.stdout.write(`🚀 Signup request received for email: ${dto.email}\n`);
      logger.log(`📊 Request data: name=${dto.name}, email=${dto.email}, passwordLength=${dto.password?.length || 'null'}`);
      process.stdout.write(`📊 Signup data: name=${dto.name}, email=${dto.email}, passwordLength=${dto.password?.length || 'null'}\n`);
      
      logger.log('🔄 Calling AuthService.signup...');
      process.stdout.write(`🔄 Calling AuthService.signup...\n`);
      
      const { access_token, refresh } = await this.auth.signup(dto);
      
      logger.log('✅ AuthService.signup completed successfully');
      process.stdout.write(`✅ AuthService.signup completed successfully\n`);
      logger.log(`📏 Tokens received: accessToken=${access_token?.length || 'null'}, refreshToken=${refresh?.length || 'null'}`);
      process.stdout.write(`📏 Tokens: accessToken=${access_token?.substring(0, 20)}..., refreshToken=${refresh?.substring(0, 20)}...\n`);
      
      logger.log('🍪 Setting refresh cookie...');
      process.stdout.write(`🍪 Setting refresh cookie...\n`);
      this.setRefreshCookie(res, refresh);
      
      logger.log('✅ Signup controller completed successfully');
      process.stdout.write(`✅ Signup controller completed successfully\n`);
      return { access_token };
      
    } catch (error) {
      logger.error('💥 Signup controller failed:', error);
      process.stdout.write(`💥 Signup error: ${error.name} - ${error.message}\n`);
      logger.error('📊 Controller error details:', {
        errorName: error.name,
        message: error.message,
        stack: error.stack,
        email: dto.email,
        userName: dto.name,
        body: JSON.stringify(dto)
      });
      
      // Re-throw to maintain proper HTTP status codes
      throw error;
    }
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
        ? { userId: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role }
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
    return { 
      userId: user.sub, 
      email: user.email, 
      name: dbUser?.name || null,
      role: dbUser?.role || 'user'
    };
  }
}
