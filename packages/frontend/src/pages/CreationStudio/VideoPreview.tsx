import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Spin, Descriptions, Typography,
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useCreationStore } from '../../stores/useGenerationStore';
import { formatBytes, formatDuration, formatGenerationTaskDisplayId } from '../../utils/format';

const { Text } = Typography;

export default function VideoPreview() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { currentTask, fetchTask, exportVideo } = useCreationStore();

  useEffect(() => {
    if (taskId) fetchTask(taskId);
  }, [taskId]);

  if (!currentTask) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  const t = currentTask;
  const result = t.result;

  const handleExport = async () => {
    if (!result) return;
    const exported = await exportVideo(t.id, 'mp4', result.resolution as '1080x1920' | '1920x1080' | '720x1280', 'high');
    window.open(exported.download_url, '_blank');
  };

  return (
    <div>
      <PageHeader
        title="视频预览"
        breadcrumbs={[
          { title: '创作工作室', path: '/creation' },
          { title: '任务详情', path: `/creation/tasks/${t.id}` },
          { title: '视频预览' },
        ]}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/creation/tasks/${t.id}`)}>
              返回任务
            </Button>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/scripts/${t.script_id}?returnTask=${t.id}`)}>
              修改剧本
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
              导出视频
            </Button>
          </Space>
        }
      />

      <Card style={{ marginBottom: 24, textAlign: 'center', background: '#000' }}>
        {result?.video_url ? (
          <video
            src={result.video_url}
            controls
            autoPlay
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              borderRadius: 4,
            }}
          />
        ) : (
          <div style={{ padding: 80, color: '#fff' }}>
            <Text style={{ color: '#fff' }}>视频暂不可用</Text>
          </div>
        )}
      </Card>

      {result && (
        <Card title="视频信息">
          <Descriptions column={3} size="small" bordered>
            <Descriptions.Item label="时长">{formatDuration(result.duration)}</Descriptions.Item>
            <Descriptions.Item label="分辨率">{result.resolution}</Descriptions.Item>
            <Descriptions.Item label="画幅比例">{result.aspect_ratio}</Descriptions.Item>
            <Descriptions.Item label="文件大小">{formatBytes(result.file_size)}</Descriptions.Item>
            <Descriptions.Item label="任务 ID">{formatGenerationTaskDisplayId(t)}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
