import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Empty, Row, Select, Space, Tag, Typography, theme } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useTemplateStore } from '../../stores/useTemplateStore';
import { formatBeijingDateTime } from '../../utils/format';
import { CATEGORY_LABELS, countTemplateFactors, getCategoryLabel } from './templateMarket.helpers';

const { Paragraph, Text } = Typography;

export default function TemplateMarketPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { token } = theme.useToken();
  const { items, loading, fetchList } = useTemplateStore();

  useEffect(() => {
    fetchList({ page: 1, pageSize: 50, status: 'enabled' });
  }, [fetchList]);

  return (
    <div>
      <PageHeader
        title="灵感模板广场"
        breadcrumbs={[{ title: '灵感模板广场' }]}
        extra={
          <Space wrap>
            <Select
              allowClear
              placeholder="适用类目"
              style={{ width: isMobile ? '100%' : 160 }}
              options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(category) => fetchList({ page: 1, pageSize: 50, status: 'enabled', category })}
            />
            <Button onClick={() => navigate('/templates')}>后台管理</Button>
          </Space>
        }
      />

      {!loading && items.length === 0 ? (
        <Empty description="暂无启用模板" />
      ) : (
        <Row gutter={[16, 16]} align="stretch">
          {items.map((template) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={template.id} style={{ display: 'flex' }}>
              <Card
                hoverable
                loading={loading}
                title={template.name}
                style={{ width: '100%', borderRadius: 8 }}
                styles={{ body: { display: 'flex', minHeight: 260, flexDirection: 'column' } }}
                extra={template.is_builtin ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>}
              >
                <Paragraph ellipsis={{ rows: 3 }} style={{ minHeight: 66 }}>
                  {template.strategy}
                </Paragraph>
                <Space wrap size={[4, 6]} style={{ marginBottom: 12 }}>
                  {template.applicable_categories.map((category) => (
                    <Tag key={category}>{getCategoryLabel(category)}</Tag>
                  ))}
                </Space>
                <Space direction="vertical" size={4} style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                  <Text type="secondary">因子数：{countTemplateFactors(template.factors)}</Text>
                  <Text type="secondary">更新时间：{formatBeijingDateTime(template.updated_at)}</Text>
                </Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  block
                  style={{ marginTop: 'auto' }}
                  onClick={() => navigate(`/template-market/${template.id}/use`)}
                >
                  使用该模板
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
