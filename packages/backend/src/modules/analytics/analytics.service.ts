import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  overview() {
    return {
      total_generated: 0,
      success_rate: 0,
      avg_generation_time: 0,
      total_materials: 0,
      total_scripts: 0,
      period_comparison: { generated_change: 0, success_rate_change: 0 },
    };
  }

  trends() {
    return [];
  }

  attribution() {
    return [];
  }

  durationDistribution() {
    return [];
  }
}
