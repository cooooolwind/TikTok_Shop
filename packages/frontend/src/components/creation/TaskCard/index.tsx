<<<<<<< HEAD
import { Button, Card, Progress, Space, Typography, Tag, Tooltip } from 'antd';
=======
import { Button, Card, Progress, Space, Tag, Tooltip, Typography } from 'antd';
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
import { ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { GenerationTask } from '@aigc/shared-types';
import StatusTag from '../../common/StatusTag';
import { TASK_STATUS_LABELS } from '../../../constants';
import { getDisplayProgress } from '../TaskProgressPanel/progress';
import { formatBeijingDateTime, formatGenerationTaskDisplayId } from '../../../utils/format';

const { Text } = Typography;

interface TaskCardProps {
  task: GenerationTask;
  onClick?: () => void;
  onDelete?: () => void;
}

<<<<<<< HEAD
=======
function compactErrorMessage(message: string) {
  if (!message) return '生成失败';
  const codeMatch = message.match(/"code"\s*:\s*"([^"]+)"/);
  const nestedMessageMatch = message.match(/"message"\s*:\s*"([^"]+)"/);
  if (codeMatch && nestedMessageMatch) return `${codeMatch[1]}：${nestedMessageMatch[1]}`;
  return message.replace(/\s+/g, ' ').trim();
}

>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
export default function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const isActive = task.status === 'queued' || task.status === 'processing';
  const isDone = task.status === 'done';
  const progress = getDisplayProgress(task);
  const errorMessage = compactErrorMessage(task.error?.message ?? '');

  return (
    <Card
      hoverable
      onClick={onClick}
      bodyStyle={{
        height: 136,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      style={{ cursor: 'pointer', height: '100%', width: '100%', overflow: 'hidden' }}
    >
<<<<<<< HEAD
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
=======
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 8, alignItems: 'center' }}>
          <Text strong ellipsis style={{ minWidth: 0 }}>
            任务 {formatGenerationTaskDisplayId(task)}
          </Text>
          <StatusTag status={task.status} labels={TASK_STATUS_LABELS} />
          {onDelete && (
            <Tooltip title="删除任务">
              <Button
                danger
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
              />
            </Tooltip>
          )}
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
        </div>

        <div style={{ height: 40, minHeight: 40, maxHeight: 40, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          {isActive && (
            <Progress
              percent={progress.percentage}
              size="small"
              style={{ width: '100%' }}
              format={() => progress.message}
            />
          )}

          {isDone && task.result && (
            <Space size={8} wrap={false}>
              <Tag icon={<ClockCircleOutlined />}>{task.result.duration}s</Tag>
              <Tag>{task.result.resolution}</Tag>
            </Space>
          )}

          {task.status === 'failed' && task.error && (
            <Text
              type="danger"
              style={{
                width: '100%',
                minWidth: 0,
                fontSize: 12,
                lineHeight: '18px',
                maxHeight: 36,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
              }}
            >
              {errorMessage}
            </Text>
          )}
        </div>

        <Text type="secondary" style={{ fontSize: 12, marginTop: 'auto', whiteSpace: 'nowrap' }}>
          创建于 {formatBeijingDateTime(task.created_at)}
        </Text>
      </div>
    </Card>
  );
}
