import { Global, Module } from '@nestjs/common';
import { FileUploadService } from './services/file-upload.service';

@Global()
@Module({
  providers: [FileUploadService],
  exports: [FileUploadService],
})
export class CommonModule {}
