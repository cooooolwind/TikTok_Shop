import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Empty, Input, InputNumber, Select, Space, Spin, Tag, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type {
  ExportRequest,
  SubtitleCue,
  TimelineClip,
  TimelineTransition,
  TransitionType,
  VideoSegmentResult,
} from '@aigc/shared-types';
import { useCreationStore } from '../../stores/useGenerationStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { routePath } from '../../constants';
import { generationApi } from '../../services/generation.api';
import { formatDuration } from '../../utils/format';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Timeline } from './components/Timeline/Timeline';
import styles from './VideoEditor.module.css';

const RemotionPreview = lazy(() => import('./components/Preview/RemotionPreview'));
const { Text, Title } = Typography;

const TRANSITION_DND_TYPE = 'application/timeline-transition';
const SUBTITLE_PROJECT_VERSION = 1;

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('Preview error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.previewError}>
          <Text type="danger" strong>
            整体预览加载失败
          </Text>
          <Text type="secondary" className={styles.previewErrorText}>
            {this.state.message || '请确认视频文件可访问后重试'}
          </Text>
          <Button size="small" onClick={() => this.setState({ hasError: false, message: '' })}>
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TRANSITION_PRESETS: {
  label: string;
  value: TransitionType;
  description: string;
}[] = [
  { label: '无转场', value: 'none', description: '直接切换，适合节奏快的商品展示。' },
  { label: '淡入淡出', value: 'fade', description: '柔和衔接，适合场景或卖点过渡。' },
  { label: '滑动', value: 'slide', description: '横向推进，适合强调前后对比。' },
  { label: '擦除', value: 'wipe', description: '干净利落，适合步骤或功能展示。' },
  { label: '缩放模糊', value: 'zoom_blur', description: '更有动势，适合促单和高光片段。' },
];

const RESOURCE_TABS = ['素材片段', '字幕', '商品素材', '文本', '音频', '转场'];

function getTransitionTarget(
  selection: { type: 'clip' | 'transition' | 'subtitle'; id: string } | null,
  clips: TimelineClip[],
  transitions: TimelineTransition[],
) {
  if (selection?.type === 'transition') {
    return transitions.find((transition) => transition.id === selection.id);
  }

  if (selection?.type === 'clip') {
    const clipIndex = clips.findIndex((clip) => clip.id === selection.id);
    const clip = clips[clipIndex];
    const nextClip = clips[clipIndex + 1];
    if (!clip || !nextClip) return undefined;
    return (
      transitions.find(
        (transition) =>
          transition.from_clip_id === clip.id && transition.to_clip_id === nextClip.id,
      ) ?? { from_clip_id: clip.id, to_clip_id: nextClip.id }
    );
  }

  return undefined;
}

export default function VideoEditor() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { currentTask, fetchTask } = useCreationStore();
  const {
    clips,
    transitions,
    subtitles,
    playheadSeconds,
    pixelsPerSecond,
    selection,
    setPlayhead,
    setSelection,
    setSubtitles,
    removeClip,
    moveClip,
    trimClip,
    updateTransition,
    upsertTransitionBetween,
    removeTransition,
    addSubtitle,
    updateSubtitle,
    removeSubtitle,
    resetEditor,
  } = useEditorStore();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [resourceTab, setResourceTab] = useState('素材片段');
  const [transitionNotice, setTransitionNotice] = useState<string>();
  const [isUserSeeking, setIsUserSeeking] = useState(false);
  const [seekVersion, setSeekVersion] = useState(0);

  useEffect(() => {
    if (taskId) fetchTask(taskId);
    return () => {
      resetEditor();
    };
  }, [fetchTask, taskId, resetEditor]);

  useEffect(() => {
    if (!currentTask?.id) return;
    let cancelled = false;
    generationApi
      .getSubtitles(currentTask.id)
      .then((project) => {
        if (!cancelled) setSubtitles(project.cues ?? []);
      })
      .catch(() => {
        if (!cancelled) setSubtitles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTask?.id, setSubtitles]);

  const sourceSegments = useMemo(
    () =>
      (currentTask?.result?.segments ?? []).filter(
        (segment) => segment.status !== 'failed' && segment.video_url,
      ),
    [currentTask?.result?.segments],
  );

  const segmentByIndex = useMemo(
    () => new Map(sourceSegments.map((segment) => [segment.index, segment])),
    [sourceSegments],
  );

  const selectedClip =
    selection?.type === 'clip' ? clips.find((clip) => clip.id === selection.id) : undefined;
  const selectedTransition =
    selection?.type === 'transition'
      ? transitions.find((transition) => transition.id === selection.id)
      : undefined;
  const selectedSubtitle =
    selection?.type === 'subtitle'
      ? subtitles.find((subtitle) => subtitle.id === selection.id)
      : undefined;
  const selectedSegment = selectedClip ? segmentByIndex.get(selectedClip.segment_index) : undefined;

  const canExport =
    currentTask?.status === 'done' &&
    clips.length > 1 &&
    !clips.some((clip) => {
      const segment = segmentByIndex.get(clip.segment_index);
      return (
        !segment ||
        clip.start_seconds < 0 ||
        clip.end_seconds <= clip.start_seconds ||
        clip.end_seconds > segment.duration
      );
    });

  const handleAddSegment = (segment: VideoSegmentResult) => {
    if (clips.some((clip) => clip.segment_index === segment.index)) {
      setSelection({ type: 'clip', id: `clip-${segment.index}` });
      return;
    }
    useEditorStore.getState().addClip({
      id: `clip-${segment.index}`,
      segment_index: segment.index,
      start_seconds: 0,
      end_seconds: segment.duration,
    });
  };

  const handleDropSegment = useCallback(
    (segmentIndex: number, afterIndex?: number) => {
      if (clips.some((clip) => clip.segment_index === segmentIndex)) {
        setSelection({ type: 'clip', id: `clip-${segmentIndex}` });
        return;
      }
      const segment = segmentByIndex.get(segmentIndex);
      if (!segment) return;
      useEditorStore.getState().addClip(
        {
          id: `clip-${segmentIndex}`,
          segment_index: segmentIndex,
          start_seconds: 0,
          end_seconds: segment.duration,
        },
        afterIndex,
      );
    },
    [clips, segmentByIndex, setSelection],
  );

  const handleDragStart = useCallback((e: React.DragEvent, segment: VideoSegmentResult) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      'application/timeline-segment',
      JSON.stringify({ segmentIndex: segment.index }),
    );
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  }, []);

  const handleTransitionDragStart = (e: React.DragEvent, type: TransitionType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(TRANSITION_DND_TYPE, JSON.stringify({ type }));
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  };

  const handleClipTrimChange = (
    id: string,
    field: 'start_seconds' | 'end_seconds',
    value: number | null,
  ) => {
    trimClip(id, field, Number(value ?? 0));
  };

  const handleTransitionChange = (
    id: string,
    field: 'type' | 'duration_frames',
    value: TransitionType | number | null,
  ) => {
    updateTransition(id, field, value as TransitionType | number);
  };

  const handleCommittedSeek = useCallback(
    (seconds: number) => {
      setPlayhead(seconds);
      setSeekVersion((version) => version + 1);
    },
    [setPlayhead],
  );

  const handleApplyTransitionPreset = (type: TransitionType) => {
    const target = getTransitionTarget(selection, clips, transitions);

    if (!target) {
      setTransitionNotice('请先选中两个片段之间的转场，或选中一个非最后片段。');
      return;
    }

    upsertTransitionBetween(target.from_clip_id, target.to_clip_id, type);
    setTransitionNotice(undefined);
  };

  const handleInvalidTransitionDrop = () => {
    setTransitionNotice('请把转场拖到两个片段之间的间隙');
    setResourceTab('转场');
  };

  const handleAddSubtitle = () => {
    const start = Math.max(0, playheadSeconds);
    const cue: SubtitleCue = {
      id: `cue-${Date.now()}`,
      start_seconds: Number(start.toFixed(2)),
      end_seconds: Number((start + 2).toFixed(2)),
      text: '新字幕',
    };
    addSubtitle(cue);
  };

  const handleExport = async () => {
    if (!canExport || !currentTask) return;
    setExporting(true);
    setExportError(undefined);
    try {
      const request: ExportRequest = {
        format: 'mp4',
        resolution: '1080x1920',
        quality: 'high',
        render_engine: 'remotion',
        edit_project: { clips, transitions, subtitles },
      };
      await generationApi.saveSubtitles(currentTask.id, {
        version: SUBTITLE_PROJECT_VERSION,
        task_id: currentTask.id,
        source: 'editor',
        cues: subtitles,
      });
      await generationApi.export(currentTask.id, request);
      await fetchTask(currentTask.id);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '转场视频导出失败');
    } finally {
      setExporting(false);
    }
  };

  if (!currentTask) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className={styles.editorShell} style={{ display: 'block', minHeight: 'calc(100vh - 160px)' }}>
        <section className={styles.mobilePrompt}>
          <div className={styles.mobilePromptCard}>
            <Title level={3}>剪辑工作台建议在电脑端使用</Title>
            <Text type="secondary">
              视频剪辑需要更大的屏幕完成素材拖拽、片段裁剪、多轨时间线和导出检查。请在电脑端打开当前任务继续编辑。
            </Text>
            <Space wrap className={styles.mobilePromptActions}>
              <Button
                type="primary"
                onClick={() => navigate(routePath.creationTask(taskId ?? currentTask.id))}
              >
                返回任务详情
              </Button>
              <Button onClick={() => navigate('/creation')}>返回创作工作台</Button>
            </Space>
          </div>
        </section>
      </div>
    );
  }

  return (
    <section className={styles.editorShell} data-testid="editor-shell">
      <header className={styles.editorTopbar}>
        <div>
          <Title level={4} className={styles.editorTitle}>
            剪辑工作台
          </Title>
          <Text type="secondary">
            任务 {currentTask.display_id ?? currentTask.id} · 草稿会随当前页面状态自动保留
          </Text>
        </div>
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(routePath.creationTask(taskId ?? currentTask.id))}
          >
            返回任务
          </Button>
          <Button disabled>保存草稿</Button>
          <Button
            aria-label="export transition video"
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            disabled={!canExport}
            onClick={handleExport}
          >
            导出视频
          </Button>
        </Space>
      </header>

      {exportError && (
        <Alert
          type="error"
          showIcon
          message={exportError}
          closable
          className={styles.exportError}
        />
      )}

      <div className={styles.workbench}>
        <aside className={styles.resourcePanel}>
          <div className={styles.panelHeader}>
            <strong>资源与工具</strong>
            <Tag color="processing">可拖入时间线</Tag>
          </div>
          <div className={styles.resourceTabs} role="tablist" aria-label="编辑资源类型">
            {RESOURCE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`${styles.resourceTab} ${resourceTab === tab ? styles.resourceTabActive : ''}`}
                onClick={() => setResourceTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {resourceTab === '素材片段' && (
            <div className={styles.segmentList}>
              {sourceSegments.length === 0 ? (
                <Empty description="暂无可剪辑片段" />
              ) : (
                sourceSegments.map((segment) => {
                  const inTimeline = clips.some((clip) => clip.segment_index === segment.index);
                  return (
                    <article
                      key={segment.index}
                      className={styles.segmentCard}
                      draggable
                      onDragStart={(e) => handleDragStart(e, segment)}
                    >
                      <div className={styles.segmentThumb}>
                        {segment.thumbnail_url ? (
                          <img
                            src={segment.thumbnail_url}
                            alt={`第 ${segment.index + 1} 段缩略图`}
                          />
                        ) : (
                          <span aria-label={`第 ${segment.index + 1} 段占位缩略图`}>
                            {segment.index + 1}
                          </span>
                        )}
                      </div>
                      <div className={styles.segmentContent}>
                        <Text strong>第 {segment.index + 1} 段</Text>
                        <Text type="secondary" className={styles.segmentMeta}>
                          {formatDuration(segment.duration)} · {segment.resolution}
                        </Text>
                        <div className={styles.segmentActions}>
                          <Tag>{inTimeline ? '已加入' : segment.aspect_ratio}</Tag>
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => handleAddSegment(segment)}
                          >
                            {inTimeline ? '定位' : '加入'}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {resourceTab === '转场' && (
            <div className={styles.transitionPresetPanel}>
              {transitionNotice && (
                <Alert
                  type="info"
                  showIcon
                  message={transitionNotice}
                  className={styles.transitionNotice}
                />
              )}
              <div className={styles.transitionPresetGrid}>
                {TRANSITION_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-label={preset.label}
                    draggable
                    className={styles.transitionPresetCard}
                    onDragStart={(event) => handleTransitionDragStart(event, preset.value)}
                    onClick={() => handleApplyTransitionPreset(preset.value)}
                  >
                    <span className={styles.transitionPresetIcon}>{preset.label.slice(0, 1)}</span>
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {resourceTab === '字幕' && (
            <div className={styles.subtitlePanel}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSubtitle} block>
                新增字幕
              </Button>
              <div className={styles.subtitleList}>
                {subtitles.length === 0 ? (
                  <Empty description="暂无字幕" />
                ) : (
                  subtitles.map((cue) => (
                    <button
                      key={cue.id}
                      type="button"
                      className={`${styles.subtitleCard} ${
                        selection?.type === 'subtitle' && selection.id === cue.id
                          ? styles.subtitleCardActive
                          : ''
                      }`}
                      onClick={() => setSelection({ type: 'subtitle', id: cue.id })}
                    >
                      <strong>{cue.text}</strong>
                      <span>
                        {cue.start_seconds.toFixed(1)}s - {cue.end_seconds.toFixed(1)}s
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {!['素材片段', '字幕', '转场'].includes(resourceTab) && (
            <div className={styles.resourceEmpty}>
              <Empty description={`${resourceTab}能力将在后续版本接入`} />
            </div>
          )}
        </aside>

        <main className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <Text strong>整体预览</Text>
            <Text type="secondary">9:16 · {clips.length} 个片段</Text>
          </div>
          <div className={styles.previewCanvas} data-testid="preview-stage">
            <PreviewErrorBoundary>
              <Suspense fallback={<Spin />}>
                <RemotionPreview
                  segmentByIndex={segmentByIndex}
                  playheadSeconds={playheadSeconds}
                  seekVersion={seekVersion}
                  onFrameChange={setPlayhead}
                  isUserSeeking={isUserSeeking}
                />
              </Suspense>
            </PreviewErrorBoundary>
          </div>
        </main>

        <aside className={styles.inspectorPanel}>
          <div className={styles.panelHeader}>
            <strong>片段属性</strong>
            {selectedTransition && <Tag color="magenta">转场</Tag>}
            {selectedClip && <Tag color="blue">片段</Tag>}
            {selectedSubtitle && <Tag color="purple">字幕</Tag>}
          </div>
          <div className={styles.inspectorBody}>
            {selectedClip && selectedSegment && (
              <Space direction="vertical" size={16} className={styles.fullWidth}>
                <Text>来源：第 {selectedSegment.index + 1} 段</Text>
                <Text>原始时长：{formatDuration(selectedSegment.duration)}</Text>
                <div>
                  <Text type="secondary">开始秒</Text>
                  <InputNumber
                    aria-label="clip trim start"
                    min={0}
                    max={selectedSegment.duration}
                    step={0.1}
                    value={selectedClip.start_seconds}
                    onChange={(value) =>
                      handleClipTrimChange(selectedClip.id, 'start_seconds', value)
                    }
                    className={styles.fullWidthInput}
                  />
                </div>
                <div>
                  <Text type="secondary">结束秒</Text>
                  <InputNumber
                    aria-label="clip trim end"
                    min={0.1}
                    max={selectedSegment.duration}
                    step={0.1}
                    value={selectedClip.end_seconds}
                    onChange={(value) =>
                      handleClipTrimChange(selectedClip.id, 'end_seconds', value)
                    }
                    className={styles.fullWidthInput}
                  />
                </div>
                {selectedClip.end_seconds <= selectedClip.start_seconds && (
                  <Alert type="error" showIcon message="结束秒必须大于开始秒" />
                )}
                <Space wrap>
                  <Button
                    aria-label="move clip up"
                    icon={<ArrowUpOutlined />}
                    onClick={() => moveClip(selectedClip.id, -1)}
                  >
                    上移
                  </Button>
                  <Button
                    aria-label="move clip down"
                    icon={<ArrowDownOutlined />}
                    onClick={() => moveClip(selectedClip.id, 1)}
                  >
                    下移
                  </Button>
                  <Button
                    aria-label="remove clip"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeClip(selectedClip.id)}
                  >
                    删除
                  </Button>
                </Space>
              </Space>
            )}

            {selectedTransition && (
              <Space direction="vertical" size={16} className={styles.fullWidth}>
                <div>
                  <Text type="secondary">转场类型</Text>
                  <Select
                    aria-label="transition type"
                    value={selectedTransition.type}
                    onChange={(value) =>
                      handleTransitionChange(selectedTransition.id, 'type', value)
                    }
                    options={TRANSITION_PRESETS.map(({ label, value }) => ({ label, value }))}
                    className={styles.fullWidthInput}
                  />
                </div>
                <div>
                  <Text type="secondary">转场时长（帧）</Text>
                  <InputNumber
                    aria-label="transition duration frames"
                    min={6}
                    max={30}
                    value={selectedTransition.duration_frames ?? 12}
                    onChange={(value) =>
                      handleTransitionChange(selectedTransition.id, 'duration_frames', value)
                    }
                    className={styles.fullWidthInput}
                  />
                </div>
                <Button
                  aria-label="删除转场"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeTransition(selectedTransition.id)}
                >
                  删除转场
                </Button>
              </Space>
            )}

            {selectedSubtitle && (
              <Space direction="vertical" size={16} className={styles.fullWidth}>
                <div>
                  <Text type="secondary">字幕文本</Text>
                  <Input.TextArea
                    aria-label="subtitle text"
                    value={selectedSubtitle.text}
                    autoSize={{ minRows: 3, maxRows: 5 }}
                    onChange={(event) =>
                      updateSubtitle(selectedSubtitle.id, 'text', event.target.value)
                    }
                  />
                </div>
                <div>
                  <Text type="secondary">开始秒</Text>
                  <InputNumber
                    aria-label="subtitle start seconds"
                    min={0}
                    step={0.1}
                    value={selectedSubtitle.start_seconds}
                    onChange={(value) =>
                      updateSubtitle(selectedSubtitle.id, 'start_seconds', Number(value ?? 0))
                    }
                    className={styles.fullWidthInput}
                  />
                </div>
                <div>
                  <Text type="secondary">结束秒</Text>
                  <InputNumber
                    aria-label="subtitle end seconds"
                    min={0.1}
                    step={0.1}
                    value={selectedSubtitle.end_seconds}
                    onChange={(value) =>
                      updateSubtitle(selectedSubtitle.id, 'end_seconds', Number(value ?? 0.1))
                    }
                    className={styles.fullWidthInput}
                  />
                </div>
                {selectedSubtitle.end_seconds <= selectedSubtitle.start_seconds && (
                  <Alert type="error" showIcon message="结束秒必须大于开始秒" />
                )}
                <Button
                  aria-label="删除字幕"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeSubtitle(selectedSubtitle.id)}
                >
                  删除字幕
                </Button>
              </Space>
            )}

            {!selection && <Empty description="请选择时间线片段、转场或字幕" />}

            {!canExport && (
              <Alert
                type="info"
                showIcon
                message="至少需要两个有效片段才能导出转场视频。"
                className={styles.exportHint}
              />
            )}
            {exporting && (
              <Alert
                type="info"
                showIcon
                message="正在渲染转场视频，请稍候..."
                className={styles.exportHint}
              />
            )}
          </div>
        </aside>
      </div>

      <section className={styles.timelinePanel}>
        <div className={styles.timelineHeader}>
          <Title level={5} className={styles.timelineTitle}>
            多轨时间线
          </Title>
          <Text type="secondary">拖拽素材片段导入，拖动片段边缘裁剪，滚轮缩放时间轴。</Text>
        </div>
        <Timeline
          segmentByIndex={segmentByIndex}
          onDropSegment={handleDropSegment}
          onInvalidTransitionDrop={handleInvalidTransitionDrop}
          onSeekCommit={handleCommittedSeek}
          onSeekStart={() => setIsUserSeeking(true)}
          onSeekEnd={() => setIsUserSeeking(false)}
        />
        <div className={styles.subtitleTimelineTrack} data-testid="subtitle-timeline-track">
          <span className={styles.subtitleTrackLabel}>字幕</span>
          <div className={styles.subtitleTrackRail}>
            {subtitles.map((cue) => (
              <button
                key={cue.id}
                type="button"
                className={`${styles.subtitleTimelineCue} ${
                  selection?.type === 'subtitle' && selection.id === cue.id
                    ? styles.subtitleTimelineCueActive
                    : ''
                }`}
                style={{
                  left: cue.start_seconds * pixelsPerSecond,
                  width: Math.max((cue.end_seconds - cue.start_seconds) * pixelsPerSecond, 48),
                }}
                onClick={() => setSelection({ type: 'subtitle', id: cue.id })}
              >
                {cue.text}
              </button>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
