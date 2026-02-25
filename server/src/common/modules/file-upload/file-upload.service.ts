import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly storageBasePath = './storage';

  // Ensure directory exists
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      this.logger.error('Error creating directory:', error);
      throw error;
    }
  }

  // Get person storage path
  getPersonStoragePath(businessId: string, personId: string): string {
    return path.join(this.storageBasePath, businessId, 'people', personId);
  }

  // Get vector storage path
  getVectorStoragePath(businessId: string): string {
    return path.join(this.storageBasePath, businessId, 'vector');
  }

  // Get detection log storage path
  getDetectionLogStoragePath(
    businessId: string,
    cameraId: string,
    personId: string,
  ): string {
    return path.join(
      this.storageBasePath,
      businessId,
      'logs',
      cameraId,
      personId,
    );
  }

  // Save uploaded file
  async savePersonFaceImage(
    file: Express.Multer.File,
    businessId: string,
    personId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const directory = this.getPersonStoragePath(businessId, personId);
    await this.ensureDirectory(directory);

    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(directory, fileName);

    await fs.writeFile(filePath, file.buffer);

    return {
      filePath: filePath.replace(/\\/g, '/'),
      fileName,
    };
  }
  // Save detection log image
  async saveDetectionLogImage(
    file: Express.Multer.File,
    businessId: string,
    cameraId: string,
    personId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const directory = this.getDetectionLogStoragePath(
      businessId,
      cameraId,
      personId,
    );
    await this.ensureDirectory(directory);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp}${ext}`;
    const filePath = path.join(directory, fileName);

    await fs.writeFile(filePath, file.buffer);

    return {
      filePath: filePath.replace(/\\\\/g, '/'),
      fileName,
    };
  }
  // Delete file
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error('Error deleting file:', error);
    }
  }

  // Delete person directory
  async deletePersonDirectory(
    businessId: string,
    personId: string,
  ): Promise<void> {
    const directory = this.getPersonStoragePath(businessId, personId);
    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch (error) {
      this.logger.error('Error deleting directory:', error);
    }
  }

  // List person face images
  async listPersonFaceImages(
    businessId: string,
    personId: string,
  ): Promise<string[]> {
    const directory = this.getPersonStoragePath(businessId, personId);
    try {
      const files = await fs.readdir(directory);
      return files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      });
    } catch {
      return [];
    }
  }

  // Get file info
  async getFileInfo(filePath: string): Promise<{
    size: number;
    mimeType: string;
  } | null> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };

      return {
        size: stats.size,
        mimeType: mimeTypeMap[ext] ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  // Check if directory exists
  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  // Get directory size
  async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        if (file.isFile()) {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }
}
