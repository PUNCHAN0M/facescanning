import { Module } from '@nestjs/common';

import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';

@Module({
  imports: [],
  controllers: [CameraController],
  providers: [CameraService],
  exports: [CameraService],
})
export class CameraModule {}
