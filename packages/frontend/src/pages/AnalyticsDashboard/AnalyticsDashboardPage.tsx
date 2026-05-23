import { useEffect, useState } from 'react';
import { Card, Col, DatePicker, Row, Select, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { AttributionData, DurationDistribution, TrendData } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/analytics/StatCard';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';

const { RangePicker } = DatePicker;

export default function AnalyticsDashboardPage() {
  const {
    overview,
    trends,
    attribution,
    durationDistribution,
    overviewLoading,
    dateRange,
    granularity,
    setDateRange,
    setGranularity,
    fetchOverview,
    fetchTrends,
    fetchAttribution,
    fetchDurationDistribution,
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
        title="数据看板"
        extra={
          <Space>
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
            <RangePicker value={dates} onChange={handleDateChange} />
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

      <Card title="生成趋势" style={{ marginBottom: 24 }}>
        <TrendChart data={trends} />
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
    </div>
  );
}

function TrendChart({ data }: { data: TrendData[] }) {
  const rows = Array.isArray(data) ? data : [];
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['生成数', '成功', '失败'], bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: rows.map((item) => item.date),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '生成数',
        type: 'bar',
        data: rows.map((item) => item.generated_count),
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '成功',
        type: 'line',
        data: rows.map((item) => item.success_count),
        itemStyle: { color: '#52c41a' },
        smooth: true,
      },
      {
        name: '失败',
        type: 'line',
        data: rows.map((item) => item.failed_count),
        itemStyle: { color: '#ff4d4f' },
        smooth: true,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}

function AttributionChart({ data }: { data: AttributionData[] }) {
  const rows = Array.isArray(data) ? data : [];
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 30, top: 10, bottom: 20 },
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
