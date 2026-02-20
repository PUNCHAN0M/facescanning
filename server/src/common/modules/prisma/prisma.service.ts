import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(this.pool);
    this.prisma = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    await this.pool.end();
  }

  // Proxy all PrismaClient methods
  get user() {
    return this.prisma.user;
  }

  get business() {
    return this.prisma.business;
  }

  get person() {
    return this.prisma.person;
  }

  get faceImage() {
    return this.prisma.faceImage;
  }

  get camera() {
    return this.prisma.camera;
  }

  get detectionLog() {
    return this.prisma.detectionLog;
  }

  get $transaction() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.prisma.$transaction.bind(this.prisma);
  }

  get $connect() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.prisma.$connect.bind(this.prisma);
  }

  get $disconnect() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.prisma.$disconnect.bind(this.prisma);
  }
}
