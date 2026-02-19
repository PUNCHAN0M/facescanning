import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DetectionService } from './detection.service';
import { CreateDetectionLogDto, DetectionQueryDto } from './dto/detection.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { multerOptions } from '../common/config/multer.config';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';

@Controller('detection')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post('log')
  @UseInterceptors(
    FileInterceptor('image', {
      ...multerOptions,
      storage: undefined, // Use memory storage
    }),
  )
  create(
    @Body() createDetectionLogDto: CreateDetectionLogDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    return this.detectionService.createDetectionLog(
      createDetectionLogDto,
      file,
      user,
    );
  }

  @Get('logs')
  findAll(@Query() query: DetectionQueryDto, @CurrentUser() user: User) {
    return this.detectionService.findAll(query, user);
  }

  @Get('log/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.detectionService.findOne(id, user);
  }

  @Get('stats/:businessId')
  getStats(@Param('businessId') businessId: string, @CurrentUser() user: User) {
    return this.detectionService.getStats(businessId, user);
  }

  @Get('check-session/:businessId/:cameraId/:personId')
  checkSession(
    @Param('businessId') businessId: string,
    @Param('cameraId') cameraId: string,
    @Param('personId') personId: string,
    @CurrentUser() user: User,
  ) {
    return this.detectionService.checkScanSession(
      businessId,
      cameraId,
      personId,
      user,
    );
  }
}
