import { Button, Card, Progress, Space, Typography, Tag, Tooltip } from 'antd';
import { ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { GenerationTask } from '@aigc/shared-types';
import StatusTag from '../../common/StatusTag';
import { TASK_STATUS_LABELS } from '../../../constants';

const { Text } = Typography;

interface TaskCardProps {
  task: GenerationTask;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const isActive = task.status === 'queued' || task.status === 'processing';
  const isDone = task.status === 'done';

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong ellipsis style={{ maxWidth: 200 }}>任务 {task.id}</Text>
          <Space size={4}>
            <StatusTag status={task.status} labels={TASK_STATUS_LABELS} />
            {onDelete && !isActive && (
              <Tooltip title="删除任务">
                <Button
                  aria-label="delete task"
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                  }}
                />
              </Tooltip>
            )}
          </Space>
        </div>

        {isActive && (
          <Progress
            percent={task.progress.percentage}
            size="small"
            format={() => task.progress.message}
          />
        )}

        {isDone && task.result && (
          <Space>
            <Tag icon={<ClockCircleOutlined />}>
              {task.result.duration}s
            </Tag>
            <Tag>{task.result.resolution}</Tag>
          </Space>
        )}

        {task.status === 'failed' && task.error && (
          <Text type="danger" style={{ fontSize: 12 }}>{task.error.message}</Text>
        )}

        <Text type="secondary" style={{ fontSize: 12 }}>
          创建于 {new Date(task.created_at).toLocaleString()}
        </Text>
      </Space>
    </Card>
  );
}
