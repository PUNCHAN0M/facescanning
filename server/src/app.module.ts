import { FileUploadModule } from '@/common/modules/file-upload/file-upload.module';
import { PrismaModule } from '@/common/modules/prisma/prisma.module';
import { RedisModule } from '@/common/modules/redis/redis.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { BusinessModule } from '@/modules/business/business.module';
import { CameraModule } from '@/modules/camera/camera.module';
import { DetectionModule } from '@/modules/detection/detection.module';
import { PeopleModule } from '@/modules/people/people.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    FileUploadModule,
    AuthModule,
    BusinessModule,
    PeopleModule,
    CameraModule,
    DetectionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
