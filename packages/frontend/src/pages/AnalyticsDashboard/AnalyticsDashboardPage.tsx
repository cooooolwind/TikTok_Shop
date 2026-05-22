import { useEffect, useState } from 'react';
import {
  Row, Col, Card, DatePicker, Select, Typography, Space,
} from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/analytics/StatCard';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';

const { RangePicker } = DatePicker;
const { Title } = Typography;

export default function AnalyticsDashboardPage() {
  const {
    overview, trends, attribution, durationDistribution,
    overviewLoading,
    dateRange, granularity,
    setDateRange, setGranularity,
    fetchOverview, fetchTrends, fetchAttribution, fetchDurationDistribution,
  } = useAnalyticsStore();

  const [dates, setDates] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  // 初始加载
  useEffect(() => {
    const range = {
      start_date: dates[0].format('YYYY-MM-DD'),
      end_date: dates[1].format('YYYY-MM-DD'),
    };
    setDateRange(range);
  }, []);

  useEffect(() => {
    if (dateRange.start_date && dateRange.end_date) {
      fetchOverview();
      fetchTrends();
      fetchAttribution();
      fetchDurationDistribution();
    }
  }, [dateRange, granularity]);

  const handleDateChange = (vals: [Dayjs | null, Dayjs | null] | null) => {
    if (vals && vals[0] && vals[1]) {
      setDates([vals[0], vals[1]]);
      setDateRange({
        start_date: vals[0].format('YYYY-MM-DD'),
        end_date: vals[1].format('YYYY-MM-DD'),
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="数据看板"
        extra={
          <Space>
            <Select
              value={granularity}
              onChange={(v) => setGranularity(v)}
              style={{ width: 100 }}
              options={[
                { label: '按日', value: 'day' },
                { label: '按周', value: 'week' },
                { label: '按月', value: 'month' },
              ]}
            />
            <RangePicker value={dates} onChange={handleDateChange as any} />
          </Space>
        }
      />

      {/* 概览指标 */}
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
            title="平均生成耗时"
            value={overview?.avg_generation_time ?? 0}
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

      {/* 生成趋势图 */}
      <Card title="生成趋势" style={{ marginBottom: 24 }}>
        <TrendChart data={trends} />
      </Card>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        {/* 因子归因 */}
        <Col xs={24} md={12}>
          <Card title="因子归因分析">
            <AttributionChart data={attribution} />
          </Card>
        </Col>

        {/* 耗时分布 */}
        <Col xs={24} md={12}>
          <Card title="生成耗时分布">
            <DurationChart data={durationDistribution} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ===== 趋势图组件 =====

import ReactECharts from 'echarts-for-react';
import type { TrendData, AttributionData, DurationDistribution } from '@aigc/shared-types';

function TrendChart({ data }: { data: TrendData[] }) {
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['生成数', '成功', '失败'], bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '生成数', type: 'bar', data: data.map((d) => d.generated_count),
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '成功', type: 'line', data: data.map((d) => d.success_count),
        itemStyle: { color: '#52c41a' }, smooth: true,
      },
      {
        name: '失败', type: 'line', data: data.map((d) => d.failed_count),
        itemStyle: { color: '#ff4d4f' }, smooth: true,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}

// ===== 归因图组件 =====

function AttributionChart({ data }: { data: AttributionData[] }) {
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: data.map((d) => `${d.factor}:${d.value}`),
      axisLabel: { fontSize: 11, width: 100, overflow: 'truncate' },
    },
    series: [
      {
        name: '使用次数', type: 'bar',
        data: data.map((d) => d.usage_count),
        itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', fontSize: 11 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}

// ===== 耗时分布图组件 =====

function DurationChart({ data }: { data: DurationDistribution[] }) {
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
        data: data.map((d) => ({
          name: d.range,
          value: d.count,
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}
