import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { PeopleModule } from './people/people.module';
import { CameraModule } from './camera/camera.module';
import { DetectionModule } from './detection/detection.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
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
