import { useEffect, useState } from 'react';
import { Card, Col, DatePicker, Row, Select, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/analytics/StatCard';
import { useCostAnalyticsStore } from '../../stores/useCostAnalyticsStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { RangePicker } = DatePicker;

export default function AnalyticsCostPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    overview,
    trends,
    breakdown,
    templateCost,
    dateRange,
    granularity,
    loading,
    setDateRange,
    setGranularity,
    fetchOverview,
    fetchTrends,
    fetchBreakdown,
    fetchTemplateCost,
  } = useCostAnalyticsStore();

  const [dates, setDates] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    setDateRange({ start_date: dates[0].format('YYYY-MM-DD'), end_date: dates[1].format('YYYY-MM-DD') });
  }, []);

  useEffect(() => {
    if (dateRange.start_date && dateRange.end_date) {
      fetchOverview();
      fetchTrends();
      fetchBreakdown();
      fetchTemplateCost();
    }
  }, [dateRange, granularity]);

  const handleDateChange = (values: [Dayjs | null, Dayjs | null] | null) => {
    if (!values?.[0] || !values[1]) return;
    setDates([values[0], values[1]]);
    setDateRange({ start_date: values[0].format('YYYY-MM-DD'), end_date: values[1].format('YYYY-MM-DD') });
  };

  const avgCost = overview?.avg_cost_per_video ?? 0;
  const costLevel = avgCost < 1 ? 'green' : avgCost < 3 ? 'orange' : 'red';
  const costColors: Record<string, string> = { green: '#52c41a', orange: '#faad14', red: '#ff4d4f' };
  const costLabels: Record<string, string> = { green: '成本优良 (<1元/视频)', orange: '成本适中 (1-3元/视频)', red: '成本偏高 (>3元/视频)' };

  return (
    <div>
      <PageHeader
        title="成本分析"
        extra={
          <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
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
            <RangePicker value={dates} onChange={handleDateChange} style={{ width: isMobile ? '100%' : 'auto' }} />
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard title="AI 总开销" value={`¥${(overview?.total_cost ?? 0).toFixed(2)}`} loading={loading} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="单视频平均成本"
            value={`¥${avgCost.toFixed(2)}`}
            loading={loading}
          />
          <div style={{ marginTop: 4, textAlign: 'center' }}>
            <span style={{ fontSize: 12, color: costColors[costLevel] }}>
              {costLabels[costLevel]}
            </span>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="日均开销"
            value={`¥${(overview?.daily_avg_cost ?? 0).toFixed(2)}`}
            loading={loading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="成本环比"
            value={overview?.period_comparison?.cost_change ?? 0}
            suffix="%"
            change={overview?.period_comparison?.cost_change}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col xs={24} md={14}>
          <Card title="每日成本构成">
            <WaterfallChart data={trends} />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="模型成本占比">
            <NestedDonutChart data={breakdown} />
          </Card>
        </Col>
      </Row>

      {templateCost.length > 0 && (
        <Card title="模板成本对比" style={{ marginBottom: 24 }}>
          <TemplateBubbleChart data={templateCost} />
        </Card>
      )}
    </div>
  );
}

function WaterfallChart({ data }: { data: { date: string; script_cost: number; first_frame_cost: number; video_cost: number; total_cost: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 320, textAlign: 'center', lineHeight: '320px', color: '#999' }}>暂无数据</div>;

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['剧本生成', '首帧生成', '视频片段', '总成本'], bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: rows.map((r) => r.date), axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', name: '元' },
    series: [
      {
        name: '剧本生成', type: 'bar', stack: 'cost',
        data: rows.map((r) => r.script_cost), itemStyle: { color: '#1677ff' },
      },
      {
        name: '首帧生成', type: 'bar', stack: 'cost',
        data: rows.map((r) => r.first_frame_cost), itemStyle: { color: '#fa8c16' },
      },
      {
        name: '视频片段', type: 'bar', stack: 'cost',
        data: rows.map((r) => r.video_cost), itemStyle: { color: '#52c41a' },
      },
      {
        name: '总成本', type: 'line',
        data: rows.map((r) => r.total_cost), itemStyle: { color: '#ff4d4f' },
        smooth: true, symbol: 'circle', symbolSize: 6,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}

function NestedDonutChart({ data }: { data: { model: string; usage: string; cost: number; percentage: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 320, textAlign: 'center', lineHeight: '320px', color: '#999' }}>暂无数据</div>;

  const colors: Record<string, string> = { ChatCompletion: '#1677ff', Seedream: '#fa8c16', Seedance: '#52c41a' };

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (p: { seriesName: string; name: string; value: number; percent: number }) =>
        `${p.seriesName}<br/>${p.name}: ¥${p.value.toFixed(2)} (${p.percent}%)`,
    },
    legend: { bottom: 0 },
    series: [
      {
        name: '用途',
        type: 'pie',
        radius: ['0%', '45%'],
        itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'inside', formatter: '{b}\n{d}%', fontSize: 10 },
        data: rows.map((r) => ({ name: r.usage, value: r.cost, itemStyle: { color: colors[r.model] || '#999' } })),
      },
      {
        name: '模型',
        type: 'pie',
        radius: ['55%', '75%'],
        itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'outside', formatter: '{b} ¥{c}', fontSize: 11 },
        labelLine: { length: 20, length2: 30 },
        data: (() => {
          const merged: Record<string, number> = {};
          rows.forEach((r) => { merged[r.model] = (merged[r.model] || 0) + r.cost; });
          return Object.entries(merged).map(([name, value]) => ({
            name, value, itemStyle: { color: colors[name] || '#999' },
          }));
        })(),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}

function TemplateBubbleChart({ data }: { data: { template_name: string; usage_count: number; avg_cost: number; success_rate: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;

  const option = {
    tooltip: {
      formatter: (p: { name: string; value: [number, number, number, number] }) =>
        `${p.name}<br/>使用: ${p.value[0]}次<br/>单次成本: ¥${p.value[1].toFixed(2)}<br/>成功率: ${(p.value[2] * 100).toFixed(0)}%`,
    },
    grid: { left: 80, right: 30, top: 20, bottom: 40 },
    xAxis: { name: '使用次数', type: 'value' },
    yAxis: { name: '单视频成本 (元)', type: 'value' },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(20, val[2] * 80),
        data: rows.map((r) => ({
          name: r.template_name,
          value: [r.usage_count, r.avg_cost, r.success_rate],
        })),
        itemStyle: { color: '#1677ff', opacity: 0.7 },
        label: { show: true, formatter: '{b}', position: 'top', fontSize: 11 },
        emphasis: { focus: 'series' },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 360 }} />;
}
