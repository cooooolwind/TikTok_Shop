import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenerationTask } from '../generation/entities/generation-task.entity';
import { Material } from '../materials/entities/material.entity';
import { Script } from '../scripts/entities/script.entity';
import { Template } from '../templates/entities/template.entity';
import { AnalyticsMockGenerator, type AnalyticsSeed } from './mock-generator';
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
  TrendsQuery,
  AnalyticsQuery,
} from '@aigc/shared-types';

@Injectable()
export class AnalyticsService {
  private seedCache = new Map<string, Promise<AnalyticsSeed>>();
  private mockGenerator: AnalyticsMockGenerator | null = null;

  constructor(
    @InjectRepository(GenerationTask)
    private readonly tasksRepository: Repository<GenerationTask>,
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(Script)
    private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Template)
    private readonly templatesRepository: Repository<Template>,
  ) {}

  private buildSeed(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month' = 'day',
  ): Promise<AnalyticsSeed> {
    const key = `${startDate}|${endDate}|${granularity}`;
    if (!this.seedCache.has(key)) {
      this.seedCache.set(key, this.doBuildSeed(startDate, endDate, granularity));
    }
    return this.seedCache.get(key)!;
  }

  private async doBuildSeed(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month' = 'day',
  ): Promise<AnalyticsSeed> {
    const tasks = await this.tasksRepository
      .createQueryBuilder('task')
      .where('task.created_at >= :start', { start: new Date(`${startDate}T00:00:00.000Z`) })
      .andWhere('task.created_at <= :end', { end: new Date(`${endDate}T23:59:59.999Z`) })
      .getMany();

    const isMock = process.env.MOCK_DASHBOARD !== 'false';
    const BASE_TOTAL_VIDEOS = isMock ? 125 : 0;
    const BASE_DONE_COUNT = isMock ? 118 : 0;
    const BASE_FAILED_COUNT = isMock ? 7 : 0;
    const BASE_MATERIALS = isMock ? 200 : 0;
    const BASE_SCRIPTS = isMock ? 150 : 0;

    const materials = await this.materialsRepository.count() + BASE_MATERIALS;
    const scripts = await this.scriptsRepository.count() + BASE_SCRIPTS;

    const doneCount = tasks.filter((t) => t.status === 'done').length + BASE_DONE_COUNT;
    const failedCount = tasks.filter((t) => t.status === 'failed').length + BASE_FAILED_COUNT;
    const totalVideos = tasks.length + BASE_TOTAL_VIDEOS;
    const successRate = totalVideos > 0 ? doneCount / totalVideos : 0;

    const doneTasks = tasks.filter((t) => t.status === 'done' && t.completedAt);
    const mockAvgDuration = 24.5;
    const totalRealDuration = doneTasks.reduce(
      (sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()) / 1000,
      0,
    );
    const avgDuration =
      totalVideos > 0
        ? (totalRealDuration + (BASE_DONE_COUNT * mockAvgDuration)) / doneCount
        : 0;

    const dates = AnalyticsMockGenerator.generateDateRange(startDate, endDate, granularity);
    const dailyData = dates.map((date) => {
      const dayTasks = tasks.filter(
        (t) => t.createdAt.toISOString().split('T')[0] === date,
      );
      const seedVal = date.split('-').reduce((a, b) => a + parseInt(b, 10), 0);
      const mockTotal = isMock ? 3 + (seedVal % 3) : 0;
      const mockDone = isMock ? Math.floor(mockTotal * 0.94) : 0;
      const mockFailed = mockTotal - mockDone;
      return {
        date,
        done: dayTasks.filter((t) => t.status === 'done').length + mockDone,
        failed: dayTasks.filter((t) => t.status === 'failed').length + mockFailed,
        total: dayTasks.length + mockTotal,
      };
    });

    const categoryDistribution = [
      { category: 'product', count: await this.materialsRepository.count({ where: { category: 'product' } }) + Math.floor(BASE_MATERIALS * 0.4) },
      { category: 'scene', count: await this.materialsRepository.count({ where: { category: 'scene' } }) + Math.floor(BASE_MATERIALS * 0.3) },
      { category: 'model', count: await this.materialsRepository.count({ where: { category: 'model' } }) + Math.floor(BASE_MATERIALS * 0.2) },
      { category: 'other', count: await this.materialsRepository.count({ where: { category: 'other' } }) + Math.floor(BASE_MATERIALS * 0.1) },
    ].filter((c) => c.count > 0);

    const modeCounts = await this.scriptsRepository
      .createQueryBuilder('script')
      .select('script.mode', 'mode')
      .addSelect('COUNT(*)', 'count')
      .groupBy('script.mode')
      .getRawMany<{ mode: string; count: string }>();
    const modeDistribution = modeCounts.map((m) => ({ mode: m.mode, count: Number(m.count) }));

    const templateRows = await this.scriptsRepository
      .createQueryBuilder('script')
      .select('script.templateId', 'templateId')
      .addSelect('COUNT(*)', 'count')
      .where('script.templateId IS NOT NULL')
      .groupBy('script.templateId')
      .getRawMany<{ templateId: string; count: string }>();
    const templateIds = templateRows.map((r) => r.templateId);
    const templates = templateIds.length > 0
      ? await this.templatesRepository.createQueryBuilder('t').where('t.id IN (:...ids)', { ids: templateIds }).getMany()
      : [];
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const templateUsage = templateRows.map((r) => {
      const tpl = templateMap.get(r.templateId);
      const count = Number(r.count);
      return {
        name: tpl?.name ?? r.templateId,
        count,
        successRate: Math.min(1, 0.7 + Math.random() * 0.25),
      };
    });

    return {
      totalVideos,
      totalScripts: scripts,
      totalMaterials: materials,
      successRate,
      avgDuration,
      doneCount,
      failedCount,
      dailyData,
      categoryDistribution: categoryDistribution.map((c) => ({ category: c.category, count: c.count })),
      modeDistribution,
      templateUsage,
    };
  }

  private async getMockGenerator(
    startDate: string,
    endDate: string,
  ): Promise<AnalyticsMockGenerator> {
    const seed = await this.buildSeed(startDate, endDate);
    this.mockGenerator = new AnalyticsMockGenerator(seed);
    return this.mockGenerator;
  }

  // ===== 概览 =====

  async getOverview(query: AnalyticsQuery): Promise<OverviewData> {
    const seed = await this.buildSeed(query.start_date, query.end_date);
    const prevStart = this.getPrevPeriodStart(query.start_date, query.end_date);
    const prevSeed = await this.buildSeed(prevStart, query.start_date);

    const prevTotal = prevSeed.totalVideos;
    const generatedChange =
      prevTotal > 0
        ? Math.round(((seed.totalVideos - prevTotal) / prevTotal) * 100)
        : 0;
    const successRateChange =
      prevSeed.successRate > 0
        ? Math.round((seed.successRate - prevSeed.successRate) * 100)
        : 0;

    return {
      total_generated: seed.totalVideos,
      success_rate: Math.round(seed.successRate * 100) / 100,
      avg_generation_time: Math.round(seed.avgDuration * 100) / 100,
      total_materials: seed.totalMaterials,
      total_scripts: seed.totalScripts,
      period_comparison: { generated_change: generatedChange, success_rate_change: successRateChange },
    };
  }

  // ===== 趋势 =====

  async getTrends(query: TrendsQuery): Promise<TrendData[]> {
    const seed = await this.buildSeed(query.start_date, query.end_date, query.granularity);
    return seed.dailyData.map((d) => ({
      date: d.date,
      generated_count: d.total,
      success_count: d.done,
      failed_count: d.failed,
      avg_duration: Math.round(seed.avgDuration * 100) / 100,
    }));
  }

  // ===== 归因 =====

  async getAttribution(): Promise<AttributionData[]> {
    const templates = await this.templatesRepository.find();
    if (templates.length === 0) return [];

    const usageRows = await this.scriptsRepository
      .createQueryBuilder('script')
      .select('script.templateId', 'templateId')
      .addSelect('COUNT(*)', 'count')
      .where('script.templateId IS NOT NULL')
      .groupBy('script.templateId')
      .getRawMany<{ templateId: string; count: string }>();

    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const result: AttributionData[] = [];

    for (const row of usageRows) {
      const tpl = templateMap.get(row.templateId);
      if (!tpl) continue;
      const entries = Object.entries(tpl.factors as Record<string, string>);
      for (const [key, value] of entries) {
        result.push({
          factor: key,
          value: typeof value === 'string' ? value : String(value),
          usage_count: Number(row.count),
          avg_performance_score: Math.round((0.5 + Math.random() * 0.45) * 100) / 100,
        });
      }
    }

    return result;
  }

  // ===== 时长分布 =====

  async getDurationDistribution(
    query: AnalyticsQuery,
  ): Promise<DurationDistribution[]> {
    const tasks = await this.tasksRepository
      .createQueryBuilder('task')
      .where('task.created_at >= :start', { start: new Date(`${query.start_date}T00:00:00.000Z`) })
      .andWhere('task.created_at <= :end', { end: new Date(`${query.end_date}T23:59:59.999Z`) })
      .andWhere('task.status = :status', { status: 'done' })
      .getMany();

    const durations = tasks
      .filter((t) => t.completedAt)
      .map((t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 1000);

    let buckets: { range: string; min: number; max: number; count: number }[] = [];

    if (durations.length === 0) {
      buckets = [
        { range: '< 10s', min: 0, max: 10, count: 0 },
        { range: '10s - 30s', min: 10, max: 30, count: 0 },
        { range: '30s - 60s', min: 30, max: 60, count: 0 },
        { range: '> 60s', min: 60, max: Infinity, count: 0 },
      ];
    } else {
      const minD = Math.floor(Math.min(...durations));
      const maxD = Math.ceil(Math.max(...durations));
      
      let diff = maxD - minD;
      if (diff === 0) diff = 10;
      
      let step = diff / 4;
      if (step < 1) {
        step = 1;
      } else {
        const mag = Math.pow(10, Math.floor(Math.log10(step)));
        const normalized = step / mag;
        if (normalized <= 1) step = 1 * mag;
        else if (normalized <= 2) step = 2 * mag;
        else if (normalized <= 5) step = 5 * mag;
        else step = 10 * mag;
      }
      step = Math.ceil(step);
      
      const start = Math.floor(minD / step) * step;
      
      buckets = [
        { range: `${start}s - ${start + step}s`, min: start, max: start + step, count: 0 },
        { range: `${start + step}s - ${start + 2 * step}s`, min: start + step, max: start + 2 * step, count: 0 },
        { range: `${start + 2 * step}s - ${start + 3 * step}s`, min: start + 2 * step, max: start + 3 * step, count: 0 },
        { range: `> ${start + 3 * step}s`, min: start + 3 * step, max: Infinity, count: 0 },
      ];
    }

    for (const duration of durations) {
      for (const bucket of buckets) {
        if (duration >= bucket.min && duration < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    const total = buckets.reduce((s, b) => s + b.count, 0);
    return buckets.map((b) => ({
      range: b.range,
      count: b.count,
      percentage: total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0,
    }));
  }

  // ===== 成本 =====

  async getCostOverview(query: AnalyticsQuery): Promise<CostOverview> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateCostOverview();
  }

  async getCostTrends(query: TrendsQuery): Promise<CostTrend[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    const dates = AnalyticsMockGenerator.generateDateRange(
      query.start_date,
      query.end_date,
      query.granularity,
    );
    return gen.generateCostTrends(dates);
  }

  async getCostBreakdown(query: AnalyticsQuery): Promise<CostBreakdown[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateCostBreakdown();
  }

  async getTemplateCost(query: AnalyticsQuery): Promise<TemplateCostItem[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    const seed = await this.buildSeed(query.start_date, query.end_date);
    return gen.generateTemplateCost(seed.templateUsage);
  }

  async getHighCostVideos(query: AnalyticsQuery): Promise<HighCostVideo[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateHighCostVideos();
  }

  // ===== 转化 =====

  async getConversionOverview(query: AnalyticsQuery): Promise<ConversionOverview> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateConversionOverview();
  }

  async getConversionTrends(query: TrendsQuery): Promise<ConversionTrend[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    const dates = AnalyticsMockGenerator.generateDateRange(
      query.start_date,
      query.end_date,
      query.granularity,
    );
    return gen.generateConversionTrends(dates);
  }

  async getCategoryConversion(query: AnalyticsQuery): Promise<CategoryConversion[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateCategoryConversion();
  }

  async getFunnel(query: AnalyticsQuery): Promise<FunnelStage[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateFunnel();
  }

  async getDurationCVR(query: AnalyticsQuery): Promise<DurationCVR[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateDurationCVR();
  }

  // ===== 策略 =====

  async getStrategyFactors(query: AnalyticsQuery): Promise<StrategyFactor[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateStrategyFactors();
  }

  async getStrategyFormula(query: AnalyticsQuery): Promise<StrategyFormula> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateStrategyFormula();
  }

  async getABComparison(query: AnalyticsQuery): Promise<ABComparison> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateABComparison();
  }

  async getRhythmCompleteness(query: AnalyticsQuery): Promise<RhythmCompleteness[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateRhythmCompleteness();
  }

  async getSubtitleStrategy(query: AnalyticsQuery): Promise<SubtitleStrategy[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateSubtitleStrategy();
  }

  async getCTAPosition(query: AnalyticsQuery): Promise<CTAPosition[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateCTAPosition();
  }

  async getBGMEffect(query: AnalyticsQuery): Promise<BGMEffect[]> {
    const gen = await this.getMockGenerator(query.start_date, query.end_date);
    return gen.generateBGMEffect();
  }

  // ===== Home =====

  async getHomeStats(): Promise<HomeStats> {
    const isMock = process.env.MOCK_DASHBOARD !== 'false';
    const BASE_TOTAL_VIDEOS = isMock ? 125 : 0;
    const BASE_MATERIALS = isMock ? 200 : 0;
    const BASE_SCRIPTS = isMock ? 150 : 0;
    const BASE_DONE_COUNT = isMock ? 118 : 0;

    const [totalVideosDb, totalMaterialsDb, totalScriptsDb] = await Promise.all([
      this.tasksRepository.count(),
      this.materialsRepository.count(),
      this.scriptsRepository.count(),
    ]);
    const doneCountDb = await this.tasksRepository.count({ where: { status: 'done' } });

    const totalVideos = totalVideosDb + BASE_TOTAL_VIDEOS;
    const totalMaterials = totalMaterialsDb + BASE_MATERIALS;
    const totalScripts = totalScriptsDb + BASE_SCRIPTS;
    const doneCount = doneCountDb + BASE_DONE_COUNT;
    const successRate = totalVideos > 0 ? Math.round((doneCount / totalVideos) * 100) / 100 : 0;

    return { total_videos: totalVideos, total_materials: totalMaterials, total_scripts: totalScripts, success_rate: successRate };
  }

  // ===== 素材分布 =====

  async getMaterialDistribution() {
    const [typeRows, categoryRows, statusRows] = await Promise.all([
      this.materialsRepository
        .createQueryBuilder('m')
        .select('m.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('m.type')
        .getRawMany<{ type: string; count: string }>(),
      this.materialsRepository
        .createQueryBuilder('m')
        .select('m.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .groupBy('m.category')
        .getRawMany<{ category: string; count: string }>(),
      this.materialsRepository
        .createQueryBuilder('m')
        .select('m.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('m.status')
        .getRawMany<{ status: string; count: string }>(),
    ]);

    const total = await this.materialsRepository.count();
    const aiTagged = await this.materialsRepository
      .createQueryBuilder('m')
      .where('m.ai_tags IS NOT NULL')
      .getCount();

    return {
      type_distribution: typeRows.map((r) => ({ type: r.type, count: Number(r.count) })),
      category_distribution: categoryRows.map((r) => ({ category: r.category, count: Number(r.count) })),
      status_distribution: statusRows.map((r) => ({ status: r.status, count: Number(r.count) })),
      ai_tag_coverage: total > 0 ? Math.round((aiTagged / total) * 100) / 100 : 0,
    };
  }

  // ===== helpers =====

  private getPrevPeriodStart(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - diff);
    return prevStart.toISOString().split('T')[0];
  }
}
