import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Select, Button, Space, Row, Col,
  Slider, Steps, Divider, Typography,
} from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useScriptStore } from '../../stores/useScriptStore';
import { useTemplateStore } from '../../stores/useTemplateStore';
import { useReferenceStore } from '../../stores/useReferenceStore';
import type { ScriptMode } from '@aigc/shared-types';

const { TextArea } = Input;
const { Text } = Typography;

export default function ScriptGenerate() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { generating, generate } = useScriptStore();
  const { items: templates, fetchList: fetchTemplates } = useTemplateStore();
  const { items: references, fetchList: fetchReferences } = useReferenceStore();
  const [mode, setMode] = useState<ScriptMode>('free');

  useEffect(() => {
    fetchTemplates({ pageSize: 100 });
    fetchReferences({ pageSize: 100 });
  }, []);

  const handleSubmit = async (values: Record<string, unknown>) => {
    const script = await generate({
      product_info: {
        name: values.product_name as string,
        description: values.product_description as string,
        category: values.product_category as string,
        selling_points: (values.selling_points as string[]) || [],
        target_audience: values.target_audience as string,
        price: values.price as string,
        link: values.product_link as string,
      },
      mode,
      template_id: values.template_id as string,
      reference_id: values.reference_id as string,
      preferences: {
        duration: values.duration as number,
        style: values.style as string,
        tone: values.tone as string,
        language: values.language as string,
      },
    });
    navigate(`/scripts/${script.id}`);
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
        {/* 左侧：表单 */}
        <Col xs={24} md={14}>
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                duration: 15,
                language: 'zh',
              }}
            >
              <Text strong style={{ fontSize: 16 }}>商品信息</Text>
              <Divider />
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="product_name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
                    <Input placeholder="如：夏季新款连衣裙" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="product_category" label="商品类目" rules={[{ required: true, message: '请输入类目' }]}>
                    <Input placeholder="如：女装/服饰" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="product_description" label="商品描述" rules={[{ required: true, message: '请输入商品描述' }]}>
                <TextArea rows={3} placeholder="简要描述商品的核心卖点、适用场景..." />
              </Form.Item>
              <Form.Item name="selling_points" label="卖点标签">
                <Select mode="tags" placeholder="输入卖点后回车（如：透气面料、显瘦设计）" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="target_audience" label="目标人群">
                    <Input placeholder="如：18-35岁女性" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="price" label="价格">
                    <Input placeholder="如：￥99" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="product_link" label="商品链接">
                <Input placeholder="TikTok Shop 商品链接（可选）" />
              </Form.Item>

              <Text strong style={{ fontSize: 16 }}>生成模式</Text>
              <Divider />
              <Form.Item name="mode">
                <Select
                  value={mode}
                  onChange={(v) => setMode(v)}
                  options={[
                    { label: '自由创作 — 基于商品信息直接生成', value: 'free' },
                    { label: '灵感模板 — 选取模板融合生成', value: 'template' },
                    { label: '爆款仿写 — 参考爆款视频产物', value: 'imitation' },
                  ]}
                />
              </Form.Item>

              {mode === 'template' && (
                <Form.Item name="template_id" label="选择模板" rules={[{ required: true, message: '请选择模板' }]}>
                  <Select
                    showSearch
                    placeholder="搜索模板名称/策略..."
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    options={templates.map((t) => ({ label: t.name, value: t.id }))}
                  />
                </Form.Item>
              )}

              {mode === 'imitation' && (
                <Form.Item name="reference_id" label="选择参考视频" rules={[{ required: true, message: '请选择参考视频' }]}>
                  <Select
                    showSearch
                    placeholder="搜索参考视频..."
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    options={references.filter((r) => r.analysis_status === 'done').map((r) => ({
                      label: `${r.source_platform}: ${r.category}`,
                      value: r.id,
                    }))}
                  />
                </Form.Item>
              )}

              <Text strong style={{ fontSize: 16 }}>偏好设置</Text>
              <Divider />
              <Form.Item name="duration" label={`目标时长: ${form.getFieldValue('duration') || 15}s`}>
                <Slider min={5} max={30} step={1} marks={{ 5: '5s', 15: '15s', 30: '30s' }} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="style" label="视频风格">
                    <Select
                      allowClear
                      placeholder="不限"
                      options={[
                        { label: '时尚', value: '时尚' },
                        { label: '简约', value: '简约' },
                        { label: '复古', value: '复古' },
                        { label: '科技', value: '科技' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="tone" label="语气风格">
                    <Select
                      allowClear
                      placeholder="不限"
                      options={[
                        { label: '热情', value: '热情' },
                        { label: '专业', value: '专业' },
                        { label: '幽默', value: '幽默' },
                        { label: '优雅', value: '优雅' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="language" label="语言">
                    <Select
                      options={[
                        { label: '中文', value: 'zh' },
                        { label: 'English', value: 'en' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Button
                type="primary"
                htmlType="submit"
                loading={generating}
                icon={<ThunderboltOutlined />}
                size="large"
                block
                style={{ marginTop: 16 }}
              >
                {generating ? 'AI 正在生成剧本...' : '开始生成剧本'}
              </Button>
            </Form>
          </Card>
        </Col>

        {/* 右侧：操作指引 */}
        <Col xs={24} md={10}>
          <Card title="生成流程" style={{ marginBottom: 24 }}>
            <Steps
              direction="vertical"
              size="small"
              current={-1}
              items={[
                { title: '填写商品信息', description: '越详细，生成的剧本目标越精准' },
                { title: '选择生成模式', description: '自由创作 / 灵感模板 / 爆款仿写' },
                { title: '设置偏好', description: '时长、风格、语气、语言' },
                { title: 'AI 生成', description: '基于商品 + 策略 + 因子生成完整分镜剧本' },
                { title: '编辑确认', description: '你可以对分镜进行调整后确认' },
              ]}
            />
          </Card>

          <Card title="三种模式说明">
            <Space direction="vertical">
              <div>
                <Text strong>自由创作</Text>
                <br />
                <Text type="secondary">直接输入商品信息，AI 自动创作完整的带货剧本</Text>
              </div>
              <div>
                <Text strong>灵感模板</Text>
                <br />
                <Text type="secondary">从已验证视频中提炼出的创作方法论，保证输出的风格一致性</Text>
              </div>
              <div>
                <Text strong>爆款仿写</Text>
                <br />
                <Text type="secondary">分析爆款视频的结构和手法，融合你的商品信息生成同款剧本</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
