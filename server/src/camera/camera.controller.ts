import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CameraService } from './camera.service';
import { CreateCameraDto, UpdateCameraDto } from './dto/camera.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';

@Controller('cameras')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  @Post()
  create(@Body() createCameraDto: CreateCameraDto, @CurrentUser() user: User) {
    return this.cameraService.create(createCameraDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.cameraService.findAll(user);
  }

  @Get('business/:businessId')
  findByBusiness(
    @Param('businessId') businessId: string,
    @CurrentUser() user: User,
  ) {
    return this.cameraService.findByBusiness(businessId, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.cameraService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCameraDto: UpdateCameraDto,
    @CurrentUser() user: User,
  ) {
    return this.cameraService.update(id, updateCameraDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.cameraService.remove(id, user);
  }

  @Patch(':id/toggle')
  toggleActive(@Param('id') id: string, @CurrentUser() user: User) {
    return this.cameraService.toggleActive(id, user);
  }
}
