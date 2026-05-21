import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('数据看板 /analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: '7.1 概览数据' })
  overview() {
    return this.analyticsService.overview();
  }

  @Get('trends')
  @ApiOperation({ summary: '7.2 生成趋势' })
  trends() {
    return this.analyticsService.trends();
  }

  @Get('attribution')
  @ApiOperation({ summary: '7.3 因子归因分析' })
  attribution() {
    return this.analyticsService.attribution();
  }

  @Get('duration-distribution')
  @ApiOperation({ summary: '7.4 耗时分布' })
  durationDistribution() {
    return this.analyticsService.durationDistribution();
  }
}
