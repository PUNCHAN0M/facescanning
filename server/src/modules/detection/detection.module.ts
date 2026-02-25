import { Module } from '@nestjs/common';

import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';

@Module({
  imports: [],
  controllers: [DetectionController],
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
