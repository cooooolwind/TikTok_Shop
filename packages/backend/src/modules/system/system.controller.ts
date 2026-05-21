import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('系统 /system')
@Controller()
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: '8.1 健康检查' })
  health() {
    return this.systemService.health();
  }

  @Post('upload')
  @ApiOperation({ summary: '8.2 文件上传（通用）' })
  upload() {
    return this.systemService.upload();
  }
}
