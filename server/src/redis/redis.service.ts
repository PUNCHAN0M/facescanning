import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly SCAN_SESSION_TTL = 600; // 10 minutes in seconds

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: this.configService.get('REDIS_PORT') || 6379,
      password: this.configService.get('REDIS_PASSWORD'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Generate session key for scan prevention
  private getScanSessionKey(
    businessId: string,
    cameraId: string,
    personId: string,
  ): string {
    return `scan:session:${businessId}:${cameraId}:${personId}`;
  }

  // Check if person has scanned recently (within 10 minutes)
  async hasScanSession(
    businessId: string,
    cameraId: string,
    personId: string,
  ): Promise<boolean> {
    const key = this.getScanSessionKey(businessId, cameraId, personId);
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  // Create scan session (10 minutes TTL)
  async createScanSession(
    businessId: string,
    cameraId: string,
    personId: string,
    data?: any,
  ): Promise<void> {
    const key = this.getScanSessionKey(businessId, cameraId, personId);
    const value = JSON.stringify({
      businessId,
      cameraId,
      personId,
      timestamp: new Date().toISOString(),
      ...data,
    });
    await this.client.setex(key, this.SCAN_SESSION_TTL, value);
  }

  // Get scan session data
  async getScanSession(
    businessId: string,
    cameraId: string,
    personId: string,
  ): Promise<any> {
    const key = this.getScanSessionKey(businessId, cameraId, personId);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Get remaining TTL for scan session
  async getScanSessionTTL(
    businessId: string,
    cameraId: string,
    personId: string,
  ): Promise<number> {
    const key = this.getScanSessionKey(businessId, cameraId, personId);
    return await this.client.ttl(key);
  }

  // Delete scan session (if needed)
  async deleteScanSession(
    businessId: string,
    cameraId: string,
    personId: string,
  ): Promise<void> {
    const key = this.getScanSessionKey(businessId, cameraId, personId);
    await this.client.del(key);
  }

  // Generic Redis operations
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // Get all scan sessions for a business
  async getBusinessScanSessions(businessId: string): Promise<any[]> {
    const pattern = `scan:session:${businessId}:*`;
    const keys = await this.client.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const sessions = await Promise.all(
      keys.map(async (key) => {
        const data = await this.client.get(key);
        const ttl = await this.client.ttl(key);
        return {
          key,
          data: data ? JSON.parse(data) : null,
          ttl,
        };
      }),
    );

    return sessions;
  }
}
