import { useEffect, useState } from 'react';
import { Card, Col, DatePicker, Row, Select, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { ArrowRightOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/analytics/StatCard';
import { useConversionAnalyticsStore } from '../../stores/useConversionAnalyticsStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { RangePicker } = DatePicker;

export default function AnalyticsConversionPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    overview,
    trends,
    categoryConversion,
    funnel,
    durationCVR,
    dateRange,
    granularity,
    loading,
    setDateRange,
    setGranularity,
    fetchOverview,
    fetchTrends,
    fetchCategoryConversion,
    fetchFunnel,
    fetchDurationCVR,
  } = useConversionAnalyticsStore();

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
      fetchCategoryConversion();
      fetchFunnel();
      fetchDurationCVR();
    }
  }, [dateRange, granularity]);

  const handleDateChange = (values: [Dayjs | null, Dayjs | null] | null) => {
    if (!values?.[0] || !values[1]) return;
    setDates([values[0], values[1]]);
    setDateRange({ start_date: values[0].format('YYYY-MM-DD'), end_date: values[1].format('YYYY-MM-DD') });
  };

  const gmv = overview?.gmv ?? 0;
  const gmvText = gmv >= 10000 ? `¥${(gmv / 10000).toFixed(1)}万` : `¥${gmv.toFixed(0)}`;
  const roi = overview?.roi ?? 0;

  return (
    <div>
      <PageHeader
        title="转化分析"
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

      {/* Conversion Pipeline */}
      <Card style={{ marginBottom: 24 }}>
        <Row
          gutter={[16, 16]}
          justify="space-around"
          align="middle"
          style={{ textAlign: 'center', padding: '16px 0' }}
        >
          <Col>
            <div style={{ fontSize: 12, color: '#999' }}>曝光量</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>
              {((overview?.total_exposure ?? 0) / 10000).toFixed(1)}万
            </div>
          </Col>
          <Col>
            <ArrowRightOutlined style={{ color: '#ccc', fontSize: 20 }} />
          </Col>
          <Col>
            <div style={{ fontSize: 12, color: '#999' }}>点击率 (CTR)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}>
              {((overview?.ctr ?? 0) * 100).toFixed(2)}%
            </div>
          </Col>
          <Col>
            <ArrowRightOutlined style={{ color: '#ccc', fontSize: 20 }} />
          </Col>
          <Col>
            <div style={{ fontSize: 12, color: '#999' }}>转化率 (CVR)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>
              {((overview?.cvr ?? 0) * 100).toFixed(2)}%
            </div>
          </Col>
          <Col>
            <ArrowRightOutlined style={{ color: '#ccc', fontSize: 20 }} />
          </Col>
          <Col>
            <div style={{ fontSize: 12, color: '#999' }}>GMV 贡献</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>{gmvText}</div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard title="总曝光量" value={((overview?.total_exposure ?? 0) / 10000).toFixed(1)} suffix="万" loading={loading} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="ROI" value={`${roi.toFixed(1)}x`} loading={loading} />
          {roi > 0 && (
            <div style={{ marginTop: 4, textAlign: 'center', fontSize: 12, color: '#999' }}>
              每投入 1 元 AI 费用，赚回 ¥{(roi).toFixed(1)}
            </div>
          )}
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="GMV 环比"
            value={overview?.period_comparison?.gmv_change ?? 0}
            suffix="%"
            change={overview?.period_comparison?.gmv_change}
            loading={loading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="ROI 环比"
            value={overview?.period_comparison?.roi_change ?? 0}
            suffix="%"
            change={overview?.period_comparison?.roi_change}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="转化漏斗">
            <SankeyChart data={funnel} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="品类转化气泡矩阵">
            <BubbleMatrixChart data={categoryConversion} />
          </Card>
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="时长与转化率">
            <DurationCVRChart data={durationCVR} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="GMV 与开销趋势">
            <ROITrendChart data={trends} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function SankeyChart({ data }: { data: { stage: string; count: number; rate: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length < 2) return <div style={{ height: 300, textAlign: 'center', lineHeight: '300px', color: '#999' }}>暂无数据</div>;

  const nodes = rows.map((r) => ({ name: r.stage }));
  const links = [];
  for (let i = 0; i < rows.length - 1; i++) {
    links.push({ source: rows[i].stage, target: rows[i + 1].stage, value: rows[i + 1].count });
  }

  const option = {
    tooltip: { trigger: 'item', triggerOn: 'mousemove' },
    series: [
      {
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'left',
        data: nodes,
        links,
        label: { show: true, formatter: '{b}' },
        lineStyle: { color: 'gradient', curveness: 0.5 },
        itemStyle: { color: ['#1677ff', '#fa8c16', '#52c41a', '#ff4d4f'] },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}

function BubbleMatrixChart({ data }: { data: { category: string; video_count: number; cvr: number; gmv: number; roi: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 300, textAlign: 'center', lineHeight: '300px', color: '#999' }}>暂无数据</div>;

  const option = {
    tooltip: {
      formatter: (p: { name: string; value: [number, number, number, number] }) =>
        `${p.name}<br/>视频: ${p.value[0]}<br/>CVR: ${(p.value[1] * 100).toFixed(2)}%<br/>GMV: ¥${p.value[2].toLocaleString()}<br/>ROI: ${p.value[3].toFixed(1)}x`,
    },
    grid: { left: 80, right: 30, top: 20, bottom: 40 },
    xAxis: { name: '视频产出量', type: 'value' },
    yAxis: { name: 'CVR', type: 'value', axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(1)}%` } },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(20, Math.log(val[2] + 1) * 8),
        data: rows.map((r) => ({
          name: r.category,
          value: [r.video_count, r.cvr, r.gmv, r.roi],
        })),
        itemStyle: { color: '#1677ff', opacity: 0.7 },
        label: { show: true, formatter: '{b}', position: 'top', fontSize: 12 },
        emphasis: { focus: 'series' },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}

function DurationCVRChart({ data }: { data: { range: string; video_count: number; cvr: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 300, textAlign: 'center', lineHeight: '300px', color: '#999' }}>暂无数据</div>;

  const maxCVR = Math.max(...rows.map((r) => r.cvr), 0.01);

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: rows.map((r) => r.range) },
    yAxis: { type: 'value', name: 'CVR', axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(1)}%` } },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => ({
          value: r.cvr,
          itemStyle: {
            color: `rgba(22, 119, 255, ${0.3 + 0.7 * (r.cvr / maxCVR)})`,
            borderRadius: [4, 4, 0, 0],
          },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => `${(p.value * 100).toFixed(2)}%`,
          fontSize: 12,
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}

function ROITrendChart({ data }: { data: { date: string; gmv: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 300, textAlign: 'center', lineHeight: '300px', color: '#999' }}>暂无数据</div>;

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['GMV'], bottom: 0 },
    grid: { left: 70, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: rows.map((r) => r.date), axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}` } },
    series: [
      {
        name: 'GMV',
        type: 'line',
        areaStyle: { opacity: 0.3 },
        data: rows.map((r) => r.gmv),
        itemStyle: { color: '#ff4d4f' },
        smooth: true,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}
