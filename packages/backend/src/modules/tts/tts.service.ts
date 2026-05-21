import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  getVoices() {
    return [];
  }

  preview() {
    return { audio_url: 'stub', duration: 0 };
  }
}
