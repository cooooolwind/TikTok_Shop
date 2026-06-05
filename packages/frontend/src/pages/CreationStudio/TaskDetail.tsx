import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Descriptions, Row, Space, Spin, Tag } from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import TaskProgressPanel from '../../components/creation/TaskProgressPanel';
import StatusTag from '../../components/common/StatusTag';
import { useCreationStore } from '../../stores/useGenerationStore';
import { useTaskSubscription } from '../../hooks/useTaskSubscription';
import { TASK_STATUS_LABELS, routePath } from '../../constants';
import { formatBeijingDateTime, formatBytes, formatDuration, formatGenerationTaskDisplayId } from '../../utils/format';
import { openExportWindow } from '../../utils/exportWindow';

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const {
    currentTask,
    loading,
    creating,
    fetchTask,
    retry,
    cancel,
    exportVideo,
    createVideo,
  } = useCreationStore();
  const [exporting, setExporting] = useState(false);

  useTaskSubscription(taskId);

  useEffect(() => {
    if (taskId) fetchTask(taskId);
  }, [taskId, fetchTask]);

  if (loading || !currentTask) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const task = currentTask;
  const isActive = task.status === 'queued' || task.status === 'processing';
  const segments = task.result?.segments ?? [];

  const handleRetry = () => retry(task.id);
  const handleCancel = () => cancel(task.id);
  const handleEditScript = () => navigate(`/scripts/${task.script_id}?returnTask=${task.id}`);
  const handleCreateAgain = async () => {
    const nextTask = await createVideo({ script_id: task.script_id });
    navigate(`/creation/tasks/${nextTask.id}`);
  };
  const handleExport = async () => {
    setExporting(true);
    const exportWindow = openExportWindow();
    try {
      const result = await exportVideo(task.id, 'mp4', '1080x1920', 'high');
      exportWindow.redirect(result.download_url);
      await fetchTask(task.id);
    } catch (error) {
      exportWindow.close();
      throw error;
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="任务详情"
        breadcrumbs={[
          { title: '创作工作室', path: '/creation' },
          { title: `任务 ${formatGenerationTaskDisplayId(task)}` },
        ]}
        extra={
          <Space>
            {task.status === 'failed' && task.error?.retryable && (
              <Button icon={<ReloadOutlined />} onClick={handleRetry}>
                从失败镜头继续
              </Button>
            )}
            {isActive && (
              <Button icon={<StopOutlined />} danger onClick={handleCancel}>
                取消
              </Button>
            )}
            {task.status === 'done' && (
              <>
                <Button icon={<EditOutlined />} onClick={handleEditScript}>
                  修改剧本
                </Button>
                <Button icon={<ReloadOutlined />} loading={creating} onClick={handleCreateAgain}>
                  重新生成
                </Button>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => navigate(`/creation/tasks/${task.id}/preview`)}
                >
                  预览
                </Button>
                <Button icon={<EditOutlined />} onClick={() => navigate(routePath.editorTask(task.id))}>
                  视频剪辑
                </Button>
                <Button
                  aria-label="导出完整视频"
                  icon={<DownloadOutlined />}
                  loading={exporting}
                  onClick={handleExport}
                >
                  导出完整视频
                </Button>
              </>
            )}
            {task.status !== 'done' && (
              <Button icon={<EditOutlined />} onClick={handleEditScript}>
                修改剧本
              </Button>
            )}
          </Space>
        }
      />

      <Row gutter={24}>
        <Col xs={24} md={16}>
          <TaskProgressPanel task={task} />

          {task.status === 'done' && task.result && (
            <Card title="视频信息" style={{ marginTop: 16 }}>
              {segments.length > 1 && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={`已生成 ${segments.length} 个分镜片段`}
                  description="完整视频会在点击“导出完整视频”时按需拼接；拼接前可先预览每个分镜片段。"
                />
              )}
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="时长">{formatDuration(task.result.duration)}</Descriptions.Item>
                <Descriptions.Item label="分辨率">{task.result.resolution}</Descriptions.Item>
                <Descriptions.Item label="画幅">{task.result.aspect_ratio}</Descriptions.Item>
                <Descriptions.Item label="文件大小">{formatBytes(task.result.file_size)}</Descriptions.Item>
                {segments.length > 0 && <Descriptions.Item label="分镜片段">{segments.length}</Descriptions.Item>}
              </Descriptions>
              {task.result.thumbnail_url && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <img
                    src={task.result.thumbnail_url}
                    alt="视频缩略图"
                    style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 280 }}
                  />
                </div>
              )}
            </Card>
          )}

          {task.status === 'failed' && task.error && (
            <Card title="错误详情" style={{ marginTop: 16, borderColor: '#ff4d4f' }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="错误码">{task.error.code}</Descriptions.Item>
                <Descriptions.Item label="错误信息">{task.error.message}</Descriptions.Item>
                {task.error.segment_index && (
                  <Descriptions.Item label="失败镜头">第 {task.error.segment_index} 个镜头</Descriptions.Item>
                )}
                {task.error.category && (
                  <Descriptions.Item label="错误类型">
                    <Tag color={task.error.category === 'moderation' ? 'red' : 'orange'}>
                      {task.error.category}
                    </Tag>
                  </Descriptions.Item>
                )}
                {task.error.user_action && (
                  <Descriptions.Item label="建议操作">{task.error.user_action}</Descriptions.Item>
                )}
                <Descriptions.Item label="可重试">{task.error.retryable ? '是' : '否'}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>

        <Col xs={24} md={8}>
          <Card title="任务信息" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="任务 ID">
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {formatGenerationTaskDisplayId(task)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="关联剧本">{task.script_display_id ?? task.script_id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={task.status} labels={TASK_STATUS_LABELS} />
              </Descriptions.Item>
              <Descriptions.Item label="重试次数">{task.retry_count}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatBeijingDateTime(task.created_at)}</Descriptions.Item>
              {task.completed_at && (
                <Descriptions.Item label="完成时间">{formatBeijingDateTime(task.completed_at)}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
