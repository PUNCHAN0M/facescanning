import type { User } from '@prisma/client';
import { Role } from '@prisma/client';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/common/modules/prisma/prisma.service';

import { CreateCameraDto, UpdateCameraDto } from './dto/camera.dto';

@Injectable()
export class CameraService {
  constructor(private prisma: PrismaService) {}

  async create(createCameraDto: CreateCameraDto, currentUser: User) {
    // Check if user has a business
    if (!currentUser.businessId) {
      throw new ForbiddenException(
        'You must be assigned to a business to create cameras',
      );
    }

    // Create camera
    const camera = await this.prisma.camera.create({
      data: {
        ...createCameraDto,
        businessId: currentUser.businessId,
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Don't return password in response
    const { password: _pw, ...cameraWithoutPassword } = camera;
    return cameraWithoutPassword;
  }

  async findAll(currentUser: User) {
    // Admin can only see cameras in their business
    if (!currentUser.businessId) {
      throw new ForbiddenException(
        'You must be assigned to a business to view cameras',
      );
    }

    // Super Admin can see all cameras, Admin sees only their business
    const where =
      currentUser.role === Role.SUPER_ADMIN
        ? {}
        : {
            businessId: currentUser.businessId,
          };

    const cameras = await this.prisma.camera.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't return passwords in response
    return cameras.map(({ password: _pw, ...camera }) => camera);
  }

  async findOne(id: string, currentUser: User) {
    const camera = await this.prisma.camera.findUnique({
      where: { id },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!camera) {
      throw new NotFoundException('Camera not found');
    }

    // Check if user has access to this camera
    if (
      currentUser.role === Role.ADMIN &&
      camera.businessId !== currentUser.businessId
    ) {
      throw new ForbiddenException(
        'You can only access cameras within your business',
      );
    }

    // Don't return password in response
    const { password: _pw2, ...cameraWithoutPassword } = camera;
    return cameraWithoutPassword;
  }

  async update(
    id: string,
    updateCameraDto: UpdateCameraDto,
    currentUser: User,
  ) {
    await this.findOne(id, currentUser);

    const updatedCamera = await this.prisma.camera.update({
      where: { id },
      data: updateCameraDto,
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Don't return password in response
    const { password: _pw3, ...cameraWithoutPassword } = updatedCamera;
    return cameraWithoutPassword;
  }

  async remove(id: string, currentUser: User) {
    await this.findOne(id, currentUser);

    return this.prisma.camera.delete({
      where: { id },
    });
  }

  async findByBusiness(businessId: string, currentUser: User) {
    // Check if user has access to this business
    if (
      currentUser.role === Role.ADMIN &&
      currentUser.businessId !== businessId
    ) {
      throw new ForbiddenException(
        'You can only access cameras within your business',
      );
    }

    const cameras = await this.prisma.camera.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    // Don't return passwords in response
    return cameras.map(({ password: _pw4, ...camera }) => camera);
  }

  async toggleActive(id: string, currentUser: User) {
    const camera = await this.findOne(id, currentUser);

    const updatedCamera = await this.prisma.camera.update({
      where: { id },
      data: {
        isActive: !camera.isActive,
      },
    });

    const { password: _pw5, ...cameraWithoutPassword } = updatedCamera;
    return cameraWithoutPassword;
  }
}
