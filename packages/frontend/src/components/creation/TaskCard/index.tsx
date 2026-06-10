import { useRef, useState } from 'react';
import { Typography } from 'antd';
import { DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import type { GenerationTask } from '@aigc/shared-types';
import StatusTag from '../../common/StatusTag';
import { TASK_STATUS_LABELS } from '../../../constants';
import { formatBeijingDateTime, formatGenerationTaskDisplayId } from '../../../utils/format';
import styles from './index.module.css';

const { Text } = Typography;

interface TaskCardProps {
  task: GenerationTask;
  onClick?: () => void;
  onDelete?: () => void;
}

function getCardAspect(task: GenerationTask): number {
  const ratio = task.result?.aspect_ratio ?? '9:16';
  const [w, h] = ratio.split(':').map(Number);
  return (w || 9) / (h || 16);
}

export default function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const isDone = task.status === 'done';
  const isActive = task.status === 'queued' || task.status === 'processing';
  const isFailed = task.status === 'failed';
  const [hovering, setHovering] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const segmentPreviewUrl = isDone ? task.result?.segments?.[0]?.video_url : undefined;
  const thumbnailUrl = isDone ? task.result?.thumbnail_url : undefined;
  const hasPreview = Boolean(segmentPreviewUrl);
  const aspectRatio = getCardAspect(task);

  const showPreview = hovering && hasPreview;

  const handleMouseEnter = () => {
    setHovering(true);
    if (videoRef.current && segmentPreviewUrl) {
      videoRef.current.src = segmentPreviewUrl;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
      setVideoLoaded(false);
    }
  };

  const handleVideoLoaded = () => setVideoLoaded(true);

  return (
    <div
      className={styles.card}
      style={{ aspectRatio: `${aspectRatio.toFixed(2)}` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {hasPreview && (
        <video
          ref={videoRef}
          className={`${styles.videoPreview} ${showPreview && videoLoaded ? styles.visible : ''}`}
          muted
          loop
          playsInline
          disablePictureInPicture
          onLoadedData={handleVideoLoaded}
        />
      )}

      {thumbnailUrl && (
        <img
          className={`${styles.thumbnail} ${showPreview && videoLoaded ? styles.hidden : ''}`}
          src={thumbnailUrl}
          alt=""
          loading="lazy"
        />
      )}

      {!thumbnailUrl && !hasPreview && (
        <div className={styles.placeholder}>
          {isActive && <LoadingOutlined spin style={{ fontSize: 28, color: '#1677ff' }} />}
          {isFailed && <Text type="danger" style={{ fontSize: 13 }}>生成失败</Text>}
          {task.status === 'queued' && <Text type="secondary" style={{ fontSize: 13 }}>排队中</Text>}
        </div>
      )}

      <div className={styles.overlay}>
        <div className={styles.topRow}>
          <Text className={styles.taskName}>
            {formatGenerationTaskDisplayId(task)}
          </Text>
          <StatusTag status={task.status} labels={TASK_STATUS_LABELS} />
        </div>

        <div className={styles.bottomRow}>
          <div>
            {isDone && task.result && (
              <Text className={styles.infoText}>
                {task.result.duration}秒 · {task.result.resolution}
              </Text>
            )}
            {isActive && (
              <Text className={styles.infoText}>
                {task.progress?.percentage ?? 0}%
              </Text>
            )}
            {isFailed && task.error && (
              <Text className={styles.infoText} style={{ color: '#ff4d4f' }}>
                {task.error.message?.slice(0, 60)}
              </Text>
            )}
            <Text className={styles.timeText}>
              {formatBeijingDateTime(task.created_at)}
            </Text>
          </div>
          {onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="删除任务"
            >
              <DeleteOutlined />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
