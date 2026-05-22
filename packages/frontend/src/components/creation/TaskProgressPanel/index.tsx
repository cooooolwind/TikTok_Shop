import { Card, Progress, Steps, Typography, Space, Descriptions } from 'antd';
import type { GenerationTask } from '@aigc/shared-types';
import StatusTag from '../../common/StatusTag';
import { TASK_STATUS_LABELS } from '../../../constants';

const { Text, Title } = Typography;

/**
 * 动画：根据进度和步骤缩放 pulse
 * 底部 CSS keyframes 定义，通过 animation 激活
 */

interface TaskProgressPanelProps {
  task: GenerationTask;
}

export default function TaskProgressPanel({ task }: TaskProgressPanelProps) {
  const isActive = task.status === 'queued' || task.status === 'processing';
  const isDone = task.status === 'done';

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>任务进度</Title>
          <StatusTag status={task.status} labels={TASK_STATUS_LABELS} />
        </div>

        {isActive && (
          <>
            <Progress
              percent={task.progress.percentage}
              status="active"
              strokeColor={{ from: '#1677ff', to: '#52c41a' }}
            />
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label="当前阶段">{task.progress.step_name}</Descriptions.Item>
              <Descriptions.Item label="步骤">{task.progress.current_step} / {task.progress.total_steps}</Descriptions.Item>
              <Descriptions.Item label="预计剩余">{task.progress.estimated_remaining}s</Descriptions.Item>
            </Descriptions>
            <Text type="secondary">{task.progress.message}</Text>
          </>
        )}

        {isDone && task.result && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="时长">{task.result.duration}s</Descriptions.Item>
            <Descriptions.Item label="分辨率">{task.result.resolution}</Descriptions.Item>
            <Descriptions.Item label="画幅">{task.result.aspect_ratio}</Descriptions.Item>
            <Descriptions.Item label="文件大小">{task.result.file_size} B</Descriptions.Item>
          </Descriptions>
        )}

        {task.status === 'failed' && task.error && (
          <Card size="small" style={{ background: '#fff2f0' }}>
            <Text type="danger">{task.error.message}</Text>
            {task.error.retryable && <Text type="secondary" style={{ marginLeft: 8 }}>（可重试）</Text>}
          </Card>
        )}
      </Space>
    </Card>
  );
}
