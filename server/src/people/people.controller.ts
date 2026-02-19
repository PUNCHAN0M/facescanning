import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PeopleService } from './people.service';
import {
  CreatePersonDto,
  UpdatePersonDto,
  AddFaceImageDto,
} from './dto/person.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { multerOptions } from '../common/config/multer.config';

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
