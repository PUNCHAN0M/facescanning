import { Module } from '@nestjs/common';
import { DetectionService } from './detection.service';
import { DetectionController } from './detection.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [DetectionController],
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
