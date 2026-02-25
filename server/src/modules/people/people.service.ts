import type { User } from '@prisma/client';
import { Role } from '@prisma/client';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { FileUploadService } from '@/common/modules/file-upload/file-upload.service';
import { PrismaService } from '@/common/modules/prisma/prisma.service';

import {
  AddFaceImageDto,
  CreatePersonDto,
  UpdatePersonDto,
} from './dto/person.dto';

@Injectable()
export class PeopleService {
  constructor(
    private prisma: PrismaService,
    private fileUploadService: FileUploadService,
  ) {}

  async create(createPersonDto: CreatePersonDto, currentUser: User) {
    // Check if user has a business
    if (!currentUser.businessId) {
      throw new ForbiddenException(
        'You must be assigned to a business to create people',
      );
    }

    const { faceImageFileNames, ...personData } = createPersonDto;

    // Create person
    const person = await this.prisma.person.create({
      data: {
        ...personData,
        businessId: currentUser.businessId,
        faceImages: faceImageFileNames
          ? {
              create: faceImageFileNames.map((fileName) => ({
                fileName,
                filePath: `/uploads/faces/${currentUser.businessId}/${fileName}`,
              })),
            }
          : undefined,
      },
      include: {
        faceImages: true,
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return person;
  }

  async findAll(currentUser: User) {
    // Admin can only see people in their business
    if (!currentUser.businessId) {
      throw new ForbiddenException(
        'You must be assigned to a business to view people',
      );
    }

    // Super Admin can see all people, Admin sees only their business
    const where =
      currentUser.role === Role.SUPER_ADMIN
        ? {}
        : {
            businessId: currentUser.businessId,
          };

    return this.prisma.person.findMany({
      where,
      include: {
        faceImages: true,
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: User) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        faceImages: true,
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    // Check if user has access to this person
    if (
      currentUser.role === Role.ADMIN &&
      person.businessId !== currentUser.businessId
    ) {
      throw new ForbiddenException(
        'You can only access people within your business',
      );
    }

    return person;
  }

  async update(
    id: string,
    updatePersonDto: UpdatePersonDto,
    currentUser: User,
  ) {
    const person = await this.findOne(id, currentUser);

    const { faceImageFileNames, ...personData } = updatePersonDto;

    // If new face images provided, replace existing ones
    const updateData: {
      faceImages?: {
        deleteMany: object;
        create: { fileName: string; filePath: string }[];
      };
      [key: string]: unknown;
    } = {
      ...personData,
    };

    if (faceImageFileNames) {
      // Delete existing face images and create new ones
      updateData.faceImages = {
        deleteMany: {},
        create: faceImageFileNames.map((fileName) => ({
          fileName,
          filePath: `/uploads/faces/${person.businessId}/${fileName}`,
        })),
      };
    }

    return this.prisma.person.update({
      where: { id },
      data: updateData,
      include: {
        faceImages: true,
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(id: string, currentUser: User) {
    await this.findOne(id, currentUser);

    return this.prisma.person.delete({
      where: { id },
    });
  }

  async addFaceImage(
    personId: string,
    addFaceImageDto: AddFaceImageDto,
    currentUser: User,
  ) {
    await this.findOne(personId, currentUser);

    return this.prisma.faceImage.create({
      data: {
        ...addFaceImageDto,
        personId,
      },
    });
  }

  async removeFaceImage(
    personId: string,
    faceImageId: string,
    currentUser: User,
  ) {
    await this.findOne(personId, currentUser);

    const faceImage = await this.prisma.faceImage.findUnique({
      where: { id: faceImageId },
    });

    if (!faceImage || faceImage.personId !== personId) {
      throw new NotFoundException('Face image not found');
    }

    return this.prisma.faceImage.delete({
      where: { id: faceImageId },
    });
  }

  async findByBusiness(businessId: string, currentUser: User) {
    // Check if user has access to this business
    if (
      currentUser.role === Role.ADMIN &&
      currentUser.businessId !== businessId
    ) {
      throw new ForbiddenException(
        'You can only access people within your business',
      );
    }

    return this.prisma.person.findMany({
      where: { businessId },
      include: {
        faceImages: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadFaceImages(
    personId: string,
    files: Express.Multer.File[],
    currentUser: User,
  ) {
    const person = await this.findOne(personId, currentUser);

    // Ensure storage directory exists
    await this.fileUploadService.ensureDirectory(
      this.fileUploadService.getPersonStoragePath(person.businessId, personId),
    );

    // Save all files and create database records
    const faceImages = await Promise.all(
      files.map(async (file) => {
        const { filePath, fileName } =
          await this.fileUploadService.savePersonFaceImage(
            file,
            person.businessId,
            personId,
          );

        const fileInfo = await this.fileUploadService.getFileInfo(filePath);

        return this.prisma.faceImage.create({
          data: {
            personId,
            fileName,
            filePath,
            fileSize: fileInfo?.size,
            mimeType: fileInfo?.mimeType,
          },
        });
      }),
    );

    return {
      person,
      uploadedImages: faceImages,
    };
  }

  async deletePerson(personId: string, currentUser: User) {
    const person = await this.findOne(personId, currentUser);

    // Delete person directory with all images
    await this.fileUploadService.deletePersonDirectory(
      person.businessId,
      personId,
    );

    // Delete from database (face images will be cascade deleted)
    return this.prisma.person.delete({
      where: { id: personId },
    });
  }
}
