import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Image,
  List,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { useMaterialStore } from '../../stores/useMaterialStore';
import {
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_STATUS_LABELS,
  SOURCE_DECLARATION_LABELS,
} from '../../constants';
import { formatBytes, formatDuration } from '../../utils/format';

const { Text, Paragraph } = Typography;

export function getMaterialDetailCollections<TSlice extends { tags?: string[] }>(material: {
  ai_tags?: string[];
  slices?: TSlice[];
}) {
  return {
    aiTags: material.ai_tags ?? [],
    slices: material.slices ?? [],
  };
}

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    selectedMaterial,
    loading,
    fetchDetail,
    remove,
    triggerAnalysis,
    clearSelection,
  } = useMaterialStore();

  useEffect(() => {
    if (id) fetchDetail(id);
    return () => clearSelection();
  }, [id, fetchDetail, clearSelection]);

  if (loading || !selectedMaterial) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const material = selectedMaterial;
  const isVideo = material.type === 'video';
  const { aiTags, slices } = getMaterialDetailCollections(material);
  const metadata = material.metadata;

  const handleDelete = async () => {
    await remove(material.id);
    navigate('/materials');
  };

  return (
    <div>
      <PageHeader
        title={material.filename}
        breadcrumbs={[
          { title: '素材管理', path: '/materials' },
          { title: material.filename },
        ]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => triggerAnalysis(material.id)}>
              重新分析
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除
            </Button>
          </Space>
        }
      />

      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Card title="预览" style={{ marginBottom: 24 }}>
            {isVideo ? (
              <video
                src={material.url}
                controls
                style={{ width: '100%', borderRadius: 8, background: '#000' }}
              />
            ) : (
              <Image
                src={material.url}
                alt={material.filename}
                style={{ width: '100%', borderRadius: 8 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="基本信息" style={{ marginBottom: 24 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="文件名">{material.filename}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={isVideo ? 'blue' : 'green'}>{isVideo ? '视频' : '图片'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatBytes(material.size)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={material.status} labels={MATERIAL_STATUS_LABELS} />
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                {MATERIAL_CATEGORY_LABELS[material.category] ?? material.category}
              </Descriptions.Item>
              <Descriptions.Item label="来源声明">
                <Tag>
                  {SOURCE_DECLARATION_LABELS[material.source_declaration] ??
                    material.source_declaration}
                </Tag>
              </Descriptions.Item>
              {material.duration !== undefined && (
                <Descriptions.Item label="时长">{formatDuration(material.duration)}</Descriptions.Item>
              )}
              {material.resolution && (
                <Descriptions.Item label="分辨率">
                  {material.resolution.width} x {material.resolution.height}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="上传时间">
                {new Date(material.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {metadata && (
            <Card title="文件元数据" style={{ marginBottom: 24 }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="格式">{metadata.format || '-'}</Descriptions.Item>
                {metadata.bitrate && (
                  <Descriptions.Item label="比特率">{metadata.bitrate} kbps</Descriptions.Item>
                )}
                {metadata.fps && (
                  <Descriptions.Item label="帧率">{metadata.fps} fps</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}
        </Col>
      </Row>

      {aiTags.length > 0 && (
        <Card title="AI 识别标签" style={{ marginBottom: 24 }}>
          <Space wrap>
            {aiTags.map((tag) => (
              <Tag key={tag} color="blue">
                {tag}
              </Tag>
            ))}
          </Space>
          {material.ai_description && (
            <Paragraph style={{ marginTop: 12 }}>{material.ai_description}</Paragraph>
          )}
        </Card>
      )}

      {isVideo && slices.length > 0 && (
        <Card title="视频切片" style={{ marginBottom: 24 }}>
          <List
            dataSource={slices}
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
                      {(slice.tags ?? []).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
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
