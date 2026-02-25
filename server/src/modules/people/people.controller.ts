import type { User } from '@prisma/client';
import { Role } from '@prisma/client';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { multerOptions } from '@/common/config/multer.config';

import {
  AddFaceImageDto,
  CreatePersonDto,
  UpdatePersonDto,
} from './dto/person.dto';
import { PeopleService } from './people.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('people')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post()
  create(@Body() createPersonDto: CreatePersonDto, @CurrentUser() user: User) {
    return this.peopleService.create(createPersonDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.peopleService.findAll(user);
  }

  @Get('business/:businessId')
  findByBusiness(
    @Param('businessId') businessId: string,
    @CurrentUser() user: User,
  ) {
    return this.peopleService.findByBusiness(businessId, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.peopleService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePersonDto: UpdatePersonDto,
    @CurrentUser() user: User,
  ) {
    return this.peopleService.update(id, updatePersonDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.peopleService.deletePerson(id, user);
  }

  @Post(':id/upload-faces')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      ...multerOptions,
      storage: undefined, // Use memory storage for now
    }),
  )
  uploadFaces(
    @Param('id') personId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    return this.peopleService.uploadFaceImages(personId, files, user);
  }

  @Post(':id/face-images')
  addFaceImage(
    @Param('id') personId: string,
    @Body() addFaceImageDto: AddFaceImageDto,
    @CurrentUser() user: User,
  ) {
    return this.peopleService.addFaceImage(personId, addFaceImageDto, user);
  }

  @Delete(':personId/face-images/:imageId')
  removeFaceImage(
    @Param('personId') personId: string,
    @Param('imageId') faceImageId: string,
    @CurrentUser() user: User,
  ) {
    return this.peopleService.removeFaceImage(personId, faceImageId, user);
  }
}
