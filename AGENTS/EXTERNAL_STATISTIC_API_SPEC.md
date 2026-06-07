# External Statistics API Specification

This document defines the REST API contract required for the external data source when the TikTok Shop AIGC platform is running with `MOCK_DASHBOARD=false`. 

The external API handles all metrics related to **billing costs, TikTok Shop conversion data, and content strategy attribution**, as these occur outside of the local video generation system.

## General Information

- **Base URL**: Configured via the `STATISTIC_API_URL` environment variable.
- **Method**: All endpoints use `GET`.
- **Response Format**: All endpoints MUST return standard JSON format conforming to the structure below.
  ```json
  {
    "code": 0,
    "data": <Payload>,
    "message": "success"
  }
  ```
  *(Note: If the external API returns raw payloads without `code/data/message`, the backend proxy will attempt to wrap it automatically, but the wrapped format is strictly recommended).*

## Common Query Parameters

All endpoints accept the following query parameters for filtering:
- `start_date` (string, `YYYY-MM-DD`): The start date of the reporting period.
- `end_date` (string, `YYYY-MM-DD`): The end date of the reporting period.
- `granularity` (enum: `'day' | 'week' | 'month'`): Only applicable to "trends" endpoints.

---

## 1. Cost Endpoints (`/cost/*`)

Provides billing data from Volcano Engine and other LLM API providers.

### `GET /cost/overview`
**Payload Type**: `CostOverview`
```json
{
  "total_cost": 2580.5,
  "avg_cost_per_video": 0.45,
  "daily_avg_cost": 85.5,
  "period_comparison": { "cost_change": 12, "avg_cost_change": -5 }
}
```

### `GET /cost/trends`
**Payload Type**: `CostTrend[]`
```json
[
  { "date": "2026-06-01", "script_cost": 10, "first_frame_cost": 15, "video_cost": 50, "total_cost": 75 }
]
```

### `GET /cost/breakdown`
**Payload Type**: `CostBreakdown[]`
```json
[
  { "model": "Doubao-pro-128k", "usage": "Script Generation", "cost": 120.5, "tokens": 450000, "percentage": 45 }
]
```

### `GET /cost/by-template`
**Payload Type**: `TemplateCostItem[]`
```json
[
  { "template_name": "Product Showcase A", "usage_count": 150, "avg_cost": 0.42, "success_rate": 0.98 }
]
```

### `GET /cost/high-cost-videos`
**Payload Type**: `HighCostVideo[]`
```json
[
  { "video_id": "vid_123", "script_name": "Summer Promo", "total_cost": 2.5, "duration": 45, "thumbnail_url": "..." }
]
```

---

## 2. Conversion Endpoints (`/conversion/*`)

Provides TikTok Shop traffic, CTR, CVR, and GMV data.

### `GET /conversion/overview`
**Payload Type**: `ConversionOverview`
```json
{
  "total_exposure": 1500000,
  "ctr": 0.035,
  "cvr": 0.012,
  "gmv": 85000,
  "roi": 3.2,
  "period_comparison": { "gmv_change": 15, "roi_change": 5 }
}
```

### `GET /conversion/trends`
**Payload Type**: `ConversionTrend[]`
```json
[
  { "date": "2026-06-01", "exposure": 50000, "click": 1500, "order": 18, "gmv": 540 }
]
```

### `GET /conversion/by-category`
**Payload Type**: `CategoryConversion[]`
```json
[
  { "category": "product", "video_count": 120, "ctr": 0.04, "cvr": 0.015, "gmv": 45000, "roi": 3.5 }
]
```

### `GET /conversion/funnel`
**Payload Type**: `FunnelStage[]`
```json
[
  { "stage": "Exposure", "count": 1500000, "rate": 1.0 },
  { "stage": "Click", "count": 52500, "rate": 0.035 },
  { "stage": "Order", "count": 630, "rate": 0.012 }
]
```

### `GET /conversion/duration-cvr`
**Payload Type**: `DurationCVR[]`
```json
[
  { "range": "9-15s", "video_count": 45, "cvr": 0.025 }
]
```

---

## 3. Strategy & Attribution Endpoints (`/strategy/*` & `/attribution`)

Provides analytical insights on video content structures and A/B test results.

### `GET /attribution`
**Payload Type**: `AttributionData[]`
```json
[
  { "factor": "hook", "value": "Pain Point", "usage_count": 350, "avg_performance_score": 0.85, "conversion_rate": 0.02 }
]
```

### `GET /strategy/factors`
**Payload Type**: `StrategyFactor[]`
```json
[
  { "type": "pain_point", "label": "Pain Point Query", "icon": "question", "ctr": 4.2, "usage_pct": 35 }
]
```

### `GET /strategy/formula`
**Payload Type**: `StrategyFormula`
```json
{
  "features": [
    { "name": "Fast cuts (<2s)", "score": 92, "description": "Increases retention" }
  ]
}
```

### `GET /strategy/ab-comparison`
**Payload Type**: `ABComparison`
```json
{
  "version_a_name": "Hook A",
  "version_b_name": "Hook B",
  "metrics": [
    { "name": "CTR", "a": 4.2, "b": 3.8, "unit": "%" }
  ]
}
```

### `GET /strategy/rhythm`
**Payload Type**: `RhythmCompleteness[]`
```json
[
  { "rhythm": "Fast (<2s)", "completion_rate": 65 }
]
```

### `GET /strategy/subtitle`
**Payload Type**: `SubtitleStrategy[]`
```json
[
  { "strategy": "Full Subtitles", "cvr": 2.4 }
]
```

### `GET /strategy/cta`
**Payload Type**: `CTAPosition[]`
```json
[
  { "position": "End of Video", "ctr": 3.5 }
]
```

### `GET /strategy/bgm`
**Payload Type**: `BGMEffect[]`
```json
[
  { "style": "Upbeat", "completion_rate": 75 }
]
```
