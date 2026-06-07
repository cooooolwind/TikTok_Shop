import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Descriptions, List, Space, Spin, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useCreationStore } from '../../stores/useGenerationStore';
import { routePath } from '../../constants';
import { formatBytes, formatDuration, formatGenerationTaskDisplayId } from '../../utils/format';

const { Text } = Typography;

export default function VideoPreview() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { currentTask, fetchTask, exportVideo } = useCreationStore();
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [completeVideoUrl, setCompleteVideoUrl] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (taskId) fetchTask(taskId);
  }, [fetchTask, taskId]);

  const task = currentTask;
  const result = task?.result;

  useEffect(() => {
    setActiveSegmentIndex(null);
    setCompleteVideoUrl(result?.video_url?.startsWith('/uploads/generated/') ? result.video_url : undefined);
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

  const previewItems = useMemo(() => {
    const items = [...segments];
    if (completeVideoUrl && result) {
      items.push({
        index: -1,
        video_url: completeVideoUrl,
        thumbnail_url: result.thumbnail_url,
        duration: result.duration,
        resolution: result.resolution,
        aspect_ratio: result.aspect_ratio,
        scene_orders: [],
      });
    }
    return items;
  }, [completeVideoUrl, result, segments]);

  const activeSegment = activeSegmentIndex === null ? undefined : segments[activeSegmentIndex] ?? segments[0];
  const activeVideoUrl = activeSegment?.video_url ?? completeVideoUrl ?? result?.video_url;
  const activeAspectRatio = activeSegment?.aspect_ratio ?? result?.aspect_ratio;
  const activeResolution = activeSegment?.resolution ?? result?.resolution;

  if (!task) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const exported = await exportVideo(
        task.id,
        'mp4',
        result.resolution as '1080x1920' | '1920x1080' | '720x1280',
        'high',
      );
      setCompleteVideoUrl(exported.download_url);
      setActiveSegmentIndex(null);
      await fetchTask(task.id);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="视频预览"
        breadcrumbs={[
          { title: '创作工作室', path: '/creation' },
          { title: '任务详情', path: `/creation/tasks/${task.id}` },
          { title: '视频预览' },
        ]}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/creation/tasks/${task.id}`)}>
              返回任务
            </Button>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/scripts/${task.script_id}?returnTask=${task.id}`)}>
              修改脚本
            </Button>
            {!isMobile && (
              <Button icon={<EditOutlined />} onClick={() => navigate(routePath.editorTask(task.id))}>
                视频剪辑
              </Button>
            )}
            <Button
              aria-label="导出完整视频"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!result?.video_url}
              loading={exporting}
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

      {previewItems.length > 1 && (
        <Card title="分段视频" style={{ marginBottom: 24 }}>
          <List
            grid={{ gutter: 12, xs: 1, sm: 2, md: 3, lg: 4 }}
            dataSource={previewItems}
            renderItem={(item) => {
              const isComplete = item.index === -1;
              const isActive = isComplete ? activeSegmentIndex === null : activeSegmentIndex === item.index;
              return (
                <List.Item>
                  <Card
                    size="small"
                    hoverable
                    aria-label={isComplete ? 'preview complete video' : `preview segment ${item.index + 1}`}
                    onClick={() => setActiveSegmentIndex(isComplete ? null : item.index)}
                    style={{
                      borderColor: isActive ? '#1677ff' : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <Space direction="vertical" size={6}>
                      <Text strong>{isComplete ? '完整视频' : `第 ${item.index + 1} 段`}</Text>
                      <Space wrap>
                        <Tag>{formatDuration(item.duration)}</Tag>
                        <Tag>{item.resolution}</Tag>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {isComplete ? '全部分段' : `分镜 ${item.scene_orders.length ? item.scene_orders.join(', ') : '-'}`}
                      </Text>
                    </Space>
                  </Card>
                </List.Item>
              );
            }}
          />
        </Card>
      )}

      {result && (
        <Card title="视频信息">
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
            <Descriptions.Item label="总时长">{formatDuration(result.duration)}</Descriptions.Item>
            <Descriptions.Item label="分段数">{segments.length}</Descriptions.Item>
            <Descriptions.Item label="当前画幅">{activeAspectRatio}</Descriptions.Item>
            <Descriptions.Item label="当前分辨率">{activeResolution}</Descriptions.Item>
            <Descriptions.Item label="文件大小">{formatBytes(result.file_size)}</Descriptions.Item>
            <Descriptions.Item label="任务 ID">{formatGenerationTaskDisplayId(task)}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
