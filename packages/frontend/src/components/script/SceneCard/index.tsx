import { Button, Card, Space, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Scene } from '@aigc/shared-types';
import { formatDuration } from '../../../utils/format';

const { Text, Paragraph } = Typography;

interface SceneCardProps {
  scene: Scene;
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
}

export default function SceneCard({ scene, index, onEdit, onDelete, onRegenerate }: SceneCardProps) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      title={
        <Space>
          <Tag color="blue">第 {index + 1} 镜</Tag>
          <Text type="secondary">{formatDuration(scene.duration)}</Text>
        </Space>
      }
      extra={
        <Space size="small">
          <Tooltip title="重新生成">
            <Button size="small" icon={<ReloadOutlined />} onClick={onRegenerate} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={onEdit} />
          </Tooltip>
          <Tooltip title="删除">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
          </Tooltip>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>画面描述：</Text>
          <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
            {scene.description || '暂无'}
          </Paragraph>
        </div>
        <div>
          <Text strong>台词：</Text>
          <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
            {scene.dialogue || '暂无'}
          </Paragraph>
        </div>
        <Space wrap>
          {scene.camera_motion && <Tag>{scene.camera_motion}</Tag>}
          {scene.bgm_style && <Tag>{scene.bgm_style}</Tag>}
          {scene.subtitle && <Tag color="orange">字幕：{scene.subtitle}</Tag>}
        </Space>
      </Space>
    </Card>
  );
}
