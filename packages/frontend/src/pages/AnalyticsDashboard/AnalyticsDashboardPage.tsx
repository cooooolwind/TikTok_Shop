import { useEffect, useState } from 'react';
import { Card, Col, DatePicker, Row, Select, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type {
  AttributionData,
  DurationDistribution,
  TrendData,
} from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/analytics/StatCard';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { RangePicker } = DatePicker;

export default function AnalyticsDashboardPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    overview,
    trends,
    attribution,
    durationDistribution,
    materialDistribution,
    overviewLoading,
    dateRange,
    granularity,
    setDateRange,
    setGranularity,
    fetchOverview,
    fetchTrends,
    fetchAttribution,
    fetchDurationDistribution,
    fetchMaterialDistribution,
  } = useAnalyticsStore();

  const [dates, setDates] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    setDateRange({
      start_date: dates[0].format('YYYY-MM-DD'),
      end_date: dates[1].format('YYYY-MM-DD'),
    });
  }, []);

  useEffect(() => {
    if (dateRange.start_date && dateRange.end_date) {
      fetchOverview();
      fetchTrends();
      fetchAttribution();
      fetchDurationDistribution();
      fetchMaterialDistribution();
    }
  }, [dateRange, granularity]);

  const handleDateChange = (values: [Dayjs | null, Dayjs | null] | null) => {
    if (!values?.[0] || !values[1]) return;
    setDates([values[0], values[1]]);
    setDateRange({
      start_date: values[0].format('YYYY-MM-DD'),
      end_date: values[1].format('YYYY-MM-DD'),
    });
  };

  return (
    <div>
      <PageHeader
        title="产出总览"
        extra={
          <Space
            direction={isMobile ? 'vertical' : 'horizontal'}
            style={{ width: isMobile ? '100%' : 'auto', alignItems: isMobile ? 'flex-start' : 'center' }}
          >
            <Select
              value={granularity}
              onChange={setGranularity}
              style={{ width: 100 }}
              options={[
                { label: '按日', value: 'day' },
                { label: '按周', value: 'week' },
                { label: '按月', value: 'month' },
              ]}
            />
            <RangePicker
              value={dates}
              onChange={handleDateChange}
              style={{ width: isMobile ? '100%' : 'auto' }}
            />
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="生成视频数"
            value={overview?.total_generated ?? 0}
            change={overview?.period_comparison?.generated_change}
            loading={overviewLoading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="成功率"
            value={overview ? `${(overview.success_rate * 100).toFixed(1)}` : '0'}
            suffix="%"
            change={overview?.period_comparison?.success_rate_change}
            loading={overviewLoading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="平均耗时"
            value={(overview?.avg_generation_time ?? 0).toFixed(1)}
            suffix="s"
            loading={overviewLoading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="素材总数"
            value={overview?.total_materials ?? 0}
            loading={overviewLoading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="剧本总数"
            value={overview?.total_scripts ?? 0}
            loading={overviewLoading}
          />
        </Col>
      </Row>

      <Card title="产出热力图" style={{ marginBottom: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <CalendarHeatmap data={trends} />
        </div>
      </Card>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="因子归因分析">
            <AttributionChart data={attribution} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="生成耗时分布">
            <DurationChart data={durationDistribution} />
          </Card>
        </Col>
      </Row>

      {materialDistribution && (
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title="素材类型分布">
              <ReactECharts
                option={pieOption(
                  materialDistribution.type_distribution.map((d) => ({
                    name: d.type === 'image' ? '图片' : '视频',
                    value: d.count,
                  })),
                )}
                style={{ height: 280 }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="素材品类分布">
              <ReactECharts
                option={pieOption(
                  materialDistribution.category_distribution.map((d) => {
                    const labelMap: Record<string, string> = {
                      product: '商品图',
                      scene: '场景素材',
                      model: '模特视频',
                      other: '其他',
                    };
                    return { name: labelMap[d.category] ?? d.category, value: d.count };
                  }),
                )}
                style={{ height: 280 }}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

function pieOption(data: { name: string; value: number }[]) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{d}%' },
        data,
      },
    ],
  };
}

function CalendarHeatmap({ data }: { data: TrendData[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 200, textAlign: 'center', lineHeight: '200px', color: '#999' }}>暂无数据</div>;

  const maxVal = Math.max(...rows.map((r) => Math.max(r.generated_count, 1)), 1);
  const firstDate = dayjs(rows[0].date);
  const lastDate = dayjs(rows[rows.length - 1].date);
  const dayCount = lastDate.diff(firstDate, 'day') + 1;

  const option = {
    tooltip: {
      formatter: (p: { data: [string, number] }) =>
        `${p.data[0]}<br/>生成: ${p.data[1]} 个`,
    },
    visualMap: {
      min: 0,
      max: maxVal,
      type: 'piecewise',
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      pieces: [
        { min: maxVal * 0.7, color: '#1a3a5c' },
        { min: maxVal * 0.4, max: maxVal * 0.7, color: '#2e6b9e' },
        { min: maxVal * 0.15, max: maxVal * 0.4, color: '#5ba0d0' },
        { min: 1, max: maxVal * 0.15, color: '#b8d8f0' },
        { value: 0, color: '#f0f0f0' },
      ],
    },
    calendar: {
      top: 20,
      left: 30,
      right: 30,
      cellSize: [20, 20],
      range: [rows[0].date, rows[rows.length - 1].date],
      itemStyle: {
        borderWidth: 3,
        borderColor: '#fff',
        borderRadius: 4,
      },
      yearLabel: { show: true },
      dayLabel: { firstDay: 1 },
      monthLabel: { show: true },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: rows.map((r) => [r.date, r.generated_count]),
      },
    ],
  };

  const minWidth = Math.max(600, Math.ceil(dayCount / 7) * 20 + 80);
  return <ReactECharts option={option} style={{ height: 220, minWidth }} />;
}

function AttributionChart({ data }: { data: AttributionData[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 280, textAlign: 'center', lineHeight: '280px', color: '#999' }}>暂无归因数据</div>;

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 50, top: 10, bottom: 20 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: rows.map((item) => `${item.factor}:${item.value}`),
      axisLabel: { fontSize: 11, width: 100, overflow: 'truncate' },
    },
    series: [
      {
        name: '使用次数',
        type: 'bar',
        data: rows.map((item) => item.usage_count),
        itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', fontSize: 11 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}

function DurationChart({ data }: { data: DurationDistribution[] }) {
  const rows = Array.isArray(data) ? data : [];
  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{d}%' },
        data: rows.map((item) => ({
          name: item.range,
          value: item.count,
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}
