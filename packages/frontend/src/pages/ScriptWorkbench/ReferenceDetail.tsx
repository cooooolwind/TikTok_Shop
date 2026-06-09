import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Spin, Typography,
  List, Row, Col,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { useReferenceStore } from '../../stores/useReferenceStore';
import { ANALYSIS_STATUS_LABELS, REFERENCE_PLATFORM_LABELS, REFERENCE_DECLARATION_LABELS } from '../../constants';
import { formatDuration } from '../../utils/format';

const { Text, Paragraph, Title } = Typography;

export default function ReferenceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedReference, fetchDetail } = useReferenceStore();

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [id]);

  if (!selectedReference) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  const r = selectedReference;
  const analysis = r.analysis;

  return (
    <div>
      <PageHeader
        title="参考视频分析"
        breadcrumbs={[
          { title: '剧本工作台', path: '/scripts' },
          { title: '参考视频库', path: '/references' },
          { title: (REFERENCE_PLATFORM_LABELS[r.source_platform] || r.source_platform) + ' ' + r.category },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/references')}>返回列表</Button>
        }
      />

      <Card title="基本信息" style={{ marginBottom: 24 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
          <Descriptions.Item label="来源平台">
            <Tag color={r.source_platform === 'local_upload' ? 'default' : undefined}>
              {REFERENCE_PLATFORM_LABELS[r.source_platform] || r.source_platform}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="类目">{r.category}</Descriptions.Item>
          <Descriptions.Item label="原始链接">{r.source_url}</Descriptions.Item>
          <Descriptions.Item label="来源声明">{REFERENCE_DECLARATION_LABELS[r.source_declaration] || r.source_declaration}</Descriptions.Item>
          <Descriptions.Item label="分析状态">
            <StatusTag status={r.analysis_status} labels={ANALYSIS_STATUS_LABELS} />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {analysis && (
        <>
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card size="small"><StatItem label="Hook 手法" value={analysis.hook} /></Card>
            </Col>
            <Col span={8}>
              <Card size="small"><StatItem label="视频风格" value={analysis.style} /></Card>
            </Col>
            <Col span={8}>
              <Card size="small"><StatItem label="时长" value={`${analysis.duration}s`} /></Card>
            </Col>
          </Row>

          <Card title="卖点提炼" style={{ marginBottom: 24 }}>
            <Space wrap>
              {analysis.selling_points.map((sp, i) => <Tag key={i} color="blue">{sp}</Tag>)}
            </Space>
          </Card>

          <Card title="分镜拆解" style={{ marginBottom: 24 }}>
            <List
              dataSource={analysis.storyboard}
              renderItem={(item, idx) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>第 {idx + 1} 镜</Tag>}
                    title={`${formatDuration(item.duration)} | ${item.camera_motion}`}
                    description={
                      <div>
                        <Paragraph>{item.description}</Paragraph>
                        <Space wrap>
                          {item.visual_elements.map((ve, i) => <Tag key={i}>{ve}</Tag>)}
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </>
      )}

      {!analysis && r.analysis_status === 'pending' && (
        <Card><Text type="secondary">该视频正在排队等待 AI 分析...</Text></Card>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div><Text type="secondary">{label}</Text></div>
      <div><Text strong style={{ fontSize: 18 }}>{value}</Text></div>
    </div>
  );
}
