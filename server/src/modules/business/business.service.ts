import { Role, User } from '@prisma/client';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/common/modules/prisma/prisma.service';

import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async create(createBusinessDto: CreateBusinessDto, currentUser: User) {
    // Only SUPER_ADMIN can create businesses
    if (currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can create businesses');
    }

    const business = await this.prisma.business.create({
      data: createBusinessDto,
    });

    return business;
  }

  async findAll(currentUser: User) {
    // SUPER_ADMIN can see all businesses
    if (currentUser.role === Role.SUPER_ADMIN) {
      return this.prisma.business.findMany({
        include: {
          _count: {
            select: { users: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // ADMIN can only see their own business
    if (currentUser.businessId) {
      const business = await this.prisma.business.findUnique({
        where: { id: currentUser.businessId },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });
      return business ? [business] : [];
    }

    return [];
  }

  async findOne(id: string, currentUser: User) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // ADMIN can only access their own business
    if (
      currentUser.role === Role.ADMIN &&
      currentUser.businessId !== business.id
    ) {
      throw new ForbiddenException('You can only access your own business');
    }

    return business;
  }

  async update(
    id: string,
    updateBusinessDto: UpdateBusinessDto,
    currentUser: User,
  ) {
    // Only SUPER_ADMIN can update businesses
    if (currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can update businesses');
    }

    const business = await this.prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return this.prisma.business.update({
      where: { id },
      data: updateBusinessDto,
    });
  }

  async remove(id: string, currentUser: User) {
    // Only SUPER_ADMIN can delete businesses
    if (currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can delete businesses');
    }

    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (business._count.users > 0) {
      // Soft delete by setting isActive to false
      return this.prisma.business.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Hard delete if no users
    return this.prisma.business.delete({
      where: { id },
    });
  }
}
