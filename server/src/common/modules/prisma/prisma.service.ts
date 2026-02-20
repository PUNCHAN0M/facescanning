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

  get $transaction(): PrismaClient['$transaction'] {
    return this.prisma.$transaction.bind(
      this.prisma,
    ) as PrismaClient['$transaction'];
  }

  get $connect(): PrismaClient['$connect'] {
    return this.prisma.$connect.bind(this.prisma) as PrismaClient['$connect'];
  }

  get $disconnect(): PrismaClient['$disconnect'] {
    return this.prisma.$disconnect.bind(
      this.prisma,
    ) as PrismaClient['$disconnect'];
  }
}
