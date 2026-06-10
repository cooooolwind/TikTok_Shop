import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AiSettingsService } from '../services/ai-settings.service';
import type { TempApiKeyResponse, AiSettingsDto } from '@aigc/shared-types';
import { SetTempApiKeyRequestDto } from '../dto/set-temp-api-key.dto';
import * as CryptoJS from 'crypto-js';

@ApiTags('ai-settings')
@Controller('ai/settings')
export class AiSettingsController {
  constructor(
    private readonly aiSettingsService: AiSettingsService,
    private readonly configService: ConfigService,
  ) {}

  private maskKey(key?: string): string {
    if (!key) return '';
    return key.length > 8 ? `${key.substring(0, 4)}***${key.substring(key.length - 4)}` : '***';
  }

  @Get('temp-key')
  @ApiOperation({ summary: '获取临时 API Key 状态' })
  @ApiResponse({ status: 200, description: '成功获取' })
  getTempKey(): TempApiKeyResponse {
    const settings = this.aiSettingsService.getTempSettings();
    const has_temp_settings = Object.values(settings).some((val) => !!val);
    
    if (!has_temp_settings) {
      return { has_temp_settings: false, settings: {} };
    }
    
    const maskedSettings: AiSettingsDto = {
      volcano_api_key: this.maskKey(settings.volcano_api_key),
      volcano_text_api_key: this.maskKey(settings.volcano_text_api_key),
      volcano_text_endpoint: settings.volcano_text_endpoint || '',
      volcano_image_api_key: this.maskKey(settings.volcano_image_api_key),
      volcano_image_endpoint: settings.volcano_image_endpoint || '',
      volcano_video_api_key: this.maskKey(settings.volcano_video_api_key),
      volcano_video_endpoint: settings.volcano_video_endpoint || '',
      volcano_embedding_api_key: this.maskKey(settings.volcano_embedding_api_key),
      volcano_embedding_endpoint: settings.volcano_embedding_endpoint || '',
    };
      
    return {
      has_temp_settings: true,
      settings: maskedSettings,
    };
  }

  @Post('temp-key')
  @ApiOperation({ summary: '设置或清除临时 API Key 配置' })
  @ApiResponse({ status: 200, description: '成功设置' })
  setTempKey(@Body() dto: SetTempApiKeyRequestDto): TempApiKeyResponse {
    const secret = this.configService.get<string>('VITE_TEMP_KEY_SECRET') || 'your_secret_passphrase';
    
    try {
      const bytes = CryptoJS.AES.decrypt(dto.payload, secret);
      const jsonStr = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!jsonStr) {
        throw new Error('解密失败或数据损坏');
      }
      
      const decryptedData: AiSettingsDto = JSON.parse(jsonStr);
      this.aiSettingsService.setTempSettings(decryptedData);
    } catch (error) {
      throw new BadRequestException('无效的配置负载或解密失败');
    }
    
    return this.getTempKey();
  }
}
