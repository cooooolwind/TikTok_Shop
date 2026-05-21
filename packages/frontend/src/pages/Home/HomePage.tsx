import { Row, Col, Card, Statistic, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  PictureOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

const quickActions = [
  { title: '素材管理', desc: '上传和管理商品素材', icon: <PictureOutlined style={{ fontSize: 32 }} />, path: '/materials' },
  { title: '剧本工作台', desc: '生成和编辑带货剧本', icon: <FileTextOutlined style={{ fontSize: 32 }} />, path: '/scripts' },
  { title: '创作工作室', desc: '一键生成带货视频', icon: <VideoCameraOutlined style={{ fontSize: 32 }} />, path: '/creation' },
  { title: '数据看板', desc: '查看生成数据分析', icon: <BarChartOutlined style={{ fontSize: 32 }} />, path: '/analytics' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      <Title level={3}>欢迎使用 AIGC 带货视频生成平台</Title>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card>
            <Row gutter={16}>
              <Col span={6}><Statistic title="生成视频数" value={0} /></Col>
              <Col span={6}><Statistic title="素材总数" value={0} /></Col>
              <Col span={6}><Statistic title="剧本数量" value={0} /></Col>
              <Col span={6}><Statistic title="成功率" value={0} suffix="%" /></Col>
            </Row>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {quickActions.map((action) => (
          <Col xs={24} sm={12} md={6} key={action.path}>
            <Card
              hoverable
              onClick={() => navigate(action.path)}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ marginBottom: 12, color: '#1677ff' }}>{action.icon}</div>
              <Card.Meta title={action.title} description={action.desc} />
            </Card>
          </Col>
        ))}
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => navigate('/creation')}
            style={{ textAlign: 'center', cursor: 'pointer', borderColor: '#1677ff' }}
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
