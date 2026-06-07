import { useEffect, useState } from 'react';
import { Card, Col, DatePicker, Progress, Row, Tag, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  QuestionCircleOutlined,
  SwapOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  BookOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useStrategyAnalyticsStore } from '../../stores/useStrategyAnalyticsStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { RangePicker } = DatePicker;

const HOOK_ICONS: Record<string, React.ReactNode> = {
  question: <QuestionCircleOutlined />,
  swap: <SwapOutlined />,
  eye: <EyeOutlined />,
  'play-circle': <PlayCircleOutlined />,
  book: <BookOutlined />,
  team: <TeamOutlined />,
};

export default function AnalyticsStrategyPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    factors,
    formula,
    abComparison,
    rhythm,
    subtitle,
    cta,
    bgm,
    dateRange,
    loading,
    setDateRange,
    fetchAll,
  } = useStrategyAnalyticsStore();

  const [dates, setDates] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    setDateRange({ start_date: dates[0].format('YYYY-MM-DD'), end_date: dates[1].format('YYYY-MM-DD') });
  }, []);

  useEffect(() => {
    if (dateRange.start_date && dateRange.end_date) {
      fetchAll();
    }
  }, [dateRange]);

  const handleDateChange = (values: [Dayjs | null, Dayjs | null] | null) => {
    if (!values?.[0] || !values[1]) return;
    setDates([values[0], values[1]]);
    setDateRange({ start_date: values[0].format('YYYY-MM-DD'), end_date: values[1].format('YYYY-MM-DD') });
  };

  return (
    <div>
      <PageHeader
        title="策略洞察"
        extra={
          <Space direction={isMobile ? 'vertical' : 'horizontal'}>
            <RangePicker value={dates} onChange={handleDateChange} style={{ width: isMobile ? '100%' : 'auto' }} />
          </Space>
        }
      />

      {/* Hook Type Cards */}
      <Card title="Hook 类型效果对比" style={{ marginBottom: 24 }}>
        <Row gutter={[12, 12]}>
          {factors.map((f) => (
            <Col xs={12} sm={8} md={4} key={f.type}>
              <Card
                size="small"
                hoverable
                style={{ textAlign: 'center' }}
              >
                <div style={{ fontSize: 24, color: '#1677ff', marginBottom: 8 }}>
                  {HOOK_ICONS[f.icon] ?? <PlayCircleOutlined />}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1677ff' }}>
                  {f.ctr}%
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  CTR
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  使用占比 {f.usage_pct}%
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Golden Formula */}
      {formula && (
        <Card title="高转化黄金配方" style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {formula.features.map((f) => (
              <Col xs={24} sm={12} md={8} key={f.name}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span style={{ float: 'right', color: '#1677ff', fontWeight: 700 }}>
                    {f.score}分
                  </span>
                </div>
                <Progress percent={f.score} showInfo={false} strokeColor="#1677ff" size="small" />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{f.description}</div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card title="节奏与完播率" style={{ height: '100%' }}>
            <RhythmChart data={rhythm} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="字幕策略 vs 转化率" style={{ height: '100%' }}>
            <SubtitleChart data={subtitle} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="CTA 位置 vs 点击率" style={{ height: '100%' }}>
            <CTAChart data={cta} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="BGM 风格 vs 完播率" style={{ height: '100%' }}>
            <BGMChart data={bgm} />
          </Card>
        </Col>
        {abComparison && (
          <Col xs={24} md={12}>
            <Card title="A/B 版本效果对比" style={{ height: '100%' }}>
              <ABChart data={abComparison} />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}

function RhythmChart({ data }: { data: { rhythm: string; completion_rate: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 260, textAlign: 'center', lineHeight: '260px', color: '#999' }}>暂无数据</div>;

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 80, top: 40, bottom: 30 },
    xAxis: { type: 'value', name: '完播率(%)', max: 100 },
    yAxis: { type: 'category', data: rows.map((r) => r.rhythm) },
    series: [{
      type: 'bar',
      data: rows.map((r) => ({
        value: r.completion_rate,
        itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] },
      })),
      label: { show: true, position: 'right', formatter: '{c}%' },
    }],
  };

  return <ReactECharts option={option} style={{ height: 260, width: '100%' }} />;
}

function SubtitleChart({ data }: { data: { strategy: string; cvr: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 260, textAlign: 'center', lineHeight: '260px', color: '#999' }}>暂无数据</div>;

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 80, top: 40, bottom: 30 },
    xAxis: { type: 'value', name: 'CVR(%)', axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: rows.map((r) => r.strategy) },
    series: [{
      type: 'bar',
      data: rows.map((r) => ({
        value: r.cvr,
        itemStyle: { color: '#52c41a', borderRadius: [0, 4, 4, 0] },
      })),
      label: { show: true, position: 'right', formatter: '{c}%' },
    }],
  };

  return <ReactECharts option={option} style={{ height: 260, width: '100%' }} />;
}

function CTAChart({ data }: { data: { position: string; ctr: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 260, textAlign: 'center', lineHeight: '260px', color: '#999' }}>暂无数据</div>;

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 80, top: 40, bottom: 30 },
    xAxis: { type: 'value', name: 'CTR(%)', axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: rows.map((r) => r.position) },
    series: [{
      type: 'bar',
      data: rows.map((r) => ({
        value: r.ctr,
        itemStyle: { color: '#fa8c16', borderRadius: [0, 4, 4, 0] },
      })),
      label: { show: true, position: 'right', formatter: '{c}%' },
    }],
  };

  return <ReactECharts option={option} style={{ height: 260, width: '100%' }} />;
}

function BGMChart({ data }: { data: { style: string; completion_rate: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return <div style={{ height: 340, textAlign: 'center', lineHeight: '340px', color: '#999' }}>暂无数据</div>;

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 80, top: 40, bottom: 30 },
    xAxis: { type: 'value', name: '完播率(%)', max: 100 },
    yAxis: { type: 'category', data: rows.map((r) => r.style) },
    series: [{
      type: 'bar',
      data: rows.map((r) => ({
        value: r.completion_rate,
        itemStyle: { color: '#722ed1', borderRadius: [0, 4, 4, 0] },
      })),
      label: { show: true, position: 'right', formatter: '{c}%' },
    }],
  };

  return <ReactECharts option={option} style={{ height: 340, width: '100%' }} />;
}

function ABChart(props: { data: { version_a_name: string; version_b_name: string; metrics: Array<{ name: string; a: number; b: number; unit: string }> } }) {
  const { data } = props;
  const option = {
    tooltip: {},
    legend: { bottom: 0, data: [data.version_a_name, data.version_b_name] },
    radar: {
      indicator: data.metrics.map((m) => ({ name: `${m.name}(${m.unit})`, max: Math.max(m.a, m.b) * 1.3 })),
    },
    series: [
      {
        type: 'radar',
        name: data.version_a_name,
        data: [{ value: data.metrics.map((m) => m.a), name: data.version_a_name }],
        itemStyle: { color: '#1677ff' },
        areaStyle: { opacity: 0.2 },
      },
      {
        type: 'radar',
        name: data.version_b_name,
        data: [{ value: data.metrics.map((m) => m.b), name: data.version_b_name }],
        itemStyle: { color: '#fa8c16' },
        areaStyle: { opacity: 0.2 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 340, width: '100%' }} />;
}
