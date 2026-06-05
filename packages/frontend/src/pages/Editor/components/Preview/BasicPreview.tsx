import { useRef, useEffect, useCallback, useState } from 'react';
import type { VideoSegmentResult } from '@aigc/shared-types';
import { useEditorStore } from '../../../../stores/useEditorStore';

interface BasicPreviewProps {
  segmentByIndex: Map<number, VideoSegmentResult>;
  defaultUrl?: string;
}

export function BasicPreview({ segmentByIndex, defaultUrl }: BasicPreviewProps) {
  const { clips, playheadSeconds, selection, setPlayhead, setSelection } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekingRef = useRef(false);
  const [sequentialIndex, setSequentialIndex] = useState<number>(0);

  const currentClipIndex = selection?.type === 'clip'
    ? clips.findIndex((c) => c.id === selection.id)
    : sequentialIndex;

  const activeClip = clips[currentClipIndex] ?? clips[0];
  const activeSegment = activeClip
    ? segmentByIndex.get(activeClip.segment_index)
    : undefined;
  const previewUrl = activeSegment?.video_url ?? defaultUrl;

  const calculateGlobalTime = useCallback(
    (clipIndex: number, clipLocalTime: number): number => {
      let offset = 0;
      for (let i = 0; i < clipIndex; i++) {
        offset += Math.max(clips[i].end_seconds - clips[i].start_seconds, 0);
      }
      return offset + clipLocalTime;
    },
    [clips],
  );

  const calculateClipLocalTime = useCallback(
    (globalTime: number): { clipIndex: number; localTime: number } => {
      let offset = 0;
      for (let i = 0; i < clips.length; i++) {
        const dur = Math.max(clips[i].end_seconds - clips[i].start_seconds, 0);
        if (globalTime >= offset && globalTime <= offset + dur) {
          return { clipIndex: i, localTime: clips[i].start_seconds + (globalTime - offset) };
        }
        offset += dur;
      }
      return { clipIndex: 0, localTime: 0 };
    },
    [clips],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;

    const { clipIndex, localTime } = calculateClipLocalTime(playheadSeconds);

    if (clipIndex === currentClipIndex && Number.isFinite(video.duration)) {
      seekingRef.current = true;
      video.currentTime = Math.max(0, Math.min(video.duration, localTime - activeClip.start_seconds));
    }
  }, [playheadSeconds, activeClip, currentClipIndex, calculateClipLocalTime]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || seekingRef.current) {
      seekingRef.current = false;
      return;
    }
    if (!activeClip) return;
    const globalTime = calculateGlobalTime(currentClipIndex, activeClip.start_seconds + video.currentTime);
    setPlayhead(Math.max(0, globalTime));
  }, [activeClip, currentClipIndex, calculateGlobalTime, setPlayhead]);

  const handleEnded = useCallback(() => {
    if (selection?.type === 'clip') return;
    const nextIndex = currentClipIndex + 1;
    if (nextIndex < clips.length) {
      setSequentialIndex(nextIndex);
      setSelection(null);
    } else {
      setSequentialIndex(0);
    }
  }, [currentClipIndex, clips.length, selection, setSelection]);

  useEffect(() => {
    seekingRef.current = true;
  }, [activeClip]);

  const handlePlayClick = useCallback(() => {
    setSequentialIndex(0);
    videoRef.current?.play();
  }, []);

  return (
    <div style={{ background: '#000', borderRadius: 6, textAlign: 'center', minHeight: 200 }}>
      {previewUrl ? (
        <div>
          <video
            ref={videoRef}
            key={activeClip?.id ?? 'preview'}
            src={previewUrl}
            controls
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onSeeked={() => { seekingRef.current = false; }}
            style={{ maxWidth: '100%', maxHeight: '52vh', borderRadius: 4 }}
          />
          {clips.length > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
              }}
            >
              <span style={{ color: '#888', fontSize: 11 }}>
                {selection?.type === 'clip'
                  ? '当前选中片段'
                  : `顺序播放 ${currentClipIndex + 1}/${clips.length}`}
              </span>
              {selection?.type !== 'clip' && (
                <button
                  onClick={handlePlayClick}
                  style={{
                    background: '#1677ff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 3,
                    padding: '2px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  从头播放全部
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 80, color: '#999' }}>选择片段进行预览</div>
      )}
    </div>
  );
}
