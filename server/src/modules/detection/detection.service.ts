import type { User } from '@prisma/client';
import { Role } from '@prisma/client';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { FileUploadService } from '@/common/modules/file-upload/file-upload.service';
import { PrismaService } from '@/common/modules/prisma/prisma.service';
import { RedisService } from '@/common/modules/redis/redis.service';

import { CreateDetectionLogDto, DetectionQueryDto } from './dto/detection.dto';

@Injectable()
export class DetectionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private fileUploadService: FileUploadService,
  ) {}

  async createDetectionLog(
    createDetectionLogDto: CreateDetectionLogDto,
    file: Express.Multer.File,
    currentUser: User,
  ) {
    const { personId, cameraId, confidence } = createDetectionLogDto;

    // Verify person exists and belongs to user's business
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { business: true },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    // Verify camera exists and belongs to user's business
    const camera = await this.prisma.camera.findUnique({
      where: { id: cameraId },
      include: { business: true },
    });

    if (!camera) {
      throw new NotFoundException('Camera not found');
    }

    // Check if business matches
    if (person.businessId !== camera.businessId) {
      throw new BadRequestException(
        'Person and camera must belong to the same business',
      );
    }

    // Check user permission
    if (
      currentUser.role === Role.ADMIN &&
      currentUser.businessId !== person.businessId
    ) {
      throw new ForbiddenException(
        'You can only create detection logs within your business',
      );
    }

    // Check if there's an active scan session (10 minute cooldown)
    const hasSession = await this.redis.hasScanSession(
      person.businessId,
      cameraId,
      personId,
    );

    if (hasSession) {
      const ttl = await this.redis.getScanSessionTTL(
        person.businessId,
        cameraId,
        personId,
      );
      throw new BadRequestException(
        `Person has already scanned recently. Please wait ${Math.ceil(ttl / 60)} minutes before scanning again.`,
      );
    }

    // Save detection log image
    const { filePath } = await this.fileUploadService.saveDetectionLogImage(
      file,
      person.businessId,
      cameraId,
      personId,
    );

    // Create detection log
    const detectionLog = await this.prisma.detectionLog.create({
      data: {
        personId,
        cameraId,
        businessId: person.businessId,
        imagePath: filePath,
        confidence,
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
        camera: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create scan session in Redis (10 minutes TTL)
    await this.redis.createScanSession(person.businessId, cameraId, personId, {
      detectionLogId: detectionLog.id,
      confidence,
    });

    return detectionLog;
  }

  async findAll(query: DetectionQueryDto, currentUser: User) {
    // Build where clause
    const where: {
      businessId?: string;
      personId?: string;
      cameraId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    // Admin can only see logs in their business
    if (currentUser.role === Role.ADMIN) {
      if (!currentUser.businessId) {
        throw new ForbiddenException(
          'You must be assigned to a business to view detection logs',
        );
      }
      where.businessId = currentUser.businessId;
    }

    // Apply filters
    if (query.businessId) {
      if (
        currentUser.role === Role.ADMIN &&
        query.businessId !== currentUser.businessId
      ) {
        throw new ForbiddenException(
          'You can only view logs within your business',
        );
      }
      where.businessId = query.businessId;
    }

    if (query.personId) {
      where.personId = query.personId;
    }

    if (query.cameraId) {
      where.cameraId = query.cameraId;
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    return this.prisma.detectionLog.findMany({
      where,
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
        camera: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 logs
    });
  }

  async findOne(id: string, currentUser: User) {
    const log = await this.prisma.detectionLog.findUnique({
      where: { id },
      include: {
        person: true,
        camera: true,
        business: true,
      },
    });

    if (!log) {
      throw new NotFoundException('Detection log not found');
    }

    // Check permission
    if (
      currentUser.role === Role.ADMIN &&
      log.businessId !== currentUser.businessId
    ) {
      throw new ForbiddenException(
        'You can only view logs within your business',
      );
    }

    return log;
  }

  async getStats(businessId: string, currentUser: User) {
    // Check permission
    if (
      currentUser.role === Role.ADMIN &&
      currentUser.businessId !== businessId
    ) {
      throw new ForbiddenException(
        'You can only view stats within your business',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, uniquePeopleToday] = await Promise.all([
      this.prisma.detectionLog.count({
        where: { businessId },
      }),
      this.prisma.detectionLog.count({
        where: {
          businessId,
          createdAt: { gte: today },
        },
      }),
      this.prisma.detectionLog.findMany({
        where: {
          businessId,
          createdAt: { gte: today },
        },
        select: { personId: true },
        distinct: ['personId'],
      }),
    ]);

    return {
      totalLogs,
      todayLogs,
      uniquePeopleToday: uniquePeopleToday.length,
    };
  }

  async checkScanSession(
    businessId: string,
    cameraId: string,
    personId: string,
    currentUser: User,
  ) {
    // Check permission
    if (
      currentUser.role === Role.ADMIN &&
      currentUser.businessId !== businessId
    ) {
      throw new ForbiddenException('Access denied');
    }

    const hasSession = await this.redis.hasScanSession(
      businessId,
      cameraId,
      personId,
    );

    if (hasSession) {
      const ttl = await this.redis.getScanSessionTTL(
        businessId,
        cameraId,
        personId,
      );
      const session = await this.redis.getScanSession(
        businessId,
        cameraId,
        personId,
      );

      return {
        hasActiveSession: true,
        remainingSeconds: ttl,
        remainingMinutes: Math.ceil(ttl / 60),
        sessionData: session,
      };
    }

    return {
      hasActiveSession: false,
      remainingSeconds: 0,
      remainingMinutes: 0,
    };
  }
}
