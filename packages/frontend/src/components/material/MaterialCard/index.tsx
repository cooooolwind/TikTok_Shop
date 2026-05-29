import { useState } from 'react';
import { Button, Card, Image, Modal, Tag, Space, Typography } from 'antd';
import {
  FileImageOutlined,
  VideoCameraOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { Material } from '@aigc/shared-types';
import StatusTag from '../../common/StatusTag';
import { MATERIAL_STATUS_LABELS } from '../../../constants';
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
  const isVideo = material.type === 'video';
  const previewSrc = material.url || material.thumbnail_url;

  const handlePreview = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (isVideo || !previewSrc) {
      onClick?.();
      return;
    }
    setPreviewOpen(true);
  };

  return (
    <Card
      hoverable
      style={{
        borderColor: selected ? '#1677ff' : undefined,
        borderWidth: selected ? 2 : 1,
      }}
      cover={
        <div style={{ position: 'relative', height: 160, overflow: 'hidden', background: '#f5f5f5' }}>
          {material.thumbnail_url ? (
            <>
              <Image
                src={material.thumbnail_url}
                alt={material.name}
                preview={false}
                onClick={(event) => event.stopPropagation()}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
              {!isVideo && previewSrc && (
                <>
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    aria-label="预览图片"
                    onClick={handlePreview}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      color: '#fff',
                      fontSize: 20,
                      background: 'rgba(0, 0, 0, 0)',
                    }}
                  />
                  <Modal
                    open={previewOpen}
                    title={material.name}
                    footer={null}
                    centered
                    width="min(92vw, 960px)"
                    onCancel={(event) => {
                      event.stopPropagation();
                      setPreviewOpen(false);
                    }}
                    modalRender={(node) => (
                      <div onClick={(event) => event.stopPropagation()}>{node}</div>
                    )}
                  >
                    <img
                      src={previewSrc}
                      alt={material.name}
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        maxHeight: '76vh',
                        margin: '0 auto',
                        objectFit: 'contain',
                      }}
                    />
                  </Modal>
                </>
              )}
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
          <Text ellipsis style={{ maxWidth: '100%' }} title={material.name}>
            {material.name}
          </Text>
        }
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{formatBytes(material.size)}</Text>
            <div>
              <StatusTag status={material.status} labels={MATERIAL_STATUS_LABELS} />
            </div>
            {material.category && (
              <Tag>{material.category}</Tag>
            )}
          </Space>
        }
      />
    </Card>
  );
}
