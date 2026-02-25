import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { BadRequestException } from '@nestjs/common';

// Allowed image mime types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// File filter for images only
export const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed',
      ),
      false,
    );
  }
  callback(null, true);
};

// Generate unique filename
export const editFileName = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void,
) => {
  const fileExtName = extname(file.originalname);
  const randomName = uuidv4();
  callback(null, `${randomName}${fileExtName}`);
};

// Storage configuration for person face images
export const personFaceStorage = (businessId: string, personId: string) =>
  diskStorage({
    destination: `./storage/${businessId}/people/${personId}`,
    filename: editFileName,
  });

// Base multer options
export const multerOptions = {
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: imageFileFilter,
};
