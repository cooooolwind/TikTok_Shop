import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BgmService } from './bgm.service';

@ApiTags('BGM 配乐 /bgm')
@Controller('bgm')
export class BgmController {
  constructor(private readonly bgmService: BgmService) {}

  @Get()
  @ApiOperation({ summary: '6.1 BGM 列表' })
  findAll() {
    return this.bgmService.findAll();
  }
}
