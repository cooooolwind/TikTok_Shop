import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Spin,
  Image, Row, Col, Typography, Divider, List, Empty,
} from 'antd';
import { DeleteOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { useMaterialStore } from '../../stores/useMaterialStore';
import { MATERIAL_STATUS_LABELS, MATERIAL_CATEGORY_LABELS, SOURCE_DECLARATION_LABELS } from '../../constants';
import { formatBytes, formatDuration } from '../../utils/format';

const { Text, Paragraph } = Typography;

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedMaterial, loading, fetchDetail, remove, triggerAnalysis, clearSelection } = useMaterialStore();

  useEffect(() => {
    if (id) fetchDetail(id);
    return () => clearSelection();
  }, [id]);

  if (loading || !selectedMaterial) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const m = selectedMaterial;
  const isVideo = m.type === 'video';

  const handleDelete = () => {
    remove(m.id);
    navigate('/materials');
  };

  return (
    <div>
      <PageHeader
        title={m.filename}
        breadcrumbs={[
          { title: '素材管理', path: '/materials' },
          { title: m.filename },
        ]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => triggerAnalysis(m.id)}>
              重新分析
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除
            </Button>
          </Space>
        }
      />

      <Row gutter={24}>
        {/* 左侧：预览 */}
        <Col xs={24} md={12}>
          <Card title="预览" style={{ marginBottom: 24 }}>
            {isVideo ? (
              <video
                src={m.url}
                controls
                style={{ width: '100%', borderRadius: 8, background: '#000' }}
              />
            ) : (
              <Image
                src={m.url}
                alt={m.filename}
                style={{ width: '100%', borderRadius: 8 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            )}
          </Card>
        </Col>

        {/* 右侧：信息 */}
        <Col xs={24} md={12}>
          <Card title="基本信息" style={{ marginBottom: 24 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="文件名">{m.filename}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={isVideo ? 'blue' : 'green'}>{isVideo ? '视频' : '图片'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatBytes(m.size)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={m.status} labels={MATERIAL_STATUS_LABELS} />
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                {MATERIAL_CATEGORY_LABELS[m.category] ?? m.category}
              </Descriptions.Item>
              <Descriptions.Item label="来源声明">
                <Tag>{SOURCE_DECLARATION_LABELS[m.source_declaration] ?? m.source_declaration}</Tag>
              </Descriptions.Item>
              {m.duration !== undefined && (
                <Descriptions.Item label="时长">{formatDuration(m.duration)}</Descriptions.Item>
              )}
              {m.resolution && (
                <Descriptions.Item label="分辨率">
                  {m.resolution.width} x {m.resolution.height}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="上传时间">
                {new Date(m.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 元数据 */}
          {(m as any).metadata && (
            <Card title="文件元数据" style={{ marginBottom: 24 }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="格式">{(m as any).metadata.format}</Descriptions.Item>
                {(m as any).metadata.bitrate && <Descriptions.Item label="比特率">{(m as any).metadata.bitrate} kbps</Descriptions.Item>}
                {(m as any).metadata.fps && <Descriptions.Item label="帧率">{(m as any).metadata.fps} fps</Descriptions.Item>}
              </Descriptions>
            </Card>
          )}
        </Col>
      </Row>

      {/* AI 标签 */}
      {m.ai_tags.length > 0 && (
        <Card title="AI 识别标签" style={{ marginBottom: 24 }}>
          <Space wrap>
            {m.ai_tags.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}
          </Space>
          {m.ai_description && (
            <Paragraph style={{ marginTop: 12 }}>{m.ai_description}</Paragraph>
          )}
        </Card>
      )}

      {/* 视频切片 */}
      {isVideo && m.slices && m.slices.length > 0 && (
        <Card title="视频切片" style={{ marginBottom: 24 }}>
          <List
            dataSource={m.slices}
            renderItem={(slice) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Image
                      src={slice.thumbnail_url}
                      width={120}
                      height={68}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                    />
                  }
                  title={`${formatDuration(slice.start_time)} ~ ${formatDuration(slice.end_time)}`}
                  description={
                    <Space wrap>
                      <Text>{slice.description}</Text>
                      {slice.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
