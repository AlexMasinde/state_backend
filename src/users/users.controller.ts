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
    // Aggressive logging using stdout ensuring no buffering/logger issues
    const logPrefix = `[UsersController] [${new Date().toISOString()}]`;
    console.log(`${logPrefix} 🚀 Admin creating user: ${dto.email}`);
    
    try {
      console.log(`${logPrefix} 🔄 Calling this.usersService.createUser...`);
      if (!this.usersService) {
        console.error(`${logPrefix} 💥 CRITICAL: this.usersService is UNDEFINED`);
        throw new Error('UsersService dependency is undefined');
      }

      console.log(`${logPrefix} 🧐 Type of usersService.createUser: ${typeof this.usersService.createUser}`);
      
      const result = await this.usersService.createUser(dto);
      
      console.log(`${logPrefix} ✅ Admin created user successfully: ${dto.email}`);
      return result;
    } catch (error) {
      console.error(`${logPrefix} 💥 Failed to create user ${dto.email}:`, error);
      console.error(`${logPrefix} 📊 Error stack:`, error.stack);
      
      // Fallback to Logger for consistency if needed
      this.logger.error(`💥 Failed to create user ${dto.email}:`, error);
      
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

