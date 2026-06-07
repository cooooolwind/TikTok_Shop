import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import type {
  OverviewData,
  TrendData,
  AttributionData,
  DurationDistribution,
  CostOverview,
  CostTrend,
  CostBreakdown,
  TemplateCostItem,
  HighCostVideo,
  ConversionOverview,
  ConversionTrend,
  CategoryConversion,
  FunnelStage,
  DurationCVR,
  StrategyFactor,
  StrategyFormula,
  ABComparison,
  RhythmCompleteness,
  SubtitleStrategy,
  CTAPosition,
  BGMEffect,
  HomeStats,
  AnalyticsQuery,
  TrendsQuery,
} from '@aigc/shared-types';

import { MockProxyInterceptor } from './mock-proxy.interceptor';

@ApiTags('数据看板 /analytics')
@Controller('analytics')
@UseInterceptors(MockProxyInterceptor)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ===== 概览 =====

  @Get('overview')
  @ApiOperation({ summary: '概览数据' })
  overview(@Query() query: AnalyticsQuery): Promise<OverviewData> {
    return this.analyticsService.getOverview(query);
  }

  // ===== 趋势 =====

  @Get('trends')
  @ApiOperation({ summary: '生成趋势' })
  trends(@Query() query: TrendsQuery): Promise<TrendData[]> {
    return this.analyticsService.getTrends(query);
  }

  // ===== 归因 =====

  @Get('attribution')
  @ApiOperation({ summary: '因子归因分析' })
  attribution(): Promise<AttributionData[]> {
    return this.analyticsService.getAttribution();
  }

  // ===== 时长分布 =====

  @Get('duration-distribution')
  @ApiOperation({ summary: '耗时分布' })
  durationDistribution(@Query() query: AnalyticsQuery): Promise<DurationDistribution[]> {
    return this.analyticsService.getDurationDistribution(query);
  }

  // ===== 素材分布 =====

  @Get('material-distribution')
  @ApiOperation({ summary: '素材分布' })
  materialDistribution() {
    return this.analyticsService.getMaterialDistribution();
  }

  // ===== 成本 =====

  @Get('cost/overview')
  @ApiOperation({ summary: '成本概览' })
  costOverview(@Query() query: AnalyticsQuery): Promise<CostOverview> {
    return this.analyticsService.getCostOverview(query);
  }

  @Get('cost/trends')
  @ApiOperation({ summary: '成本趋势' })
  @ApiQuery({ name: 'granularity', enum: ['day', 'week', 'month'] })
  costTrends(@Query() query: TrendsQuery): Promise<CostTrend[]> {
    return this.analyticsService.getCostTrends(query);
  }

  @Get('cost/breakdown')
  @ApiOperation({ summary: '成本模型拆解' })
  costBreakdown(@Query() query: AnalyticsQuery): Promise<CostBreakdown[]> {
    return this.analyticsService.getCostBreakdown(query);
  }

  @Get('cost/by-template')
  @ApiOperation({ summary: '模板成本对比' })
  templateCost(@Query() query: AnalyticsQuery): Promise<TemplateCostItem[]> {
    return this.analyticsService.getTemplateCost(query);
  }

  @Get('cost/high-cost-videos')
  @ApiOperation({ summary: '高成本视频 Top10' })
  highCostVideos(@Query() query: AnalyticsQuery): Promise<HighCostVideo[]> {
    return this.analyticsService.getHighCostVideos(query);
  }

  // ===== 转化 =====

  @Get('conversion/overview')
  @ApiOperation({ summary: '转化概览' })
  conversionOverview(@Query() query: AnalyticsQuery): Promise<ConversionOverview> {
    return this.analyticsService.getConversionOverview(query);
  }

  @Get('conversion/trends')
  @ApiOperation({ summary: '转化趋势' })
  @ApiQuery({ name: 'granularity', enum: ['day', 'week', 'month'] })
  conversionTrends(@Query() query: TrendsQuery): Promise<ConversionTrend[]> {
    return this.analyticsService.getConversionTrends(query);
  }

  @Get('conversion/by-category')
  @ApiOperation({ summary: '品类转化对比' })
  categoryConversion(@Query() query: AnalyticsQuery): Promise<CategoryConversion[]> {
    return this.analyticsService.getCategoryConversion(query);
  }

  @Get('conversion/funnel')
  @ApiOperation({ summary: '转化漏斗' })
  funnel(@Query() query: AnalyticsQuery): Promise<FunnelStage[]> {
    return this.analyticsService.getFunnel(query);
  }

  @Get('conversion/duration-cvr')
  @ApiOperation({ summary: '时长与转化率' })
  durationCVR(@Query() query: AnalyticsQuery): Promise<DurationCVR[]> {
    return this.analyticsService.getDurationCVR(query);
  }

  // ===== 策略 =====

  @Get('strategy/factors')
  @ApiOperation({ summary: '策略因子效果' })
  strategyFactors(@Query() query: AnalyticsQuery): Promise<StrategyFactor[]> {
    return this.analyticsService.getStrategyFactors(query);
  }

  @Get('strategy/formula')
  @ApiOperation({ summary: '黄金配方' })
  strategyFormula(@Query() query: AnalyticsQuery): Promise<StrategyFormula> {
    return this.analyticsService.getStrategyFormula(query);
  }

  @Get('strategy/ab-comparison')
  @ApiOperation({ summary: 'A/B 版本对比' })
  abComparison(@Query() query: AnalyticsQuery): Promise<ABComparison> {
    return this.analyticsService.getABComparison(query);
  }

  @Get('strategy/rhythm')
  @ApiOperation({ summary: '节奏与完播率' })
  rhythmCompleteness(@Query() query: AnalyticsQuery): Promise<RhythmCompleteness[]> {
    return this.analyticsService.getRhythmCompleteness(query);
  }

  @Get('strategy/subtitle')
  @ApiOperation({ summary: '字幕策略效果' })
  subtitleStrategy(@Query() query: AnalyticsQuery): Promise<SubtitleStrategy[]> {
    return this.analyticsService.getSubtitleStrategy(query);
  }

  @Get('strategy/cta')
  @ApiOperation({ summary: 'CTA 位置效果' })
  ctaPosition(@Query() query: AnalyticsQuery): Promise<CTAPosition[]> {
    return this.analyticsService.getCTAPosition(query);
  }

  @Get('strategy/bgm')
  @ApiOperation({ summary: 'BGM 风格效果' })
  bgmEffect(@Query() query: AnalyticsQuery): Promise<BGMEffect[]> {
    return this.analyticsService.getBGMEffect(query);
  }

  // ===== Home =====

  @Get('home-stats')
  @ApiOperation({ summary: '首页统计数据' })
  homeStats(): Promise<HomeStats> {
    return this.analyticsService.getHomeStats();
  }
}
