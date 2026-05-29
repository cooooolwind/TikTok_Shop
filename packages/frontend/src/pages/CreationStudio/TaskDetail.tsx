import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Spin, Descriptions, Row, Col,
} from 'antd';
import {
  PlayCircleOutlined, ReloadOutlined, StopOutlined,
  DownloadOutlined, EditOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import TaskProgressPanel from '../../components/creation/TaskProgressPanel';
import StatusTag from '../../components/common/StatusTag';
import { useCreationStore } from '../../stores/useGenerationStore';
import { useTaskSubscription } from '../../hooks/useTaskSubscription';
import { TASK_STATUS_LABELS } from '../../constants';
import { formatBeijingDateTime, formatBytes, formatDuration, formatGenerationTaskDisplayId } from '../../utils/format';

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const {
    currentTask, loading, creating,
    fetchTask, retry, cancel, exportVideo, createVideo,
  } = useCreationStore();

  // 实时进度订阅（WebSocket + 轮询降级）
  useTaskSubscription(taskId);

  useEffect(() => {
    if (taskId) fetchTask(taskId);
  }, [taskId]);

  if (loading || !currentTask) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  const t = currentTask;
  const isActive = t.status === 'queued' || t.status === 'processing';

  const handleRetry = () => retry(t.id);
  const handleCancel = () => cancel(t.id);
  const handleEditScript = () => navigate(`/scripts/${t.script_id}?returnTask=${t.id}`);
  const handleCreateAgain = async () => {
    const nextTask = await createVideo({ script_id: t.script_id });
    navigate(`/creation/tasks/${nextTask.id}`);
  };
  const handleExport = async () => {
    const result = await exportVideo(t.id, 'mp4', '1080x1920', 'high');
    window.open(result.download_url, '_blank');
  };

  return (
    <div>
      <PageHeader
        title="任务详情"
        breadcrumbs={[
          { title: '创作工作室', path: '/creation' },
          { title: `任务 ${formatGenerationTaskDisplayId(t)}` },
        ]}
        extra={
          <Space>
            {t.status === 'failed' && t.error?.retryable && (
              <Button icon={<ReloadOutlined />} onClick={handleRetry}>重试</Button>
            )}
            {isActive && (
              <Button icon={<StopOutlined />} danger onClick={handleCancel}>取消</Button>
            )}
            {t.status === 'done' && (
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
                  onClick={() => navigate(`/creation/tasks/${t.id}/preview`)}
                >
                  预览
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
              </>
            )}
            {t.status !== 'done' && (
              <Button icon={<EditOutlined />} onClick={handleEditScript}>
                修改剧本
              </Button>
            )}
          </Space>
        }
      />

      <Row gutter={24}>
        <Col xs={24} md={16}>
          <TaskProgressPanel task={t} />

          {/* 生成结果详情 */}
          {t.status === 'done' && t.result && (
            <Card title="视频信息" style={{ marginTop: 16 }}>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="时长">{formatDuration(t.result.duration)}</Descriptions.Item>
                <Descriptions.Item label="分辨率">{t.result.resolution}</Descriptions.Item>
                <Descriptions.Item label="画幅">{t.result.aspect_ratio}</Descriptions.Item>
                <Descriptions.Item label="文件大小">{formatBytes(t.result.file_size)}</Descriptions.Item>
              </Descriptions>
              {/* 缩略图预览 */}
              {t.result.thumbnail_url && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <img
                    src={t.result.thumbnail_url}
                    alt="视频缩略图"
                    style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 280 }}
                  />
                </div>
              )}
            </Card>
          )}

          {/* 错误信息 */}
          {t.status === 'failed' && t.error && (
            <Card title="错误详情" style={{ marginTop: 16, borderColor: '#ff4d4f' }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="错误码">{t.error.code}</Descriptions.Item>
                <Descriptions.Item label="错误信息">{t.error.message}</Descriptions.Item>
                <Descriptions.Item label="可重试">{t.error.retryable ? '是' : '否'}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>

        <Col xs={24} md={8}>
          <Card title="任务信息" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="任务 ID">
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatGenerationTaskDisplayId(t)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="关联剧本">{t.script_display_id ?? t.script_id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={t.status} labels={TASK_STATUS_LABELS} />
              </Descriptions.Item>
              <Descriptions.Item label="重试次数">{t.retry_count}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatBeijingDateTime(t.created_at)}
              </Descriptions.Item>
              {t.completed_at && (
                <Descriptions.Item label="完成时间">
                  {formatBeijingDateTime(t.completed_at)}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
