import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { AtGuard } from '../auth/guards/at.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

@Controller('users')
@UseGuards(AtGuard) // Require authentication for all endpoints
@Controller('users')
@UseGuards(AtGuard) // Require authentication for all endpoints
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Get('reports/checkins')
  @UseGuards(AdminGuard)
  async getCheckinsReport(@Query('eventId') eventId: string | undefined, @Res() res: Response) {
    const buffer = await this.usersService.generateCheckinsReport(eventId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="checkins-report.xlsx"',
    );
    res.send(buffer);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @UseGuards(AdminGuard) // Only admins can create users
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
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

