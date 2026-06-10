import { Module, Global } from '@nestjs/common';
import { VolcanoClientProvider } from './providers/volcano-client.provider';
import { AiSettingsService } from './services/ai-settings.service';
import { AiSettingsController } from './controllers/ai-settings.controller';

@Global()
@Module({
  controllers: [AiSettingsController],
  providers: [AiSettingsService, VolcanoClientProvider],
  exports: [AiSettingsService, VolcanoClientProvider],
})
export class AiModule {}
