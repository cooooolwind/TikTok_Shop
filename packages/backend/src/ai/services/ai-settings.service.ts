import { Injectable, Logger } from '@nestjs/common';
import type { AiSettingsDto } from '@aigc/shared-types';

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);
  private tempSettings: AiSettingsDto = {};

  setTempSettings(settings: AiSettingsDto): void {
    this.tempSettings = settings || {};
    this.logger.log('Temporary AI Settings have been updated.');
  }

  getTempSettings(): AiSettingsDto {
    return this.tempSettings;
  }
}
