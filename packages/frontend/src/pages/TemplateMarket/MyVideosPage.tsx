import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Descriptions, List, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MyVideo } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { myVideosApi } from '../../services/my-videos.api';
import { formatBeijingDateTime } from '../../utils/format';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { Paragraph, Title } = Typography;

export default function MyVideosPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [items, setItems] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MyVideo | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      setItems(await myVideosApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const columns: ColumnsType<MyVideo> = [
    { title: '商品名称', dataIndex: 'product_name', ellipsis: true },
    { title: '使用模板', dataIndex: 'template_name', width: 180 },
    {
      title: '生成状态',
      dataIndex: 'status',
      width: 120,
      render: () => <Tag color="success">已生成</Tag>,
    },
    {
      title: '生成时间',
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => formatBeijingDateTime(value),
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => <Button onClick={() => setDetail(record)}>查看详情</Button>,
    },
  ];

  const renderDetail = (video: MyVideo) => (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="商品名称">{video.product_name}</Descriptions.Item>
        <Descriptions.Item label="使用模板">{video.template_name}</Descriptions.Item>
        <Descriptions.Item label="生成时间">{formatBeijingDateTime(video.created_at)}</Descriptions.Item>
      </Descriptions>
      <Title level={5}>{video.result.title}</Title>
      <Paragraph>{video.result.script}</Paragraph>
      {video.result.storyboard.map((shot) => (
        <div key={shot.shot} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          <Paragraph strong>{`分镜 ${shot.shot}`}</Paragraph>
          <Paragraph>{shot.content}</Paragraph>
          <Paragraph type="secondary">{shot.videoPrompt}</Paragraph>
        </div>
      ))}
      <Paragraph strong>发布文案</Paragraph>
      <Paragraph>{video.result.publishCopy}</Paragraph>
      <Space wrap>{video.result.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>
    </Space>
  );

  return (
    <div>
      <PageHeader title="我的作品" breadcrumbs={[{ title: '我的作品' }]} />

      {!loading && items.length === 0 ? (
        <EmptyState description="暂无保存作品" actionText="去选择模板" onAction={() => navigate('/template-market')} />
      ) : isMobile ? (
        <List
          loading={loading}
          dataSource={items}
          renderItem={(item) => (
            <Card key={item.id} style={{ marginBottom: 12, borderRadius: 8 }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{item.product_name}</strong>
                  <Tag color="success">已生成</Tag>
                </div>
                <span>使用模板：{item.template_name}</span>
                <span style={{ color: '#8c8c8c' }}>{formatBeijingDateTime(item.created_at)}</span>
                <Button block onClick={() => setDetail(item)}>
                  查看详情
                </Button>
              </Space>
            </Card>
          )}
        />
      ) : (
        <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={{ pageSize: 10 }} />
      )}

      <Modal
        title="作品详情"
        open={Boolean(detail)}
        onCancel={() => setDetail(null)}
        footer={null}
        width={isMobile ? '100%' : 760}
      >
        {detail && renderDetail(detail)}
      </Modal>
    </div>
  );
}
