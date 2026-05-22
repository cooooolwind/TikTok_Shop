import { Card, Image, Tag, Space, Typography } from 'antd';
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
  const isVideo = material.type === 'video';

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
            <Image
              src={material.thumbnail_url}
              alt={material.filename}
              preview={{ mask: <EyeOutlined /> }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
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
        <EyeOutlined key="view" onClick={onClick} />,
        <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} />,
      ]}
      onClick={onClick}
    >
      <Card.Meta
        title={
          <Text ellipsis style={{ maxWidth: '100%' }} title={material.filename}>
            {material.filename}
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
