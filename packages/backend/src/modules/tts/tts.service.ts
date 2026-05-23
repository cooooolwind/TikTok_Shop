import { Injectable } from '@nestjs/common';

@Injectable()
export class TtsService {
  getVoices() {
    return [];
  }

  preview() {
    return { audio_url: 'stub', duration: 0 };
  }
}
