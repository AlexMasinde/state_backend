import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AtGuard } from '../auth/guards/at.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

@Controller('users')
@UseGuards(AtGuard) // Require authentication for all endpoints
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private usersService: UsersService) {}

  @Get()
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @UseGuards(AdminGuard) // Only admins can create users
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: CreateUserDto) {
    this.logger.log(`🚀 Admin creating user: ${dto.email}`);
    process.stdout.write(`🚀 Admin creating user: ${dto.email}\n`);
    
    try {
      const result = await this.usersService.createUser(dto);
      
      this.logger.log(`✅ Admin created user successfully: ${dto.email}`);
      process.stdout.write(`✅ Admin created user successfully: ${dto.email}\n`);
      
      return result;
    } catch (error) {
      this.logger.error(`💥 Failed to create user ${dto.email}:`, error);
      this.logger.error('📊 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/reactivate')
  @UseGuards(AdminGuard) // Only admins can reactivate users
  async reactivateUser(@Param('id') id: string) {
    return this.usersService.reactivate(id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard) // Only admins can delete users
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}

