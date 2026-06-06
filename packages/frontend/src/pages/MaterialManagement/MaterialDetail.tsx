import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Image,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { useMaterialStore } from '../../stores/useMaterialStore';
import {
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_STATUS_LABELS,
  SOURCE_DECLARATION_LABELS,
} from '../../constants';
import { formatBeijingDateTime, formatBytes, formatDuration } from '../../utils/format';
import type { Material } from '@aigc/shared-types';
import { routePath } from '../../constants';

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
    analyzingIds,
    analysisStepById,
    fetchDetail,
    updateMaterial,
    remove,
    triggerAnalysis,
    clearSelection,
    similarSearch,
  } = useMaterialStore();

  const [similarMaterials, setSimilarMaterials] = useState<{ material: Material; score: number }[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  const analysisStep = id ? analysisStepById[id] : undefined;

  useEffect(() => {
    if (id) fetchDetail(id);
    return () => clearSelection();
  }, [id, fetchDetail, clearSelection]);

  // Refresh detail when analysis step changes past transcoding — video URL may now be available
  useEffect(() => {
    if (id && analysisStep && analysisStep !== 'transcoding') {
      fetchDetail(id);
    }
  }, [analysisStep]);

  // Load similar materials when detail is available
  useEffect(() => {
    if (selectedMaterial?.id && (selectedMaterial.ai_description || (selectedMaterial.ai_tags ?? []).length > 0)) {
      const desc = selectedMaterial.ai_description ?? '';
      const tags = (selectedMaterial.ai_tags ?? []).join(' ');
      const query = [desc, tags].filter(Boolean).join(' ').substring(0, 200);
      if (query) {
        setLoadingSimilar(true);
        similarSearch(query, selectedMaterial.type, 6, undefined, 'semantic')
          .then((results) => {
            setSimilarMaterials(results.filter((r) => r.material.id !== selectedMaterial.id));
          })
          .catch(() => {})
          .finally(() => setLoadingSimilar(false));
      }
    }
  }, [selectedMaterial?.id]);

  if (loading || !selectedMaterial) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const material = selectedMaterial;
  const isAnalyzing = analyzingIds.has(material.id) || material.status === 'processing';
  const isVideo = material.type === 'video';
  const { aiTags, slices } = getMaterialDetailCollections(material);
  const metadata = material.metadata;

  const isTranscoding = isVideo && isAnalyzing && analysisStep === 'transcoding';
  const showVideoOverlay = isVideo && isTranscoding;

  const getAnalysisStepLabel = () => {
    if (!isAnalyzing) return null;
    if (isVideo) {
      if (analysisStep === 'transcoding') return '转码中';
      if (analysisStep === 'uploading') return '上传处理中';
      if (analysisStep === 'analyzing') return 'AI 分析中';
      return '处理中';
    }
    if (analysisStep === 'analyzing') return 'AI 分析中';
    return '分析中';
  };

  const handleRename = () => {
    let newName = material.name;
    Modal.confirm({
      title: '重命名素材',
      content: (
        <div style={{ marginTop: 16 }}>
          <Input
            defaultValue={material.name}
            onChange={(e) => (newName = e.target.value)}
            placeholder="请输入新的素材名称"
          />
        </div>
      ),
      onOk: () => {
        if (!newName.trim()) return;
        updateMaterial(material.id, { name: newName.trim() });
      },
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除素材 "${material.name}" 吗？`,
      okType: 'danger',
      onOk: async () => {
        await remove(material.id);
        navigate('/materials');
      },
    });
  };

  const handleReanalyze = () => {
    const hasAiContent = material.ai_tags?.length > 0 || !!material.ai_description;
    if (hasAiContent) {
      Modal.confirm({
        title: '重新分析',
        content: '当前素材已有 AI 识别内容，重新分析将会覆盖原有结果。是否继续？',
        okText: '继续分析',
        cancelText: '取消',
        onOk: () => triggerAnalysis(material.id),
      });
    } else {
      triggerAnalysis(material.id);
    }
  };

  return (
    <div>
      <PageHeader
        title={
          <Space>
            {material.name}
            <Button type="text" icon={<EditOutlined />} onClick={handleRename} />
          </Space>
        }
        breadcrumbs={[
          { title: '素材管理', path: '/materials' },
          { title: material.name },
        ]}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReanalyze}
              loading={isAnalyzing}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? '分析中...' : '重新分析'}
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
              <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                {showVideoOverlay ? (
                  <>
                    <img
                      src={material.thumbnail_url}
                      alt="Transcoding..."
                      style={{
                        width: '100%',
                        display: 'block',
                        filter: 'brightness(0.4) blur(2px)',
                        borderRadius: 8,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '80%',
                        textAlign: 'center',
                        color: '#fff',
                      }}
                    >
                      <Progress
                        percent={99}
                        status="active"
                        strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                        showInfo={false}
                      />
                      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        视频转码与压缩中...
                      </div>
                    </div>
                  </>
                ) : (
                  <video
                    key={`${material.id}-${material.updated_at}`}
                    src={material.url}
                    controls
                    style={{ width: '100%', display: 'block', borderRadius: 8 }}
                  />
                )}
              </div>
            ) : (
              <Image
                src={material.url}
                alt={material.name}
                style={{ width: '100%', borderRadius: 8 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="基本信息" style={{ marginBottom: 24 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="素材名称">{material.name}</Descriptions.Item>
              <Descriptions.Item label="文件名">{material.filename}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={isVideo ? 'blue' : 'green'}>{isVideo ? '视频' : '图片'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatBytes(material.size)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {isAnalyzing && getAnalysisStepLabel() ? (
                  <Tag color="processing" icon={<LoadingOutlined spin />}>
                    {getAnalysisStepLabel()}
                  </Tag>
                ) : (
                  <StatusTag status={material.status} labels={MATERIAL_STATUS_LABELS} />
                )}
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
                {formatBeijingDateTime(material.created_at)}
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

      {material.status === 'failed' && (
        <Alert
          message="AI 分析失败"
          description="素材分析未成功完成，您可以点击「重新分析」重试。之前的 AI 识别内容（如有）已保留。"
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

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

      {(selectedMaterial.ai_description || (selectedMaterial.ai_tags ?? []).length > 0) && (
        <Card title="相似素材" style={{ marginBottom: 24 }}>
          {loadingSimilar ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
          ) : similarMaterials.length === 0 ? (
            <Text type="secondary">暂无相似素材</Text>
          ) : (
            <Row gutter={[16, 16]}>
              {similarMaterials.map(({ material: m, score }) => (
                <Col xs={12} sm={8} md={6} key={m.id}>
                  <Card
                    hoverable
                    size="small"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(routePath.materialDetail(m.id))}
                    cover={
                      m.type === 'video' ? (
                        <div style={{ position: 'relative' }}>
                          <img src={m.thumbnail_url} alt={m.name} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                          <Tag color="blue" style={{ position: 'absolute', top: 4, right: 4, fontSize: 10 }}>视频</Tag>
                        </div>
                      ) : (
                        <img src={m.url} alt={m.name} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                      )
                    }
                  >
                    <Card.Meta
                      title={<Text ellipsis style={{ fontSize: 12 }}>{m.name}</Text>}
                      description={
                        <Tag color={score >= 0.8 ? 'green' : score >= 0.5 ? 'blue' : 'default'} style={{ fontSize: 10 }}>
                          {(score * 100).toFixed(0)}% 匹配
                        </Tag>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      )}
    </div>
  );
}
