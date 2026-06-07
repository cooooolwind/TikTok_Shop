import type {
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
  CostOverview,
  CostTrend,
  CostBreakdown,
  TemplateCostItem,
  HighCostVideo,
} from '@aigc/shared-types';

export interface AnalyticsSeed {
  totalVideos: number;
  totalScripts: number;
  totalMaterials: number;
  successRate: number;
  avgDuration: number;
  doneCount: number;
  failedCount: number;
  dailyData: { date: string; done: number; failed: number; total: number }[];
  categoryDistribution: { category: string; count: number }[];
  modeDistribution: { mode: string; count: number }[];
  templateUsage: { name: string; count: number; successRate: number }[];
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

const MODEL_PRICE = {
  chat: 0.8, // CNY per 1M tokens (Doubao-pro)
  seedream: 0.2, // CNY per image call
  seedance: 0.3, // CNY per video segment call
};

const TOKENS_PER_SCRIPT = { min: 8000, max: 25000 };

const CATEGORIES = ['美妆', '服饰', '3C数码', '家居', '食品'];
const CATEGORY_CVR_BASE: Record<string, number> = {
  '美妆': 0.023,
  '服饰': 0.019,
  '3C数码': 0.015,
  '家居': 0.012,
  '食品': 0.009,
};

export class AnalyticsMockGenerator {
  private rng: SeededRandom;

  constructor(private readonly seed: AnalyticsSeed) {
    this.rng = new SeededRandom(
      seed.totalVideos * 31 + seed.totalScripts * 17 + seed.totalMaterials * 53,
    );
  }

  private estimateTokens(): {
    chatTokens: number;
    seedanceCalls: number;
    totalChatCost: number;
    totalSeedanceCost: number;
    totalSeedreamCost: number;
  } {
    const avgSegmentsPerVideo = Math.max(3, Math.round(this.seed.totalScripts / Math.max(1, this.seed.doneCount) * 4));
    const chatTokensPerScript = this.rng.int(TOKENS_PER_SCRIPT.min, TOKENS_PER_SCRIPT.max);
    const seedanceCalls = this.seed.doneCount * avgSegmentsPerVideo;
    const chatTokens = this.seed.totalScripts * chatTokensPerScript;
    const totalChatCost = (chatTokens / 1_000_000) * MODEL_PRICE.chat;
    const totalSeedanceCost = seedanceCalls * MODEL_PRICE.seedance;
    const totalSeedreamCost = seedanceCalls * MODEL_PRICE.seedream;

    return { chatTokens, seedanceCalls, totalChatCost, totalSeedanceCost, totalSeedreamCost };
  }

  // ===== 成本 =====

  generateCostOverview(): CostOverview {
    const { totalChatCost, totalSeedanceCost, totalSeedreamCost } = this.estimateTokens();
    const totalCost = totalChatCost + totalSeedanceCost + totalSeedreamCost;
    const avgCostPerVideo = this.seed.doneCount > 0 ? totalCost / this.seed.doneCount : 0;
    const days = this.seed.dailyData.length || 30;
    const dailyAvgCost = totalCost / Math.max(1, days);

    return {
      total_cost: Math.round(totalCost * 100) / 100,
      avg_cost_per_video: Math.round(avgCostPerVideo * 100) / 100,
      daily_avg_cost: Math.round(dailyAvgCost * 100) / 100,
      period_comparison: {
        cost_change: this.rng.range(-15, 15),
        avg_cost_change: this.rng.range(-10, 5),
      },
    };
  }

  generateCostTrends(dates: string[]): CostTrend[] {
    const { totalChatCost, totalSeedanceCost, totalSeedreamCost } = this.estimateTokens();
    const days = dates.length || 30;
    const dailyChat = totalChatCost / days;
    const dailySeedance = totalSeedanceCost / days;
    const dailySeedream = totalSeedreamCost / days;

    return dates.map((date) => {
      const noise = () => this.rng.range(0.7, 1.3);
      const script = Math.round(dailyChat * noise() * 100) / 100;
      const firstFrame = Math.round(dailySeedream * noise() * 100) / 100;
      const video = Math.round(dailySeedance * noise() * 100) / 100;
      return {
        date,
        script_cost: script,
        first_frame_cost: firstFrame,
        video_cost: video,
        total_cost: Math.round((script + firstFrame + video) * 100) / 100,
      };
    });
  }

  generateCostBreakdown(): CostBreakdown[] {
    const { totalChatCost, totalSeedanceCost, totalSeedreamCost, chatTokens } = this.estimateTokens();
    const totalCost = totalChatCost + totalSeedanceCost + totalSeedreamCost;
    if (totalCost === 0) return [];

    return [
      {
        model: 'ChatCompletion',
        usage: '剧本生成',
        cost: Math.round(totalChatCost * 100) / 100,
        tokens: chatTokens,
        percentage: Math.round((totalChatCost / totalCost) * 1000) / 10,
      },
      {
        model: 'Seedream',
        usage: '首帧图片生成',
        cost: Math.round(totalSeedreamCost * 100) / 100,
        tokens: 0,
        percentage: Math.round((totalSeedreamCost / totalCost) * 1000) / 10,
      },
      {
        model: 'Seedance',
        usage: '视频片段生成',
        cost: Math.round(totalSeedanceCost * 100) / 100,
        tokens: 0,
        percentage: Math.round((totalSeedanceCost / totalCost) * 1000) / 10,
      },
    ];
  }

  generateTemplateCost(templateUsage: { name: string; count: number; successRate: number }[]): TemplateCostItem[] {
    const { totalChatCost, totalSeedanceCost, totalSeedreamCost } = this.estimateTokens();
    const totalCost = totalChatCost + totalSeedanceCost + totalSeedreamCost;
    const avgCostPerUnit = this.seed.totalVideos > 0 ? totalCost / this.seed.totalVideos : 0;

    return templateUsage.slice(0, 10).map((t) => ({
      template_name: t.name,
      usage_count: t.count,
      avg_cost: Math.round(avgCostPerUnit * this.rng.range(0.8, 1.3) * 100) / 100,
      success_rate: t.successRate,
    }));
  }

  generateHighCostVideos(): HighCostVideo[] {
    if (this.seed.doneCount === 0) return [];
    const avgCost = this.seed.doneCount > 0
      ? this.estimateTokens().totalChatCost / this.seed.doneCount
      : 0.5;

    return Array.from({ length: Math.min(10, this.seed.doneCount) }, (_, i) => ({
      video_id: `mock_video_${i}`,
      script_name: CATEGORIES[i % CATEGORIES.length] + '推广视频',
      total_cost: Math.round(avgCost * this.rng.range(1.5, 3.0) * 100) / 100,
      duration: this.rng.int(8, 60),
    }));
  }

  // ===== 转化 =====

  generateConversionOverview(): ConversionOverview {
    if (this.seed.totalVideos === 0) {
      return { total_exposure: 0, ctr: 0, cvr: 0, gmv: 0, roi: 0, period_comparison: { gmv_change: 0, roi_change: 0 } };
    }
    const avgExposurePerVideo = this.rng.int(500, 5000);
    const totalExposure = this.seed.totalVideos * avgExposurePerVideo;
    const ctr = this.rng.range(0.02, 0.05);
    const clicks = totalExposure * ctr;
    const cvr = this.rng.range(0.01, 0.03);
    const orders = clicks * cvr;
    const avgPrice = this.rng.int(80, 300);
    const gmv = orders * avgPrice;
    const totalCost = this.estimateTokens().totalChatCost + this.estimateTokens().totalSeedanceCost + this.estimateTokens().totalSeedreamCost;
    const roi = totalCost > 0 ? gmv / totalCost : 0;

    return {
      total_exposure: Math.round(totalExposure),
      ctr: Math.round(ctr * 10000) / 10000,
      cvr: Math.round(cvr * 10000) / 10000,
      gmv: Math.round(gmv),
      roi: Math.round(roi * 100) / 100,
      period_comparison: {
        gmv_change: this.rng.range(-10, 25),
        roi_change: this.rng.range(-5, 15),
      },
    };
  }

  generateConversionTrends(dates: string[]): ConversionTrend[] {
    if (this.seed.totalVideos === 0) {
      return dates.map(date => ({ date, exposure: 0, click: 0, order: 0, gmv: 0 }));
    }
    return dates.map((date) => {
      const exposure = this.rng.int(3000, 20000);
      const ctr = this.rng.range(0.02, 0.05);
      const click = Math.round(exposure * ctr);
      const cvr = this.rng.range(0.01, 0.03);
      const order = Math.round(click * cvr);
      const gmv = Math.round(order * this.rng.int(80, 300));
      return { date, exposure, click, order, gmv };
    });
  }

  generateCategoryConversion(): CategoryConversion[] {
    if (this.seed.totalVideos === 0) return [];
    return CATEGORIES.map((cat) => {
      const videoCount = this.rng.int(5, Math.max(6, Math.ceil(this.seed.totalVideos / 3)));
      const ctr = this.rng.range(0.02, 0.05);
      const cvr = CATEGORY_CVR_BASE[cat] * this.rng.range(0.8, 1.2);
      const avgPrice = this.rng.int(80, 300);
      const gmv = Math.round(videoCount * 3000 * ctr * cvr * avgPrice);
      const costPerVideo = this.rng.range(0.5, 2.0);
      const totalCost = videoCount * costPerVideo;
      const roi = totalCost > 0 ? Math.round((gmv / totalCost) * 100) / 100 : 0;

      return {
        category: cat,
        video_count: videoCount,
        ctr: Math.round(ctr * 10000) / 10000,
        cvr: Math.round(cvr * 10000) / 10000,
        gmv,
        roi,
      };
    });
  }

  generateFunnel(): FunnelStage[] {
    if (this.seed.totalVideos === 0) return [];
    const exposure = this.rng.int(80000, 200000);
    const ctr = 0.032;
    const click = Math.round(exposure * ctr);
    const engageRate = this.rng.range(0.3, 0.5);
    const engaged = Math.round(click * engageRate);
    const cvr = 0.018;
    const order = Math.round(engaged * cvr);

    return [
      { stage: '曝光', count: exposure, rate: 100 },
      { stage: '点击', count: click, rate: Math.round(ctr * 10000) / 100 },
      { stage: '深度观看', count: engaged, rate: Math.round(engageRate * 10000) / 100 },
      { stage: '下单', count: order, rate: Math.round(cvr * 10000) / 100 },
    ];
  }

  generateDurationCVR(): DurationCVR[] {
    if (this.seed.totalVideos === 0) return [];
    return [
      { range: '< 9s', video_count: this.rng.int(5, 20), cvr: Math.round(this.rng.range(0.012, 0.018) * 10000) / 10000 },
      { range: '9-15s', video_count: this.rng.int(20, 60), cvr: Math.round(this.rng.range(0.02, 0.028) * 10000) / 10000 },
      { range: '15-30s', video_count: this.rng.int(10, 30), cvr: Math.round(this.rng.range(0.015, 0.022) * 10000) / 10000 },
      { range: '> 30s', video_count: this.rng.int(2, 10), cvr: Math.round(this.rng.range(0.005, 0.01) * 10000) / 10000 },
    ];
  }

  // ===== 策略 =====

  generateStrategyFactors(): StrategyFactor[] {
    if (this.seed.totalVideos === 0) return [];
    return [
      { type: 'pain_point', label: '痛点提问', icon: 'question', ctr: Number((this.rng.range(3.2, 4.2)).toFixed(2)), usage_pct: this.rng.int(25, 35) },
      { type: 'comparison', label: '效果对比', icon: 'swap', ctr: Number((this.rng.range(3.0, 3.8)).toFixed(2)), usage_pct: this.rng.int(20, 30) },
      { type: 'suspense', label: '悬念开场', icon: 'eye', ctr: Number((this.rng.range(2.8, 3.5)).toFixed(2)), usage_pct: this.rng.int(15, 22) },
      { type: 'direct_show', label: '直接展示', icon: 'play-circle', ctr: Number((this.rng.range(2.0, 2.8)).toFixed(2)), usage_pct: this.rng.int(18, 28) },
      { type: 'tutorial', label: '教程演示', icon: 'book', ctr: Number((this.rng.range(2.5, 3.2)).toFixed(2)), usage_pct: this.rng.int(8, 15) },
      { type: 'social_proof', label: '用户见证', icon: 'team', ctr: Number((this.rng.range(2.8, 3.6)).toFixed(2)), usage_pct: this.rng.int(5, 12) },
    ];
  }

  generateStrategyFormula(): StrategyFormula {
    if (this.seed.totalVideos === 0) return { features: [] };
    return {
      features: [
        { name: '快节奏剪辑 (<2s/镜)', score: 92, description: '提升完播率的关键因素' },
        { name: '全程字幕', score: 88, description: '提高信息传达效率' },
        { name: '痛点Hook开场', score: 95, description: '3秒内抓住注意力' },
        { name: '15秒以内', score: 85, description: '最优转化时长区间' },
        { name: '模特出镜', score: 78, description: '增强产品信任感' },
        { name: 'CTA结尾', score: 72, description: '明确引导下单' },
      ],
    };
  }

  generateABComparison(): ABComparison {
    if (this.seed.totalVideos === 0) return { version_a_name: '', version_b_name: '', metrics: [] };
    return {
      version_a_name: '痛点Hook版',
      version_b_name: '效果对比版',
      metrics: [
        { name: '点击率(CTR)', a: Number((3.8).toFixed(1)), b: Number((3.5).toFixed(1)), unit: '%' },
        { name: '完播率', a: Number((68).toFixed(1)), b: Number((72).toFixed(1)), unit: '%' },
        { name: '转化率(CVR)', a: Number((2.3).toFixed(1)), b: Number((1.9).toFixed(1)), unit: '%' },
        { name: '分享率', a: Number((1.8).toFixed(1)), b: Number((2.4).toFixed(1)), unit: '%' },
      ],
    };
  }

  generateRhythmCompleteness(): RhythmCompleteness[] {
    if (this.seed.totalVideos === 0) return [];
    return [
      { rhythm: '快切(<2s)', completion_rate: Math.round(this.rng.range(65, 78)) },
      { rhythm: '中速(2-4s)', completion_rate: Math.round(this.rng.range(55, 68)) },
      { rhythm: '慢切(>4s)', completion_rate: Math.round(this.rng.range(35, 48)) },
    ];
  }

  generateSubtitleStrategy(): SubtitleStrategy[] {
    if (this.seed.totalVideos === 0) return [];
    return [
      { strategy: '全程字幕', cvr: Number((this.rng.range(1.8, 2.4)).toFixed(1)) },
      { strategy: '关键字幕', cvr: Number((this.rng.range(1.5, 2.0)).toFixed(1)) },
      { strategy: '无字幕', cvr: Number((this.rng.range(0.8, 1.4)).toFixed(1)) },
    ];
  }

  generateCTAPosition(): CTAPosition[] {
    if (this.seed.totalVideos === 0) return [];
    return [
      { position: '视频末尾', ctr: Number((this.rng.range(3.2, 4.2)).toFixed(1)) },
      { position: '视频中部', ctr: Number((this.rng.range(2.5, 3.5)).toFixed(1)) },
      { position: '视频开头', ctr: Number((this.rng.range(2.0, 2.8)).toFixed(1)) },
    ];
  }

  generateBGMEffect(): BGMEffect[] {
    if (this.seed.totalVideos === 0) return [];
    return [
      { style: '快节奏', completion_rate: Math.round(this.rng.range(62, 75)) },
      { style: '舒缓', completion_rate: Math.round(this.rng.range(50, 62)) },
      { style: '激昂', completion_rate: Math.round(this.rng.range(44, 55)) },
      { style: '无BGM', completion_rate: Math.round(this.rng.range(30, 42)) },
    ];
  }

  // ===== 日期工具 =====

  static generateDateRange(startDate: string, endDate: string, granularity: 'day' | 'week' | 'month' = 'day'): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      if (granularity === 'day') current.setDate(current.getDate() + 1);
      else if (granularity === 'week') current.setDate(current.getDate() + 7);
      else current.setMonth(current.getMonth() + 1);
    }

    return dates;
  }
}
