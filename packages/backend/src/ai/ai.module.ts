import { Module, Global } from '@nestjs/common';
import { VolcanoClientProvider } from './providers/volcano-client.provider';

@Global()
@Module({
  providers: [VolcanoClientProvider],
  exports: [VolcanoClientProvider],
})
export class AiModule {}
