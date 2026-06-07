import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { CopyOutlined, RedoOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { TemplateGenerateRequest, TemplateGenerateResult } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import Loading from '../../components/common/Loading';
import { templatesApi } from '../../services/templates.api';
import { myVideosApi } from '../../services/my-videos.api';
import { useTemplateStore } from '../../stores/useTemplateStore';
import { formatBeijingDateTime } from '../../utils/format';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { buildSaveMyVideoPayload, getCategoryLabel } from './templateMarket.helpers';

const { TextArea } = Input;
const { Paragraph, Title } = Typography;

const defaultValues: Partial<TemplateGenerateRequest> = {
  productName: '草莓夹心饼干',
  category: '食品',
  sellingPoints: '酥脆、草莓味浓、独立包装、适合追剧',
  price: '19.9元',
  targetUser: '学生和上班族',
  promotion: '第二件半价',
  duration: '30秒',
  style: '开箱种草',
};

export default function TemplateUsePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [form] = Form.useForm<TemplateGenerateRequest>();
  const { selectedTemplate, fetchDetail } = useTemplateStore();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TemplateGenerateResult | null>(null);
  const [lastProductInfo, setLastProductInfo] = useState<TemplateGenerateRequest | null>(null);

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [fetchDetail, id]);

  const factorValues = useMemo(() => Object.values(selectedTemplate?.factors ?? {}), [selectedTemplate]);

  const generate = async () => {
    if (!id) return;
    const values = await form.validateFields();
    setGenerating(true);
    try {
      const nextResult = await templatesApi.generate(id, values);
      setResult(nextResult);
      setLastProductInfo(values);
      message.success('带货视频方案已生成');
    } finally {
      setGenerating(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    message.success('结果已复制');
  };

  const saveResult = async () => {
    if (!id || !selectedTemplate || !result || !lastProductInfo) return;
    setSaving(true);
    try {
      await myVideosApi.create(buildSaveMyVideoPayload(id, selectedTemplate.name, lastProductInfo, result));
      message.success('已保存到我的作品');
      navigate('/my-videos');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedTemplate) return <Loading />;

  return (
    <div>
      <PageHeader
        title="使用灵感模板"
        breadcrumbs={[
          { title: '灵感模板广场', path: '/template-market' },
          { title: selectedTemplate.name },
        ]}
      />

      <Row gutter={[16, 16]} align="top">
        <Col xs={24} lg={9}>
          <Card title={selectedTemplate.name} style={{ borderRadius: 8 }}>
            <Paragraph>{selectedTemplate.strategy}</Paragraph>
            <Space wrap style={{ marginBottom: 12 }}>
              {selectedTemplate.applicable_categories.map((category) => (
                <Tag key={category}>{getCategoryLabel(category)}</Tag>
              ))}
            </Space>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="模板因子">{factorValues.join('、') || '暂无'}</Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatBeijingDateTime(selectedTemplate.updated_at)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card title="商品信息" style={{ borderRadius: 8 }}>
            <Form form={form} layout="vertical" initialValues={defaultValues}>
              <Row gutter={isMobile ? 0 : 12}>
                <Col xs={24} md={12}>
                  <Form.Item name="productName" label="商品名称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="category" label="商品类目" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="sellingPoints" label="商品卖点" rules={[{ required: true }]}>
                    <TextArea rows={3} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="price" label="商品价格" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="targetUser" label="目标人群" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="promotion" label="优惠信息">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="duration" label="视频时长" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="style" label="期望风格" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" icon={<ThunderboltOutlined />} loading={generating} onClick={generate} block={isMobile}>
                生成带货视频方案
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      {result && (
        <Card
          title="生成结果"
          style={{ marginTop: 16, borderRadius: 8 }}
          extra={
            !isMobile && (
              <Space wrap>
                <Button icon={<CopyOutlined />} onClick={copyResult}>
                  复制结果
                </Button>
                <Button icon={<RedoOutlined />} onClick={generate} loading={generating}>
                  重新生成
                </Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={saveResult} loading={saving}>
                  保存到我的作品
                </Button>
              </Space>
            )
          }
        >
          <Title level={4}>{result.title}</Title>
          <Paragraph>{result.script}</Paragraph>
          <Divider />
          <Row gutter={[12, 12]}>
            {result.storyboard.map((shot) => (
              <Col xs={24} md={12} xl={8} key={shot.shot}>
                <div style={{ height: '100%', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                  <Paragraph strong>{`分镜 ${shot.shot}`}</Paragraph>
                  <Paragraph>{shot.content}</Paragraph>
                  <Paragraph type="secondary">{shot.videoPrompt}</Paragraph>
                </div>
              </Col>
            ))}
          </Row>
          <Divider />
          <Paragraph strong>发布文案</Paragraph>
          <Paragraph>{result.publishCopy}</Paragraph>
          <Space wrap>{result.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>
          {isMobile && (
            <div style={{ marginTop: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block type="primary" icon={<SaveOutlined />} onClick={saveResult} loading={saving}>
                  保存到我的作品
                </Button>
                <Button block icon={<CopyOutlined />} onClick={copyResult}>
                  复制结果
                </Button>
                <Button block icon={<RedoOutlined />} onClick={generate} loading={generating}>
                  重新生成
                </Button>
              </Space>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
