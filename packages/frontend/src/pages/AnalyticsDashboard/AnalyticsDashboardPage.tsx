import { Typography } from 'antd';

const { Title } = Typography;

export default function AnalyticsDashboardPage() {
  return (
    <div>
      <Title level={3}>数据看板</Title>
      <p>生成概览、趋势分析、因子归因、时长分布图表将在此实现。</p>
    </div>
  );
}
