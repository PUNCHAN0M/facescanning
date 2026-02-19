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
import { BusinessService } from './business.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';

@Controller('business')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(
    @Body() createBusinessDto: CreateBusinessDto,
    @CurrentUser() user: User,
  ) {
    return this.businessService.create(createBusinessDto, user);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(@CurrentUser() user: User) {
    return this.businessService.findAll(user);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.businessService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
    @CurrentUser() user: User,
  ) {
    return this.businessService.update(id, updateBusinessDto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.businessService.remove(id, user);
  }
}
