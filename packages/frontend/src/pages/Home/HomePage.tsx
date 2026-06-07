import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  PictureOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { analyticsApi } from '../../services/analytics.api';
import type { HomeStats } from '@aigc/shared-types';

const { Title } = Typography;

const quickActions = [
  { title: '素材管理', desc: '上传和管理商品素材', icon: <PictureOutlined style={{ fontSize: 32 }} />, path: '/materials', color: '#1677ff' },
  { title: '剧本工作台', desc: '生成和编辑带货剧本', icon: <FileTextOutlined style={{ fontSize: 32 }} />, path: '/scripts', color: '#52c41a' },
  { title: '创作工作室', desc: '一键生成带货视频', icon: <VideoCameraOutlined style={{ fontSize: 32 }} />, path: '/creation', color: '#722ed1' },
  { title: '数据看板', desc: '查看生成数据分析', icon: <BarChartOutlined style={{ fontSize: 32 }} />, path: '/analytics/overview', color: '#fa8c16' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.homeStats().then(setStats).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="欢迎使用 AIGC 带货视频生成平台" />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={12} md={6}>
                <Statistic
                  title="生成视频数"
                  value={stats?.total_videos ?? 0}
                  loading={loading}
                />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic
                  title="素材总数"
                  value={stats?.total_materials ?? 0}
                  loading={loading}
                />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic
                  title="剧本数量"
                  value={stats?.total_scripts ?? 0}
                  loading={loading}
                />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic
                  title="成功率"
                  value={stats ? `${(stats.success_rate * 100).toFixed(1)}` : '0'}
                  suffix="%"
                  loading={loading}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ marginBottom: 16 }}>快速入口</Title>
      <Row gutter={[16, 16]}>
        {quickActions.map((action) => (
          <Col xs={24} sm={12} md={6} key={action.path}>
            <Card
              hoverable
              onClick={() => navigate(action.path)}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ marginBottom: 12, color: action.color }}>{action.icon}</div>
              <Card.Meta title={action.title} description={action.desc} />
            </Card>
          </Col>
        ))}
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => navigate('/creation/new')}
            style={{ textAlign: 'center', cursor: 'pointer', borderColor: '#1677ff', borderWidth: 2 }}
          >
            <div style={{ marginBottom: 12, color: '#fa8c16' }}>
              <ThunderboltOutlined style={{ fontSize: 32 }} />
            </div>
            <Card.Meta title="快速成片" description="输入商品链接，一键生成视频" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
