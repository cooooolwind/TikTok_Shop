import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Col,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  DeleteOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { BlueprintScene, Scene, ScriptBlueprint, TaskProgress } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { SCRIPT_MODE_LABELS, SCRIPT_STATUS_LABELS } from '../../constants';
import { subscribeTask, unsubscribeTask, onScriptGenerated, onTaskFailed, onTaskProgress } from '../../services/socket';
import { sortScenes, useScriptStore } from '../../stores/useScriptStore';
import { useMaterialStore } from '../../stores/useMaterialStore';
import styles from './ScriptEditor.module.css';

const { TextArea } = Input;
const { Text } = Typography;

export default function ScriptEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTaskId = searchParams.get('returnTask');
  const {
    currentScript,
    loading,
    isDirty,
    fetchDetail,
    confirm,
    remove,
    retry,
    updateScript,
    updateScene,
    resetCurrentScript,
  } = useScriptStore();
  const { selectedMaterial: selectedReference, fetchDetail: fetchReferenceDetail } = useMaterialStore();
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [sceneModalOpen, setSceneModalOpen] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'blueprint' | 'preview'>('blueprint');
  const [collapsedBlueprintScenes, setCollapsedBlueprintScenes] = useState<Set<number | string>>(new Set());
  const [sceneForm] = Form.useForm();
  const [blueprintForm] = Form.useForm<ScriptBlueprint>();

  useEffect(() => {
    fetchDetail(id!);
  }, [id, fetchDetail]);

  useEffect(() => {
    if (currentScript?.reference_id) {
      fetchReferenceDetail(currentScript.reference_id);
    }
  }, [currentScript?.reference_id, fetchReferenceDetail]);

  useEffect(() => {
    const taskId = currentScript?.generation_task_id;
    if (!taskId) return;
    subscribeTask(taskId);
    const offProgress = onTaskProgress((event) => {
      if (event.task_id === taskId) setProgress(event.progress);
    });
    const offFailed = onTaskFailed((event) => {
      if (event.task_id === taskId && taskId.startsWith('script_generation_') && id) fetchDetail(id);
    });
    const offGenerated = onScriptGenerated((event) => {
      if (event.script_id === currentScript.id && id) fetchDetail(id);
    });
    return () => {
      unsubscribeTask(taskId);
      offProgress();
      offFailed();
      offGenerated();
    };
  }, [currentScript?.generation_task_id, currentScript?.id, id, fetchDetail]);

  useEffect(() => {
    if (!currentScript) return;
    blueprintForm.setFieldsValue(
      currentScript.script_blueprint ?? createBlueprintFromScenes(sortScenes(currentScript.scenes ?? [])),
    );
  }, [blueprintForm, currentScript]);

  if (loading || !currentScript) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const script = currentScript;
  const scenes = sortScenes(script.scenes ?? []);
  const blueprint = script.script_blueprint ?? createBlueprintFromScenes(scenes);
  const hasGeneratedScriptContent = scenes.length > 0 || Boolean(script.script_blueprint?.scenes?.length);
  const isScriptGenerationFailed = script.status === 'failed' && !hasGeneratedScriptContent;

  const openEditScene = (scene: Scene) => {
    sceneForm.setFieldsValue(scene);
    setEditingSceneId(scene.id);
    setSceneModalOpen(true);
  };

  const submitScene = async () => {
    const values = await sceneForm.validateFields();
    if (editingSceneId) {
      await updateScene(script.id, editingSceneId, values);
    }
    setSceneModalOpen(false);
  };

  const submitBlueprint = async () => {
    const values = await blueprintForm.validateFields();
    const normalized = normalizeBlueprint(values);
    await updateScript(script.id, { script_blueprint: normalized });
    for (const blueprintScene of normalized.scenes) {
      const scene = scenes.find((item) => item.order === blueprintScene.order);
      if (!scene) continue;
      await updateScene(script.id, scene.id, blueprintSceneToScenePatch(normalized, blueprintScene));
    }
  };

  const toggleBlueprintScene = (sceneKey: number | string) => {
    setCollapsedBlueprintScenes((current) => {
      const next = new Set(current);
      if (next.has(sceneKey)) {
        next.delete(sceneKey);
      } else {
        next.add(sceneKey);
      }
      return next;
    });
  };

  const deleteScript = () => {
    Modal.confirm({
      title: '删除剧本',
      content: '删除后不可恢复，确认继续？',
      okType: 'danger',
      onOk: async () => {
        await remove(script.id);
        navigate('/scripts');
      },
    });
  };

  return (
    <div className={styles.shell}>
      <PageHeader
        title="编辑剧本"
        breadcrumbs={[
          { title: '剧本工作台', path: '/scripts' },
          { title: script.product_info.name || script.id },
        ]}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/scripts')}>
              返回列表
            </Button>
            {returnTaskId && (
              <Button icon={<VideoCameraOutlined />} onClick={() => navigate(`/creation/tasks/${returnTaskId}`)}>
                返回生成任务
              </Button>
            )}
            {isScriptGenerationFailed && (
              <Button icon={<ReloadOutlined />} onClick={() => retry(script.id)}>
                重新生成
              </Button>
            )}
            {(script.status === 'draft' || (script.status === 'failed' && hasGeneratedScriptContent)) && (
              <Button type="primary" icon={<CheckOutlined />} onClick={() => confirm(script.id)}>
                确认剧本
              </Button>
            )}
            <Button danger icon={<DeleteOutlined />} onClick={deleteScript}>
              删除
            </Button>
          </Space>
        }
      />

      {script.status === 'generating' && (
        <Alert
          type="info"
          showIcon
          className={styles.statusAlert}
          message="剧本正在生成"
          description={
            <Progress
              percent={progress?.percentage ?? 5}
              status="active"
              format={() => progress?.message ?? '等待任务进度...'}
            />
          }
        />
      )}

      {isScriptGenerationFailed && (
        <Alert
          type="error"
          showIcon
          className={styles.statusAlert}
          message="剧本生成失败"
          description={script.generation_error || 'AI 生成失败，可点击重新生成或手动编辑。'}
        />
      )}

      <section className={styles.layout}>
        <aside className={`${styles.panel} ${styles.side}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>剧本概要</div>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.metaList}>
              <div className={styles.metaRow}>
                <span className={styles.label}>商品</span>
                <span className={styles.value}>{script.product_info.name}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.label}>模式</span>
                <span className={styles.value}>
                  <Tag>{SCRIPT_MODE_LABELS[script.mode] ?? script.mode}</Tag>
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.label}>状态</span>
                <span className={styles.value}>
                  <StatusTag status={script.status} labels={SCRIPT_STATUS_LABELS} />
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.label}>总时长</span>
                <span className={styles.value}>
                  {script.total_duration}s / {scenes.length} 个镜头
                </span>
              </div>
              {script.source_material_ids?.length ? (
                <div className={styles.metaRow}>
                  <span className={styles.label}>素材</span>
                  <span className={styles.value}>已关联 {script.source_material_ids.length} 个素材</span>
                </div>
              ) : null}
              <div className={styles.tagRow}>
                <Tag color="green">素材优先</Tag>
                <Tag color="blue">产品可见</Tag>
                <Tag>无画面文字</Tag>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>商品图</div>
              {script.product_info.images?.length ? (
                <Image.PreviewGroup>
                  <div className={styles.productImages}>
                    {script.product_info.images.slice(0, 4).map((url) => (
                      <Image
                        key={url}
                        src={url}
                        width={56}
                        height={56}
                        style={{ objectFit: 'cover', borderRadius: 6 }}
                        alt="商品图"
                      />
                    ))}
                  </div>
                </Image.PreviewGroup>
              ) : (
                <Text type="secondary">暂无商品图</Text>
              )}
            </div>
            {isDirty && <Tag color="warning" style={{ marginTop: 12 }}>有未保存的本地修改</Tag>}
            {script.reference_id ? (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>原爆款参考</div>
                {selectedReference ? (
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space wrap>
                      {selectedReference.source_platform ? (
                        <Tag color="blue">{selectedReference.source_platform}</Tag>
                      ) : null}
                      <Tag>{selectedReference.category}</Tag>
                    </Space>
                    <Text type="secondary">{selectedReference.reference_analysis?.hook || '暂无 Hook 拆解'}</Text>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/materials/${script.reference_id}`)}
                      style={{ padding: 0 }}
                    >
                      查看完整解析报告
                    </Button>
                  </Space>
                ) : (
                  <Button type="link" onClick={() => navigate(`/materials/${script.reference_id}`)} style={{ padding: 0 }}>
                    查看参考素材详情
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </aside>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>{activeView === 'blueprint' ? '剧本蓝图' : '生成分镜预览'}</h2>
              <div className={styles.panelSubtitle}>
                {activeView === 'blueprint' ? '主编辑入口' : '由蓝图同步生成'}
              </div>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.viewSwitch} aria-label="剧本编辑视图切换">
                <button
                  type="button"
                  className={activeView === 'blueprint' ? styles.viewButtonActive : styles.viewButton}
                  aria-pressed={activeView === 'blueprint'}
                  onClick={() => setActiveView('blueprint')}
                >
                  蓝图编辑
                </button>
                <button
                  type="button"
                  className={activeView === 'preview' ? styles.viewButtonActive : styles.viewButton}
                  aria-pressed={activeView === 'preview'}
                  onClick={() => setActiveView('preview')}
                >
                  生成预览
                </button>
              </div>
              {activeView === 'blueprint' && script.status !== 'generating' ? (
                <Button type="primary" size="small" onClick={submitBlueprint}>
                  保存蓝图并同步分镜
                </Button>
              ) : null}
            </div>
          </div>
          <div className={styles.panelBody}>
            {activeView === 'blueprint' ? (
              <Form form={blueprintForm} layout="vertical" initialValues={blueprint}>
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>全局设定</div>
                  <Tag color="green">所有镜头共用</Tag>
                </div>
                <div className={styles.formGrid}>
                  <Form.Item className={styles.fieldWide} name="basic_setting" label="基础设定">
                    <TextArea aria-label="基础设定" rows={4} />
                  </Form.Item>
                  <Form.Item className={styles.fieldWide} name="atmosphere_and_quality" label="氛围与画质">
                    <TextArea aria-label="氛围与画质" rows={3} />
                  </Form.Item>
                  <Form.Item className={styles.fieldWide} name="audio" label="声音">
                    <TextArea aria-label="声音" rows={2} />
                  </Form.Item>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>分镜蓝图</div>
                </div>
                <Form.List name="scenes">
                  {(fields) => (
                    <div className={styles.sceneStack}>
                      {fields.map((field, index) => {
                        const isCollapsed = collapsedBlueprintScenes.has(field.key);
                        const sceneValues = blueprintForm.getFieldValue(['scenes', field.name]) as
                          | Partial<BlueprintScene>
                          | undefined;
                        const sceneSummary =
                          sceneValues?.visual_content ||
                          blueprint.scenes?.[index]?.visual_content ||
                          '尚未填写画面内容';

                        return (
                        <article className={styles.scene} key={field.key}>
                          <div className={styles.sceneHead}>
                            <div className={styles.sceneIndex}>{index + 1}</div>
                            <div className={styles.sceneName}>
                              <strong>蓝图分镜 {index + 1}</strong>
                              <span>修改这里会同步生成视频分镜预览</span>
                            </div>
                            <Button
                              size="small"
                              aria-label={isCollapsed ? '展开' : '折叠'}
                              aria-expanded={!isCollapsed}
                              onClick={() => toggleBlueprintScene(field.key)}
                            >
                              {isCollapsed ? '展开' : '折叠'}
                            </Button>
                          </div>
                          {isCollapsed ? (
                            <div className={styles.sceneSummary}>{sceneSummary}</div>
                          ) : (
                          <div className={styles.sceneBody}>
                            <Form.Item name={[field.name, 'order']} hidden>
                              <InputNumber />
                            </Form.Item>
                            <div className={styles.formGrid}>
                              <Form.Item name={[field.name, 'time_range']} label="时间段">
                                <Input aria-label={`分镜 ${index + 1} 时间段`} placeholder="00:00-00:04" />
                              </Form.Item>
                              <Form.Item name={[field.name, 'shot_size']} label="景别">
                                <Input aria-label={`分镜 ${index + 1} 景别`} />
                              </Form.Item>
                              <Form.Item name={[field.name, 'camera_movement']} label="运镜">
                                <Input aria-label={`分镜 ${index + 1} 运镜`} />
                              </Form.Item>
                              <Form.Item className={styles.fieldWide} name={[field.name, 'composition']} label="构图">
                                <TextArea aria-label={`分镜 ${index + 1} 构图`} rows={2} />
                              </Form.Item>
                              <Form.Item className={styles.fieldWide} name={[field.name, 'visual_content']} label="画面内容">
                                <TextArea aria-label={`分镜 ${index + 1} 画面内容`} rows={3} />
                              </Form.Item>
                              <Form.Item className={styles.fieldWide} name={[field.name, 'audio']} label="分镜声音">
                                <TextArea aria-label={`分镜 ${index + 1} 声音`} rows={2} />
                              </Form.Item>
                              <Form.Item className={styles.fieldWide} name={[field.name, 'dialogue']} label="台词/旁白">
                                <TextArea
                                  aria-label={`分镜 ${index + 1} 台词`}
                                  rows={2}
                                  placeholder="生成台词后可在这里直接修改；不需要台词时留空"
                                />
                              </Form.Item>
                              <Form.Item className={styles.fieldWide} name={[field.name, 'subtitle']} label="字幕">
                                <Input
                                  aria-label={`分镜 ${index + 1} 字幕`}
                                  placeholder="默认可与台词一致，也可以改成更短字幕"
                                />
                              </Form.Item>
                            </div>
                          </div>
                          )}
                        </article>
                        );
                      })}
                    </div>
                  )}
                </Form.List>
              </section>
              </Form>
            ) : (
              <div className={styles.previewList}>
                {scenes.map((scene, index) => (
                  <article className={styles.previewItem} key={scene.id}>
                    <header className={styles.previewHead}>
                      <Text strong>分镜 {index + 1}</Text>
                      <Tag>{scene.duration}s</Tag>
                    </header>
                    <div className={styles.metaRow}>
                      <span className={styles.label}>description</span>
                      <span className={styles.value}>{scene.description || '-'}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.label}>运镜与声音</span>
                      <span className={styles.value}>
                        {[scene.camera_motion, scene.bgm_style].filter(Boolean).join(' / ') || '-'}
                      </span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.label}>台词</span>
                      <span className={styles.value}>{scene.dialogue || '-'}</span>
                    </div>
                    {script.status !== 'generating' && (
                      <Button size="small" style={{ marginTop: 10 }} onClick={() => openEditScene(scene)}>
                        高级编辑
                      </Button>
                    )}
                  </article>
                ))}
                {scenes.length === 0 && (
                  <Text type="secondary">{script.status === 'generating' ? 'AI 正在生成分镜' : '暂无生成分镜'}</Text>
                )}
              </div>
            )}
          </div>
        </section>
      </section>

      <Modal
        title="高级编辑生成分镜"
        open={sceneModalOpen}
        onCancel={() => setSceneModalOpen(false)}
        onOk={submitScene}
        width={680}
        destroyOnClose
      >
        <Form form={sceneForm} layout="vertical">
          <Form.Item name="description" label="画面描述" rules={[{ required: true, message: '请输入画面描述' }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="camera_motion" label="镜头运动">
                <Select
                  options={['fixed', 'push in', 'pull out', 'pan', 'tracking', 'close-up'].map((value) => ({ label: value, value }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration" label="时长（秒）">
                <InputNumber min={1} max={12} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dialogue" label="台词/旁白">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bgm_style" label="BGM 风格">
                <Select options={['upbeat', 'calm', 'dramatic', 'funny'].map((value) => ({ label: value, value }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subtitle" label="字幕">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="visual_prompt" label="视觉 Prompt">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function createBlueprintFromScenes(scenes: Scene[]): ScriptBlueprint {
  let cursor = 0;
  return {
    basic_setting: '',
    atmosphere_and_quality: '',
    audio: '',
    scenes: scenes.map((scene, index) => {
      const duration = clampDuration(scene.duration ?? 4);
      const timeRange = `${formatTime(cursor)}-${formatTime(cursor + duration)}`;
      cursor += duration;
      return {
        order: scene.order ?? index + 1,
        time_range: timeRange,
        shot_size: '',
        composition: '',
        camera_movement: scene.camera_motion ?? '',
        visual_content: scene.description ?? '',
        audio: scene.bgm_style ?? '',
        dialogue: scene.dialogue ?? '',
        subtitle: scene.subtitle ?? '',
      };
    }),
  };
}

function normalizeBlueprint(blueprint: ScriptBlueprint): ScriptBlueprint {
  return {
    basic_setting: blueprint.basic_setting ?? '',
    atmosphere_and_quality: blueprint.atmosphere_and_quality ?? '',
    audio: blueprint.audio ?? '',
    scenes: (blueprint.scenes ?? []).map((scene, index) => ({
      order: Number(scene.order ?? index + 1),
      time_range: scene.time_range ?? '',
      shot_size: scene.shot_size ?? '',
      composition: scene.composition ?? '',
      camera_movement: scene.camera_movement ?? '',
      visual_content: scene.visual_content ?? '',
      audio: scene.audio ?? '',
      dialogue: scene.dialogue ?? '',
      subtitle: scene.subtitle ?? '',
    })),
  };
}

function blueprintSceneToScenePatch(blueprint: ScriptBlueprint, scene: BlueprintScene): Partial<Scene> {
  return {
    description: scene.visual_content,
    camera_motion: scene.camera_movement || 'fixed',
    duration: durationFromTimeRange(scene.time_range),
    dialogue: scene.dialogue ?? '',
    bgm_style: scene.audio || blueprint.audio || '同期声',
    subtitle: scene.subtitle ?? scene.dialogue ?? '',
    visual_prompt: [
      `基础设定：${blueprint.basic_setting}`,
      `氛围与画质：${blueprint.atmosphere_and_quality}`,
      `声音规则：${blueprint.audio}`,
      `时间段：${scene.time_range}`,
      `景别：${scene.shot_size}`,
      `构图：${scene.composition}`,
      `运镜：${scene.camera_movement}`,
      `画面内容：${scene.visual_content}`,
      scene.audio ? `当前分镜声音：${scene.audio}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function durationFromTimeRange(timeRange: string) {
  const match = timeRange.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) return 4;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return clampDuration(end - start);
}

function clampDuration(duration: number) {
  return Math.min(Math.max(Math.round(Number(duration) || 4), 1), 12);
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}
