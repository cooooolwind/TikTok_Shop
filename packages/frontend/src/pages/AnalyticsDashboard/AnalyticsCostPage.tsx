import { useEffect, useState } from 'react';
import { Card, Col, DatePicker, Row, Select, Space, theme } from 'antd';
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
          >
            <div style={{ marginTop: 4, textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: costColors[costLevel] }}>
                {costLabels[costLevel]}
              </span>
            </div>
          </StatCard>
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
            value={(overview?.period_comparison?.cost_change ?? 0).toFixed(1)}
            suffix="%"
            change={overview?.period_comparison?.cost_change}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={14}>
          <Card title="每日成本构成" style={{ height: '100%' }}>
            <WaterfallChart data={trends} />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="模型成本占比" style={{ height: '100%' }}>
            <NestedDonutChart data={breakdown} />
          </Card>
        </Col>
      </Row>

      {templateCost.length > 0 && (
        <Card title="模板成本对比" style={{ marginBottom: 24, height: '100%' }}>
          <TemplateBubbleChart data={templateCost} />
        </Card>
      )}
    </div>
  );
}

function WaterfallChart({ data }: { data: { date: string; script_cost: number; first_frame_cost: number; video_cost: number; total_cost: number }[] }) {
  const { token } = theme.useToken();
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 320, textAlign: 'center', lineHeight: '320px', color: token.colorTextPlaceholder }}>暂无数据</div>;

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['剧本生成', '首帧生成', '视频片段', '总成本'], top: 0, textStyle: { color: token.colorText } },
    grid: { left: 60, right: 20, top: 90, bottom: 60 },
    xAxis: { type: 'category', data: rows.map((r) => r.date), axisLabel: { rotate: 45, fontSize: 10, color: token.colorTextSecondary } },
    yAxis: { 
      type: 'value', 
      name: '元',
      nameTextStyle: { color: token.colorTextSecondary },
      axisLabel: { color: token.colorTextSecondary },
      splitLine: { lineStyle: { color: token.colorBorderSecondary } }
    },
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

  return <ReactECharts option={option} style={{ height: 320, width: '100%' }} />;
}

function NestedDonutChart({ data }: { data: { model: string; usage: string; cost: number; percentage: number }[] }) {
  const { token } = theme.useToken();
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 320, textAlign: 'center', lineHeight: '320px', color: token.colorTextPlaceholder }}>暂无数据</div>;

  const getCategory = (usage: string) => {
    if (usage.includes('剧本')) return '剧本生成';
    if (usage.includes('视频') || usage.includes('首帧')) return '视频生成';
    if (usage.includes('多模态') || usage.includes('分析')) return '语义分析';
    return '其他';
  };

  const catColors: Record<string, string> = {
    '剧本生成': '#1677ff', // blue
    '视频生成': '#fa8c16', // orange
    '语义分析': '#52c41a', // green
  };

  const modelNameMap: Record<string, string> = {
    'ChatCompletion': '大语言模型',
    'Seedream': '图片生成模型',
    'Seedance': '视频生成模型',
    'Doubao-embedding-vision': '多模态分析模型',
  };

  const modelColors: Record<string, string> = {
    '大语言模型': '#4096ff', // light blue
    '图片生成模型': '#ffc069', // light orange
    '视频生成模型': '#fa8c16', // orange
    '多模态分析模型': '#73d13d', // light green
  };

  const categories: Record<string, number> = {};
  rows.forEach((r) => {
    const cat = getCategory(r.usage);
    categories[cat] = (categories[cat] || 0) + r.cost;
  });
  const innerData = Object.entries(categories).map(([name, value]) => ({ 
    name, 
    value, 
    itemStyle: { color: catColors[name] || '#999' } 
  }));

  const models: Record<string, number> = {};
  rows.forEach((r) => {
    const modelName = modelNameMap[r.model] || r.model;
    models[modelName] = (models[modelName] || 0) + r.cost;
  });
  const outerData = Object.entries(models).map(([name, value]) => ({ 
    name, 
    value, 
    itemStyle: { color: modelColors[name] || '#999' } 
  }));

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (p: { seriesName: string; name: string; value: number; percent: number }) =>
        `${p.seriesName}<br/>${p.name}: ¥${p.value.toFixed(2)} (${p.percent}%)`,
    },
    legend: { 
      bottom: 0,
      textStyle: { color: token.colorText }
    },
    series: [
      {
        name: '功能分类',
        type: 'pie',
        radius: ['0%', '35%'],
        center: ['50%', '40%'],
        itemStyle: { borderRadius: 3, borderColor: token.colorBgContainer, borderWidth: 2 },
        label: { show: true, position: 'inner', formatter: '{b}\n{d}%', fontSize: 10, color: '#fff', textBorderColor: 'rgba(0,0,0,0.3)', textBorderWidth: 1 },
        data: innerData,
      },
      {
        name: '模型',
        type: 'pie',
        radius: ['45%', '60%'],
        center: ['50%', '40%'],
        itemStyle: { borderRadius: 3, borderColor: token.colorBgContainer, borderWidth: 2 },
        label: { show: true, position: 'outside', formatter: '{b}\n¥{c}', fontSize: 11, color: token.colorText },
        labelLine: { length: 10, length2: 15, lineStyle: { color: token.colorTextSecondary } },
        data: outerData,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320, width: '100%' }} />;
}

function TemplateBubbleChart({ data }: { data: { template_name: string; usage_count: number; avg_cost: number; success_rate: number }[] }) {
  const { token } = theme.useToken();
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;

  const option = {
    tooltip: {
      formatter: (p: { name: string; value: [number, number, number, number] }) =>
        `${p.name}<br/>使用: ${p.value[0]}次<br/>单次成本: ¥${p.value[1].toFixed(2)}<br/>成功率: ${(p.value[2] * 100).toFixed(0)}%`,
    },
    grid: { left: 80, right: 80, top: 40, bottom: 60 },
    xAxis: { 
      name: '使用次数', 
      type: 'value',
      nameTextStyle: { color: token.colorTextSecondary },
      axisLabel: { color: token.colorTextSecondary },
      splitLine: { lineStyle: { color: token.colorBorderSecondary } }
    },
    yAxis: { 
      name: '单视频成本 (元)', 
      type: 'value',
      nameTextStyle: { color: token.colorTextSecondary },
      axisLabel: { color: token.colorTextSecondary },
      splitLine: { lineStyle: { color: token.colorBorderSecondary } }
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(20, val[2] * 80),
        data: rows.map((r) => ({
          name: r.template_name,
          value: [r.usage_count, r.avg_cost, r.success_rate],
        })),
        itemStyle: { color: '#1677ff', opacity: 0.7 },
        label: { show: true, formatter: '{b}', position: 'top', fontSize: 11, color: token.colorText },
        emphasis: { focus: 'series' },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 360, width: '100%' }} />;
}
