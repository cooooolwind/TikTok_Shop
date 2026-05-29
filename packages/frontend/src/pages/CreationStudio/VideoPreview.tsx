import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Descriptions, List, Space, Spin, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useCreationStore } from '../../stores/useGenerationStore';
import { formatBytes, formatDuration, formatGenerationTaskDisplayId } from '../../utils/format';
import { openExportWindow } from '../../utils/exportWindow';

const { Text } = Typography;

export default function VideoPreview() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { currentTask, fetchTask, exportVideo } = useCreationStore();
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (taskId) fetchTask(taskId);
  }, [taskId]);

  const t = currentTask;
  const result = t?.result;

  useEffect(() => {
    setActiveSegmentIndex(null);
  }, [result?.video_url]);

  const segments = useMemo(
    () =>
      result?.segments?.length
        ? result.segments
        : result
          ? [
              {
                index: 0,
                video_url: result.video_url,
                thumbnail_url: result.thumbnail_url,
                duration: result.duration,
                resolution: result.resolution,
                aspect_ratio: result.aspect_ratio,
                scene_orders: [],
              },
            ]
          : [],
    [result],
  );
  const activeSegment = activeSegmentIndex === null ? undefined : segments[activeSegmentIndex] ?? segments[0];
  const activeVideoUrl = activeSegment?.video_url ?? result?.video_url;
  const activeAspectRatio = activeSegment?.aspect_ratio ?? result?.aspect_ratio;
  const activeResolution = activeSegment?.resolution ?? result?.resolution;

  if (!t) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const handleExport = async () => {
    if (!result) return;
    const exportWindow = openExportWindow();
    try {
      const exported = await exportVideo(
        t.id,
        'mp4',
        result.resolution as '1080x1920' | '1920x1080' | '720x1280',
        'high',
      );
      exportWindow.redirect(exported.download_url);
      await fetchTask(t.id);
    } catch (error) {
      exportWindow.close();
      throw error;
    }
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
            <Button
              aria-label="导出完整视频"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!result?.video_url}
            >
              导出完整视频
            </Button>
          </Space>
        }
      />

      <Card style={{ marginBottom: 24, textAlign: 'center', background: '#000' }}>
        {activeVideoUrl ? (
          <video
            aria-label="video preview"
            key={activeVideoUrl}
            src={activeVideoUrl}
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

      {segments.length > 1 && (
        <Card title="分段视频" style={{ marginBottom: 24 }}>
          <List
            grid={{ gutter: 12, xs: 1, sm: 2, md: 3, lg: 4 }}
            dataSource={segments}
            renderItem={(segment) => (
              <List.Item>
                <Card
                  size="small"
                  hoverable
                  aria-label={`preview segment ${segment.index + 1}`}
                  onClick={() => setActiveSegmentIndex(segment.index)}
                  style={{
                    borderColor: activeSegmentIndex === segment.index ? '#1677ff' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <Space direction="vertical" size={6}>
                    <Text strong>第 {segment.index + 1} 段</Text>
                    <Space wrap>
                      <Tag>{formatDuration(segment.duration)}</Tag>
                      <Tag>{segment.resolution}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      分镜 {segment.scene_orders.length ? segment.scene_orders.join(', ') : '-'}
                    </Text>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </Card>
      )}

      {result && (
        <Card title="视频信息">
          <Descriptions column={3} size="small" bordered>
            <Descriptions.Item label="总时长">{formatDuration(result.duration)}</Descriptions.Item>
            <Descriptions.Item label="分段数">{segments.length}</Descriptions.Item>
            <Descriptions.Item label="当前画幅">{activeAspectRatio}</Descriptions.Item>
            <Descriptions.Item label="当前分辨率">{activeResolution}</Descriptions.Item>
            <Descriptions.Item label="文件大小">{formatBytes(result.file_size)}</Descriptions.Item>
            <Descriptions.Item label="任务 ID">{formatGenerationTaskDisplayId(t)}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
