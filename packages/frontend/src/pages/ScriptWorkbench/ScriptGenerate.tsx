import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Divider, Form, Input, Row, Select, Slider, Space, Typography } from 'antd';
import { EditOutlined, FileTextOutlined, PictureOutlined, ThunderboltOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useMaterialStore } from '../../stores/useMaterialStore';
import { useScriptStore } from '../../stores/useScriptStore';
import { useTemplateStore } from '../../stores/useTemplateStore';
import {
  buildManualDraftPayload,
  buildScriptGeneratePayload,
  type ScriptEntryMode,
  type ScriptGenerateFormValues,
} from './scriptGenerate.helpers';

const { TextArea } = Input;
const { Text } = Typography;

const ENTRY_OPTIONS = [
  { label: '选择素材生成', value: 'material', icon: <PictureOutlined /> },
  { label: '剧本模板生成', value: 'template', icon: <FileTextOutlined /> },
  { label: '粘贴文本解析', value: 'manual_text', icon: <ThunderboltOutlined /> },
  { label: '自己写剧本', value: 'manual_structured', icon: <EditOutlined /> },
];

export default function ScriptGenerate() {
  const navigate = useNavigate();
  const [form] = Form.useForm<ScriptGenerateFormValues>();
  const [entry, setEntry] = useState<ScriptEntryMode>('material');
  const { generating, create, generate } = useScriptStore();
  const { items: templates, fetchList: fetchTemplates } = useTemplateStore();
  const { items: materials, fetchList: fetchMaterials } = useMaterialStore();

  useEffect(() => {
    fetchTemplates({ pageSize: 100 });
    fetchMaterials({ pageSize: 100 });
  }, [fetchTemplates, fetchMaterials]);

  const handleSubmit = async (values: ScriptGenerateFormValues) => {
    const payload = { ...values, entry };
    if (entry === 'manual_structured') {
      const script = await create(buildManualDraftPayload(payload));
      navigate(`/scripts/${script.id}`);
      return;
    }

    const result = await generate(buildScriptGeneratePayload(payload));
    navigate(`/scripts/${result.script.id}`);
  };

  return (
    <div>
      <PageHeader
        title="生成剧本"
        breadcrumbs={[
          { title: '剧本工作台', path: '/scripts' },
          { title: '新建剧本' },
        ]}
      />

      <Row gutter={24}>
        <Col xs={24} lg={15}>
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ duration: 15, language: 'zh', entry: 'material' }}
            >
              <Text strong>创作入口</Text>
              <Divider />
              <Form.Item name="entry">
                <Select
                  value={entry}
                  onChange={(value) => setEntry(value)}
                  options={ENTRY_OPTIONS.map((option) => ({
                    label: (
                      <Space>
                        {option.icon}
                        {option.label}
                      </Space>
                    ),
                    value: option.value,
                  }))}
                />
              </Form.Item>

              <Text strong>商品信息</Text>
              <Divider />
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="product_name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
                    <Input placeholder="例如：夏季轻薄连衣裙" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="product_category" label="商品类目" rules={[{ required: true, message: '请输入商品类目' }]}>
                    <Input placeholder="例如：fashion" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="product_description" label="商品描述" rules={[{ required: true, message: '请输入商品描述' }]}>
                <TextArea rows={3} placeholder="简要描述商品特点、适用场景和核心卖点" />
              </Form.Item>
              <Form.Item name="selling_points" label="卖点标签">
                <Select mode="tags" placeholder="输入卖点后回车，例如：透气、显瘦、易打理" />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="target_audience" label="目标人群">
                    <Input placeholder="例如：18-35 岁女性" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="price" label="价格">
                    <Input placeholder="例如：$29.99" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="product_link" label="商品链接">
                <Input placeholder="TikTok Shop 商品链接，可选" />
              </Form.Item>

              {entry === 'material' && (
                <>
                  <Text strong>素材选择</Text>
                  <Divider />
                  <Form.Item name="material_ids" label="选择素材" rules={[{ required: true, message: '请选择至少一个素材' }]}>
                    <Select
                      mode="multiple"
                      showSearch
                      placeholder="可选择 uploaded 或 ready 素材"
                      optionFilterProp="label"
                      options={materials.map((material) => ({
                        label: `${material.filename} · ${material.status}`,
                        value: material.id,
                      }))}
                    />
                  </Form.Item>
                </>
              )}

              {entry === 'template' && (
                <>
                  <Text strong>模板选择</Text>
                  <Divider />
                  <Form.Item name="template_id" label="选择模板" rules={[{ required: true, message: '请选择模板' }]}>
                    <Select
                      showSearch
                      placeholder="搜索模板名称"
                      optionFilterProp="label"
                      options={templates.map((template) => ({
                        label: `${template.name}${template.is_builtin ? ' · 内置' : ''}`,
                        value: template.id,
                      }))}
                    />
                  </Form.Item>
                </>
              )}

              {entry === 'manual_text' && (
                <>
                  <Text strong>已有剧本文本</Text>
                  <Divider />
                  <Form.Item name="manual_text" label="粘贴完整剧本" rules={[{ required: true, message: '请输入剧本文本' }]}>
                    <TextArea rows={8} placeholder="粘贴已有脚本，AI 会解析为结构化分镜" />
                  </Form.Item>
                </>
              )}

              <Text strong>偏好设置</Text>
              <Divider />
              <Form.Item name="duration" label="目标时长">
                <Slider min={5} max={60} step={1} marks={{ 5: '5s', 15: '15s', 30: '30s', 60: '60s' }} />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="style" label="视觉风格">
                    <Select allowClear placeholder="不限" options={['时尚', '简约', '科技', '生活化'].map((v) => ({ label: v, value: v }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="tone" label="语气风格">
                    <Select allowClear placeholder="不限" options={['热情', '专业', '幽默', '克制'].map((v) => ({ label: v, value: v }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="language" label="语言">
                    <Select options={[{ label: '中文', value: 'zh' }, { label: 'English', value: 'en' }]} />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" htmlType="submit" loading={generating} icon={<ThunderboltOutlined />} size="large" block>
                {entry === 'manual_structured' ? '创建空白草稿' : '提交生成任务'}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="生成说明">
            <Space direction="vertical" size={12}>
              <Text>素材生成会把所选素材的文件名、分类、标签和 AI 描述作为上下文。</Text>
              <Text>模板生成会使用模板的策略、因子和约束控制输出结构。</Text>
              <Text>粘贴文本会通过 AI 解析成分镜；自己写剧本会直接创建空白草稿。</Text>
              <Text type="secondary">提交后剧本会出现在列表中，状态为生成中；失败后可进入详情页重试。</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
