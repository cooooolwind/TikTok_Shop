import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Spin, Descriptions, Tag, Modal,
  Input, Select, InputNumber, Form, Typography, Divider,
  message, Row, Col,
} from 'antd';
import {
  PlusOutlined, CheckOutlined, ArrowLeftOutlined,
  DeleteOutlined, EditOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import SceneCard from '../../components/script/SceneCard';
import StatusTag from '../../components/common/StatusTag';
import EmptyState from '../../components/common/EmptyState';
import { useScriptStore } from '../../stores/useScriptStore';
import { SCRIPT_MODE_LABELS, SCRIPT_STATUS_LABELS } from '../../constants';

const { TextArea } = Input;
const { Text, Title } = Typography;

export default function ScriptEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentScript, loading, isDirty,
    fetchDetail, confirm, remove,
    updateScene, addScene, removeScene, regenerateScene,
    resetCurrentScript,
  } = useScriptStore();

  const [sceneModalOpen, setSceneModalOpen] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneForm] = Form.useForm();

  useEffect(() => {
    if (id) fetchDetail(id);
    return () => resetCurrentScript();
  }, [id]);

  if (loading || !currentScript) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  const s = currentScript;

  const handleAddScene = () => {
    sceneForm.resetFields();
    setEditingSceneId(null);
    setSceneModalOpen(true);
  };

  const handleEditScene = (sceneId: string) => {
    const scene = s.scenes.find((sc) => sc.id === sceneId);
    if (scene) {
      sceneForm.setFieldsValue(scene);
      setEditingSceneId(sceneId);
      setSceneModalOpen(true);
    }
  };

  const handleSceneFormSubmit = () => {
    sceneForm.validateFields().then((values) => {
      if (editingSceneId) {
        // 更新现有分镜
        updateScene(s.id, editingSceneId, values);
      } else {
        // 添加新分镜（插入到最后）
        const lastOrder = s.scenes.length > 0 ? s.scenes[s.scenes.length - 1].order : 0;
        const newScene: Omit<import('@aigc/shared-types').Scene, 'id' | 'order'> = {
          description: values.description,
          camera_motion: values.camera_motion || '固定镜头',
          duration: values.duration || 3,
          dialogue: values.dialogue || '',
          bgm_style: values.bgm_style || 'calm',
          subtitle: values.subtitle || '',
          visual_prompt: values.visual_prompt || values.description,
          constraints: values.constraints || [],
        };
        addScene(s.id, lastOrder, newScene);
      }
      setSceneModalOpen(false);
    });
  };

  const handleConfirm = async () => {
    Modal.confirm({
      title: '确认剧本',
      content: '确认后剧本将锁定，可用于视频生成。是否继续？',
      onOk: () => confirm(s.id),
    });
  };

  const handleDeleteScript = () => {
    Modal.confirm({
      title: '删除剧本',
      content: '删除后不可恢复，确定继续？',
      okType: 'danger',
      onOk: () => {
        remove(s.id);
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
          { title: s.product_info.name || s.id },
        ]}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/scripts')}>返回列表</Button>
            {s.status === 'draft' && (
              <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm}>
                确认剧本
              </Button>
            )}
            <Button danger icon={<DeleteOutlined />} onClick={handleDeleteScript}>删除</Button>
          </Space>
        }
      />

      <Row gutter={24}>
        {/* 左侧：剧本概要 */}
        <Col xs={24} md={8}>
          <Card title="剧本概要" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="商品">{s.product_info.name}</Descriptions.Item>
              <Descriptions.Item label="模式">
                <Tag>{SCRIPT_MODE_LABELS[s.mode] ?? s.mode}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={s.status} labels={SCRIPT_STATUS_LABELS} />
              </Descriptions.Item>
              <Descriptions.Item label="视觉风格">{s.visual_style}</Descriptions.Item>
              <Descriptions.Item label="总时长">{s.total_duration}s</Descriptions.Item>
              <Descriptions.Item label="分镜数">{s.scenes.length}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Text strong>叙事框架：</Text>
            <Text type="secondary">{s.narrative_framework}</Text>
            {isDirty && <Tag color="warning" style={{ marginTop: 8 }}>有未保存的修改</Tag>}
          </Card>

          {s.status === 'draft' && (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              block
              onClick={handleAddScene}
            >
              添加分镜
            </Button>
          )}
        </Col>

        {/* 右侧：分镜列表 */}
        <Col xs={24} md={16}>
          <Title level={5} style={{ marginBottom: 16 }}>
            分镜列表 ({s.scenes.length})
          </Title>

          {s.scenes.length === 0 ? (
            <EmptyState
              description="暂无分镜"
              actionText={s.status === 'draft' ? '添加第一个分镜' : undefined}
              onAction={s.status === 'draft' ? handleAddScene : undefined}
            />
          ) : (
            s.scenes
              .sort((a, b) => a.order - b.order)
              .map((scene, idx) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={idx}
                  onEdit={() => handleEditScene(scene.id)}
                  onDelete={() => {
                    Modal.confirm({
                      title: '删除分镜',
                      content: `确定要删除第 ${idx + 1} 镜吗？`,
                      okType: 'danger',
                      onOk: () => removeScene(s.id, scene.id),
                    });
                  }}
                  onRegenerate={() => {
                    Modal.confirm({
                      title: '重新生成',
                      content: '选择重新生成的目标：',
                      footer: (_, { OkBtn, CancelBtn }) => (
                        <Space>
                          <Button onClick={() => {
                            regenerateScene(s.id, scene.id, 'dialogue');
                            Modal.destroyAll();
                          }}>台词</Button>
                          <Button onClick={() => {
                            regenerateScene(s.id, scene.id, 'visual_prompt');
                            Modal.destroyAll();
                          }}>视觉 Prompt</Button>
                          <Button type="primary" onClick={() => {
                            regenerateScene(s.id, scene.id, 'all');
                            Modal.destroyAll();
                          }}>全部</Button>
                          <CancelBtn />
                        </Space>
                      ),
                    });
                  }}
                />
              ))
          )}
        </Col>
      </Row>

      {/* 分镜编辑 Modal */}
      <Modal
        title={editingSceneId ? '编辑分镜' : '添加分镜'}
        open={sceneModalOpen}
        onCancel={() => setSceneModalOpen(false)}
        onOk={handleSceneFormSubmit}
        width={640}
        destroyOnClose
      >
        <Form form={sceneForm} layout="vertical">
          <Form.Item name="description" label="画面描述" rules={[{ required: true, message: '请输入画面描述' }]}>
            <TextArea rows={3} placeholder="描述这一镜的画面内容..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="camera_motion" label="镜头运动">
                <Select
                  placeholder="选择镜头运动方式"
                  options={[
                    { label: '固定镜头', value: '固定镜头' },
                    { label: '推镜头', value: '推镜头' },
                    { label: '拉镜头', value: '拉镜头' },
                    { label: '摇镜头', value: '摇镜头' },
                    { label: '跟镜头', value: '跟镜头' },
                    { label: '俯拍', value: '俯拍' },
                    { label: '特写', value: '特写' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration" label="时长(s)">
                <InputNumber min={1} max={10} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dialogue" label="台词/旁白">
            <TextArea rows={2} placeholder="AI 生成的台词内容..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bgm_style" label="BGM 风格">
                <Select
                  placeholder="选择配乐风格"
                  options={[
                    { label: '轻快', value: 'upbeat' },
                    { label: '沉稳', value: 'calm' },
                    { label: '戏剧化', value: 'dramatic' },
                    { label: '搞笑', value: 'funny' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subtitle" label="字幕文本">
                <Input placeholder="字幕覆盖文本" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="visual_prompt" label="视觉 Prompt">
            <TextArea rows={2} placeholder="用于 AI 生成画面的 prompt..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
