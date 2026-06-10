import { useState, useRef, useEffect } from 'react';
import { Button, Card, Image, Modal, Tag, Space, Typography } from 'antd';
import {
  FileImageOutlined,
  VideoCameraOutlined,
  DeleteOutlined,
  EyeOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { Material } from '@aigc/shared-types';
import StatusTag from '../../common/StatusTag';
import { MATERIAL_STATUS_LABELS, MATERIAL_CATEGORY_LABELS, REFERENCE_CATEGORY_LABELS } from '../../../constants';
import { formatBytes } from '../../../utils/format';

const { Text } = Typography;

interface MaterialCardProps {
  material: Material;
  onClick?: () => void;
  onDelete?: () => void;
  selected?: boolean;
}

export default function MaterialCard({ material, onClick, onDelete, selected }: MaterialCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isVideo = material.type === 'video';
  const previewSrc = material.url || material.thumbnail_url;

  const handlePreview = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!previewSrc) {
      onClick?.();
      return;
    }
    setPreviewOpen(true);
  };

  const [justAnalyzed, setJustAnalyzed] = useState(false);
  const prevStatus = useRef(material.status);

  useEffect(() => {
    if (prevStatus.current === 'processing' && material.status === 'ready') {
      setJustAnalyzed(true);
      const timer = setTimeout(() => setJustAnalyzed(false), 800);
      return () => clearTimeout(timer);
    }
    prevStatus.current = material.status;
  }, [material.status]);

  return (
    <Card
      hoverable
      className={justAnalyzed ? 'card-fade-in' : ''}
      style={{
        borderColor: selected ? '#1677ff' : undefined,
        borderWidth: selected ? 2 : 1,
      }}
      cover={
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ position: 'relative', height: 160, overflow: 'hidden', background: 'var(--bg-color)' }}
        >
          {material.thumbnail_url ? (
            <>
              <Image
                src={material.thumbnail_url}
                alt={material.name}
                preview={false}
                onClick={handlePreview}
                width="100%"
                height="100%"
                style={{ objectFit: 'cover', cursor: 'pointer' }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
                  <Button
                    type="text"
                    icon={isVideo ? <VideoCameraOutlined /> : <EyeOutlined />}
                    aria-label={isVideo ? "播放视频" : "预览图片"}
                    onClick={handlePreview}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      color: '#fff',
                      fontSize: 48,
                      background: isHovered ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0)',
                      opacity: isHovered ? 1 : 0,
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                    }}
                  />
            </>
          ) : (
            <div
              onClick={(event) => {
                event.stopPropagation();
                handlePreview(event);
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
            >
              {isVideo ? (
                <VideoCameraOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              ) : (
                <FileImageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              )}
            </div>
          )}
          {/* 右上角类型标签 */}
          <Tag
            color={isVideo ? 'blue' : 'green'}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            {isVideo ? '视频' : '图片'}
          </Tag>
        </div>
      }
      actions={[
        <EyeOutlined key="view" onClick={handlePreview} />,
        <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} />,
      ]}
      onClick={onClick}
    >
      <Card.Meta
        title={
          material.status === 'processing' && material.name === material.filename ? (
            <Text ellipsis style={{ maxWidth: '100%' }} title="AI 智能命名中...">
              <span className="ai-shimmer-text" style={{ '--shimmer-base': isVideo ? '#1677ff' : '#52c41a', '--shimmer-highlight': isVideo ? '#87e8de' : '#b7eb8f' } as React.CSSProperties}>AI 智能命名中...</span>
            </Text>
          ) : (
            <Text ellipsis style={{ maxWidth: '100%', color: isVideo ? '#1677ff' : '#52c41a' }} title={material.name}>
              {material.name}
            </Text>
          )
        }
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{formatBytes(material.size)}</Text>
            <Space wrap size={[4, 4]}>
              <StatusTag status={material.status} labels={MATERIAL_STATUS_LABELS} />
              {material.has_embedding ? (
                <Tag color="green" style={{ margin: 0 }}>可语义搜索</Tag>
              ) : (
                <Tag color="default" style={{ margin: 0 }}>不可语义搜索</Tag>
              )}
            </Space>
            {material.category && (
              <Tag>
                {material.source_declaration === 'reference'
                  ? REFERENCE_CATEGORY_LABELS[material.category] || material.category
                  : MATERIAL_CATEGORY_LABELS[material.category] || material.category}
              </Tag>
            )}
            {material.source_declaration === 'reference' && material.reference_analysis?.hook && (
              <Text type="secondary" ellipsis style={{ fontSize: 12, display: 'block', maxWidth: '100%' }}>
                Hook: {material.reference_analysis.hook}
              </Text>
            )}
          </Space>
        }
      />
      {previewSrc && (
        <Modal
          open={previewOpen}
          title={material.name}
          footer={null}
          centered
          destroyOnClose
          width="fit-content"
          styles={{ body: { padding: 0, backgroundColor: '#000' } }}
          onCancel={(event) => {
            event.stopPropagation();
            setPreviewOpen(false);
          }}
          modalRender={(node) => (
            <div onClick={(e) => e.stopPropagation()}>{node}</div>
          )}
        >
          {isVideo ? (
            <video
              src={material.url}
              controls
              autoPlay
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '76vh',
                margin: '0 auto',
              }}
            />
          ) : (
            <img
              src={previewSrc}
              alt={material.name}
              onClick={handlePreview}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '76vh',
                margin: '0 auto',
                objectFit: 'contain',
              }}
            />
          )}
        </Modal>
      )}
    </Card>
  );
}
