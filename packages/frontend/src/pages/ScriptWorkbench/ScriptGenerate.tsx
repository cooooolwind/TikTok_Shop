import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Divider, Form, Input, Row, Select, Slider, Space, Tag, Typography } from 'antd';
import { EditOutlined, FileTextOutlined, PictureOutlined, ThunderboltOutlined, VideoCameraOutlined } from '@ant-design/icons';
import type { Material } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import { useMaterialStore } from '../../stores/useMaterialStore';
import { useScriptStore } from '../../stores/useScriptStore';
import { useTemplateStore } from '../../stores/useTemplateStore';
import { materialsApi } from '../../services/materials.api';
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
  { label: '爆款仿写生成', value: 'imitation', icon: <VideoCameraOutlined /> },
  { label: '粘贴文本解析', value: 'manual_text', icon: <ThunderboltOutlined /> },
  { label: '自己写剧本', value: 'manual_structured', icon: <EditOutlined /> },
] as const;

function materialTypeLabel(type: Material['type']) {
  return type === 'video' ? '视频' : '图片';
}

export default function ScriptGenerate() {
  const navigate = useNavigate();
  const [form] = Form.useForm<ScriptGenerateFormValues>();
  const [entry, setEntry] = useState<ScriptEntryMode>('material');
  const { generating, create, generate } = useScriptStore();
  const { items: templates, fetchList: fetchTemplates } = useTemplateStore();
  const { items: materials, fetchList: fetchMaterials } = useMaterialStore();
  const [references, setReferences] = useState<Material[]>([]);

  useEffect(() => {
    fetchTemplates({ pageSize: 100 });
    fetchMaterials({ pageSize: 100 });
    materialsApi.list({ source_declaration: 'reference', pageSize: 100 }).then((res: any) => {
      setReferences(res.items);
    });
  }, [fetchTemplates, fetchMaterials]);

  const materialOptions = useMemo(
    () =>
      materials
        .filter((material) => (material.type === 'image' || material.type === 'video') && material.source_declaration !== 'reference')
        .sort((a, b) => {
          const typeRank = (material: Material) => (material.type === 'video' ? 0 : 1);
          const categoryRank = (material: Material) => (material.category === 'product' ? 0 : 1);
          return typeRank(a) - typeRank(b) || categoryRank(a) - categoryRank(b);
        })
        .map((material) => ({
          label: `${material.name} · ${materialTypeLabel(material.type)} · ${material.category} · ${material.status}`,
          value: material.id,
        })),
    [materials],
  );

  const handleSubmit = async (values: ScriptGenerateFormValues) => {
    const selectedImageUrls =
      values.material_ids
        ?.map((id) => materials.find((material) => material.id === id))
        .filter((material) => material?.type === 'image' && Boolean(material.url))
        .map((material) => material!.url) ?? [];
    const payload = { ...values, entry, product_image_urls: selectedImageUrls };

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
          { title: '脚本工作台', path: '/scripts' },
          { title: '新建剧本' },
        ]}
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ duration: 12, language: 'zh', entry: 'material' }}
            >
              <Text strong>创作入口</Text>
              <Divider />
              <Form.Item name="entry">
                <Select
                  value={entry}
                  onChange={(value) => {
                    setEntry(value);
                    form.setFieldsValue({ entry: value });
                  }}
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
                    <Input placeholder="例如：29.99" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="product_link" label="商品链接">
                <Input placeholder="TikTok Shop 商品链接，可选" />
              </Form.Item>
              <Form.Item
                name="product_image_url"
                label="商品图 URL"
                rules={[{ type: 'url', warningOnly: true, message: '建议填写可访问的图片 URL' }]}
                extra="可手动填写商品图，也可以从素材库选择图片；选择视频素材时会作为脚本生成的视频参考上下文。"
              >
                <Input placeholder="https://example.com/product.jpg" />
              </Form.Item>

              <Text strong>素材库素材</Text>
              <Divider />
              <Form.Item
                name="material_ids"
                label="选择图片或视频素材"
                rules={[
                  {
                    required: entry === 'material' || entry === 'imitation',
                    message: '请选择至少一个图片或视频素材',
                  },
                ]}
                extra="四种入口都可以选择素材库视频；图片素材会额外作为商品图参考，视频素材会传入生成链路作为参考上下文。"
              >
                <Select
                  mode="multiple"
                  showSearch
                  placeholder="请选择素材库中的图片或视频"
                  optionFilterProp="label"
                  options={materialOptions}
                />
              </Form.Item>

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

              {entry === 'imitation' && (
                <>
                  <Text strong>参考视频</Text>
                  <Divider />
                  <Form.Item name="reference_id" label="选择参考视频" rules={[{ required: true, message: '请选择参考视频' }]}>
                    <Select
                      showSearch
                      placeholder="搜索参考视频类目或特征"
                      optionFilterProp="label"
                      options={references
                        .filter((r) => r.status === 'ready')
                        .map((ref) => ({
                          label: `${ref.name} · ${ref.category}${ref.reference_analysis?.hook ? ` · Hook: ${ref.reference_analysis.hook}` : ''}`,
                          value: ref.id,
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
                    <TextArea rows={8} placeholder="粘贴已有脚本，AI 会结合商品信息和素材库视频解析为结构化分镜" />
                  </Form.Item>
                </>
              )}

              <Text strong>偏好设置</Text>
              <Divider />
              <Form.Item name="duration" label="目标时长">
                <Slider min={5} max={12} step={1} marks={{ 5: '5s', 10: '10s', 12: '12s' }} />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="style" label="视觉风格">
                    <Select
                      allowClear
                      placeholder="不限"
                      options={['时尚', '简约', '科技', '生活化'].map((value) => ({ label: value, value }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="tone" label="语气风格">
                    <Select
                      allowClear
                      placeholder="不限"
                      options={['热情', '专业', '幽默', '克制'].map((value) => ({ label: value, value }))}
                    />
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
              <Text>四种入口都可以从素材库选择图片或视频，所选素材会随请求一起传入后端。</Text>
              <Text>图片素材会补充到商品图参考中，视频素材会作为参考媒体和上下文参与脚本生成。</Text>
              <Text>模板生成会使用模板策略、因子和约束；粘贴文本会解析为结构化分镜；自己写剧本会创建空白草稿并保留所选素材。</Text>
              <Space wrap>
                <Tag color="blue">图片素材</Tag>
                <Tag color="purple">视频素材</Tag>
                <Tag color="green">四种入口通用</Tag>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
