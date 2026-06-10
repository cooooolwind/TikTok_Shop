import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Progress, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { GenerationTask, VideoSegmentResult } from '@aigc/shared-types';
import StatusTag from '../../common/StatusTag';
import { TASK_STATUS_LABELS } from '../../../constants';
import { formatDisplayProgress, formatProgressTime, getDisplayProgress } from './progress';

const { Text, Title } = Typography;

interface TaskProgressPanelProps {
  task: GenerationTask;
}

function isSegmentSucceeded(segment: VideoSegmentResult | undefined) {
  return segment?.status === 'succeeded' || Boolean(segment?.video_url);
}

function getSegmentItems(task: GenerationTask) {
  const progress = getDisplayProgress(task);
  const segmentTotal = progress.segment_total ?? task.result?.segments?.length ?? 0;
  if (!segmentTotal) return [];

  return Array.from({ length: segmentTotal }, (_, index) => {
    const segment = task.result?.segments?.find((item) => item.index === index);
    const current = progress.segment_index === index + 1;
    return {
      title: `镜头 ${index + 1}`,
      description: getSegmentDescription(segment, current),
      status: getSegmentStepStatus(segment, current, task.status),
    };
  });
}

function getSegmentDescription(segment: VideoSegmentResult | undefined, current: boolean) {
  if (segment?.status === 'failed') return '失败';
  if (isSegmentSucceeded(segment)) return '已完成';
  if (current) return '生成中';
  if (segment?.status === 'submitted' || segment?.status === 'running') return '等待中';
  return '待生成';
}

function getSegmentStepStatus(
  segment: VideoSegmentResult | undefined,
  current: boolean,
  taskStatus: GenerationTask['status'],
) {
  if (segment?.status === 'failed') return 'error' as const;
  if (isSegmentSucceeded(segment)) return 'finish' as const;
  if (segment?.status === 'submitted' || segment?.status === 'running') return 'process' as const;
  if (current && taskStatus !== 'failed') return 'process' as const;
  return 'wait' as const;
}

function getSegmentTagProps(status: ReturnType<typeof getSegmentStepStatus>) {
  switch (status) {
    case 'error':
      return { color: 'error' as const, icon: <CloseCircleOutlined /> };
    case 'finish':
      return { color: 'success' as const, icon: <CheckCircleOutlined /> };
    case 'process':
      return { color: 'processing' as const, icon: <LoadingOutlined spin /> };
    default:
      return { color: 'default' as const };
  }
}

function getSegmentDurationSeconds(segment: VideoSegmentResult) {
  if (!segment.started_at || !segment.completed_at) return null;
  const startedAt = new Date(segment.started_at).getTime();
  const completedAt = new Date(segment.completed_at).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt <= startedAt) return null;
  return Math.round((completedAt - startedAt) / 1000);
}

function estimateRemainingFromSegments(task: GenerationTask, fallbackSeconds: number) {
  const progress = getDisplayProgress(task);
  const segmentTotal = progress.segment_total ?? task.result?.segments?.length ?? 0;
  if (!segmentTotal || task.status !== 'processing') return fallbackSeconds;

  const succeededSegments = (task.result?.segments ?? []).filter(isSegmentSucceeded);
  const measuredDurations = succeededSegments
    .map(getSegmentDurationSeconds)
    .filter((value): value is number => value !== null && value > 0);
  const averageSeconds =
    measuredDurations.length > 0
      ? measuredDurations.reduce((sum, value) => sum + value, 0) / measuredDurations.length
      : Math.max(fallbackSeconds / Math.max(segmentTotal, 1), 60);
  const remainingSegments = Math.max(segmentTotal - succeededSegments.length, 0);
  return Math.round(remainingSegments * averageSeconds);
}

export default function TaskProgressPanel({ task }: TaskProgressPanelProps) {
  const isActive = task.status === 'queued' || task.status === 'processing';
  const isDone = task.status === 'done';
  const progress = getDisplayProgress(task);
  const [now, setNow] = useState(() => Date.now());
  const [progressUpdatedAt, setProgressUpdatedAt] = useState(() => Date.now());
  const segmentItems = getSegmentItems(task);
  const completedSegments = task.result?.segments?.filter(isSegmentSucceeded).length ?? 0;
  const totalSegments = task.result?.segments?.length ?? progress.segment_total ?? 0;
  const progressIdentity = `${progress.phase ?? progress.step_name}:${progress.segment_index ?? 0}:${progress.percentage}:${progress.message}`;

  useEffect(() => {
    setProgressUpdatedAt(Date.now());
  }, [progressIdentity]);

  useEffect(() => {
    if (!isActive) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const displayElapsedSeconds = useMemo(() => {
    if (!isActive) return progress.elapsed_seconds;
    return (progress.elapsed_seconds ?? 0) + Math.max(Math.floor((now - progressUpdatedAt) / 1000), 0);
  }, [isActive, now, progress.elapsed_seconds, progressUpdatedAt]);
  const displayRemainingSeconds = estimateRemainingFromSegments(task, progress.estimated_remaining);

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Title level={5} style={{ margin: 0 }}>
            视频生成进度
          </Title>
          <StatusTag status={task.status} labels={TASK_STATUS_LABELS} />
        </div>

        {(isActive || task.status === 'failed') && (
          <>
            <Progress
              percent={progress.percentage}
              status={task.status === 'failed' ? 'exception' : 'active'}
              strokeColor={task.status === 'failed' ? undefined : { from: '#1677ff', to: '#52c41a' }}
            />
            {segmentItems.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {segmentItems.map((item, index) => (
                  <Tag key={index} {...getSegmentTagProps(item.status)}>
                    镜头 {index + 1}
                  </Tag>
                ))}
                <Tag>已用时 {formatProgressTime(displayElapsedSeconds)}</Tag>
                <Tag>预计剩余 {formatProgressTime(displayRemainingSeconds)}</Tag>
              </div>
            )}
            <Text type="secondary">{formatDisplayProgress(progress)}</Text>
          </>
        )}

        {isDone && task.result && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="success"
              showIcon
              message={`已生成 ${totalSegments || 1} 个分镜片段`}
              description="完整视频会在点击“导出完整视频”时按需拼接。"
            />
            {segmentItems.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {segmentItems.map((item, index) => (
                  <Tag key={index} {...getSegmentTagProps(item.status)}>
                    镜头 {index + 1}
                  </Tag>
                ))}
              </div>
            )}
            <Space wrap>
              <Tag>总时长 {task.result.duration}s</Tag>
              <Tag>{task.result.resolution}</Tag>
              <Tag>{task.result.aspect_ratio}</Tag>
              <Tag>
                完成 {completedSegments || totalSegments || 1}/{totalSegments || 1}
              </Tag>
            </Space>
          </Space>
        )}

        {task.status === 'failed' && task.error && (
          <Alert
            type="error"
            showIcon
            message={task.error.segment_index ? `第 ${task.error.segment_index} 个镜头生成失败` : '视频生成失败'}
            description={
              <Space direction="vertical" size={4}>
                <Text>{task.error.message}</Text>
                {task.error.category && <Text type="secondary">错误类型：{task.error.category}</Text>}
                {task.error.user_action && <Text type="secondary">{task.error.user_action}</Text>}
                {task.error.retryable && <Text type="secondary">已生成的分镜片段会保留，可从失败镜头继续。</Text>}
              </Space>
            }
          />
        )}
      </Space>
    </Card>
  );
}
