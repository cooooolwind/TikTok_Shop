import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
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
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, VideoCameraOutlined } from '@ant-design/icons';
import type { Scene, TaskProgress } from '@aigc/shared-types';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import SceneCard from '../../components/script/SceneCard';
import StatusTag from '../../components/common/StatusTag';
import { SCRIPT_MODE_LABELS, SCRIPT_STATUS_LABELS } from '../../constants';
import { subscribeTask, unsubscribeTask, onScriptGenerated, onTaskFailed, onTaskProgress } from '../../services/socket';
import { sortScenes, useScriptStore } from '../../stores/useScriptStore';

const { TextArea } = Input;
const { Text, Title } = Typography;

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
    updateScene,
    addScene,
    removeScene,
    regenerateScene,
    resetCurrentScript,
  } = useScriptStore();
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [sceneModalOpen, setSceneModalOpen] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneForm] = Form.useForm();

  useEffect(() => {
    if (id) fetchDetail(id);
    return () => resetCurrentScript();
  }, [id, fetchDetail, resetCurrentScript]);

  useEffect(() => {
    const taskId = currentScript?.generation_task_id;
    if (!taskId) return;
    subscribeTask(taskId);
    const offProgress = onTaskProgress((event) => {
      if (event.task_id === taskId) setProgress(event.progress);
    });
    const offFailed = onTaskFailed((event) => {
      if (event.task_id === taskId && id) fetchDetail(id);
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

  if (loading || !currentScript) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const script = currentScript;
  const scenes = sortScenes(script.scenes ?? []);

  const openAddScene = () => {
    sceneForm.resetFields();
    setEditingSceneId(null);
    setSceneModalOpen(true);
  };

  const openEditScene = (scene: Scene) => {
    sceneForm.setFieldsValue(scene);
    setEditingSceneId(scene.id);
    setSceneModalOpen(true);
  };

  const submitScene = async () => {
    const values = await sceneForm.validateFields();
    if (editingSceneId) {
      updateScene(script.id, editingSceneId, values);
    } else {
      const lastOrder = scenes.at(-1)?.order ?? 0;
      await addScene(script.id, lastOrder, {
        description: values.description,
        camera_motion: values.camera_motion ?? 'fixed',
        duration: values.duration ?? 3,
        dialogue: values.dialogue ?? '',
        bgm_style: values.bgm_style ?? 'upbeat',
        subtitle: values.subtitle ?? '',
        visual_prompt: values.visual_prompt ?? values.description,
        constraints: values.constraints ?? [],
      });
    }
    setSceneModalOpen(false);
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
    <div>
      <PageHeader
        title="编辑剧本"
        breadcrumbs={[
          { title: '剧本工作台', path: '/scripts' },
          { title: script.product_info.name || script.id },
        ]}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/scripts')}>
              返回列表
            </Button>
            {returnTaskId && (
              <Button icon={<VideoCameraOutlined />} onClick={() => navigate(`/creation/tasks/${returnTaskId}`)}>
                返回生成任务
              </Button>
            )}
            {script.status === 'failed' && (
              <Button icon={<ReloadOutlined />} onClick={() => retry(script.id)}>
                重新生成
              </Button>
            )}
            {script.status === 'draft' && (
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
          style={{ marginBottom: 16 }}
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

      {script.status === 'failed' && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="剧本生成失败"
          description={script.generation_error || 'AI 生成失败，可点击重新生成或手动编辑。'}
        />
      )}

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card title="剧本概要" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="商品">{script.product_info.name}</Descriptions.Item>
              <Descriptions.Item label="模式">
                <Tag>{SCRIPT_MODE_LABELS[script.mode] ?? script.mode}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={script.status} labels={SCRIPT_STATUS_LABELS} />
              </Descriptions.Item>
              <Descriptions.Item label="视觉风格">{script.visual_style || '-'}</Descriptions.Item>
              <Descriptions.Item label="总时长">{script.total_duration}s</Descriptions.Item>
              <Descriptions.Item label="分镜数">{scenes.length}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Text strong>叙事框架</Text>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">{script.narrative_framework || '暂无'}</Text>
            </div>
            {script.source_material_ids?.length ? (
              <Tag color="blue" style={{ marginTop: 12 }}>
                已关联 {script.source_material_ids.length} 个素材
              </Tag>
            ) : null}
            <Divider />
            <Text strong>商品图</Text>
            {script.product_info.images?.length ? (
              <Image.PreviewGroup>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {script.product_info.images.slice(0, 6).map((url) => (
                    <Image
                      key={url}
                      src={url}
                      width={64}
                      height={64}
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                      alt="商品图"
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
                message="缺少商品图，无法进行 Seedream 首帧生成。"
              />
            )}
            {isDirty && <Tag color="warning" style={{ marginTop: 12 }}>有未保存的本地修改</Tag>}
          </Card>

          {script.status !== 'generating' && (
            <Button type="dashed" icon={<PlusOutlined />} block onClick={openAddScene}>
              添加分镜
            </Button>
          )}
        </Col>

        <Col xs={24} lg={16}>
          <Title level={5}>分镜列表 ({scenes.length})</Title>
          {scenes.length === 0 ? (
            <EmptyState
              description={script.status === 'generating' ? 'AI 正在生成分镜' : '暂无分镜'}
              actionText={script.status !== 'generating' ? '添加第一个分镜' : undefined}
              onAction={script.status !== 'generating' ? openAddScene : undefined}
            />
          ) : (
            scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={index}
                onEdit={() => openEditScene(scene)}
                onDelete={() => {
                  Modal.confirm({
                    title: '删除分镜',
                    content: `确认删除第 ${index + 1} 个分镜？`,
                    okType: 'danger',
                    onOk: () => removeScene(script.id, scene.id),
                  });
                }}
                onRegenerate={() => regenerateScene(script.id, scene.id, 'all')}
              />
            ))
          )}
        </Col>
      </Row>

      <Modal
        title={editingSceneId ? '编辑分镜' : '添加分镜'}
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
