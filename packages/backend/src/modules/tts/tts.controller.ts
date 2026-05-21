import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TtsService } from './tts.service';

@ApiTags('TTS 配音 /tts')
@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Get('voices')
  @ApiOperation({ summary: '5.1 获取可用音色列表' })
  getVoices() {
    return this.ttsService.getVoices();
  }

  @Post('preview')
  @ApiOperation({ summary: '5.2 试听合成' })
  preview() {
    return this.ttsService.preview();
  }
}
