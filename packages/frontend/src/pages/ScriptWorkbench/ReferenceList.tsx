import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Table, Tag, Select, Modal, Form, Input,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ReferenceVideo } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { useReferenceStore } from '../../stores/useReferenceStore';
import { usePagination } from '../../hooks/usePagination';
import { ANALYSIS_STATUS_LABELS } from '../../constants';
import EmptyState from '../../components/common/EmptyState';

const columns: ColumnsType<ReferenceVideo> = [
  { title: '来源平台', dataIndex: 'source_platform', width: 100, render: (p: string) => <Tag>{p}</Tag> },
  { title: '类目', dataIndex: 'category', width: 100 },
  {
    title: '来源声明', dataIndex: 'source_declaration', width: 100,
    render: (d: string) => <Tag>{d}</Tag>,
  },
  {
    title: '分析状态', dataIndex: 'analysis_status', width: 100,
    render: (s: string) => <StatusTag status={s} labels={ANALYSIS_STATUS_LABELS} />,
  },
  {
    title: 'Hook', dataIndex: ['analysis', 'hook'], ellipsis: true,
    render: (h: string | undefined) => h || '-',
  },
  {
    title: '添加时间', dataIndex: 'created_at', width: 180,
    render: (t: string) => new Date(t).toLocaleString(),
  },
];

export default function ReferenceList() {
  const navigate = useNavigate();
  const { items, total, loading, filters, fetchList, create } = useReferenceStore();
  const pagination = usePagination({ defaultPageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchList({ ...filters, ...pagination.query });
  }, [filters.category, filters.source_platform, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  const handleCreate = () => {
    form.validateFields().then((values) => {
      create(values);
      setModalOpen(false);
      form.resetFields();
    });
  };

  return (
    <div>
      <PageHeader
        title="参考视频库"
        breadcrumbs={[
          { title: '剧本工作台', path: '/scripts' },
          { title: '参考视频库' },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            添加参考视频
          </Button>
        }
      />

      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <EmptyState description="暂无参考视频" /> }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: pagination.onChange,
          showSizeChanger: false,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/references/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <Modal
        title="添加参考视频"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="source_url" label="视频链接" rules={[{ required: true, message: '请输入视频链接' }]}>
            <Input placeholder="TikTok / YouTube / 其他平台链接" />
          </Form.Item>
          <Form.Item name="source_platform" label="来源平台" rules={[{ required: true }]}>
            <Select
              placeholder="选择平台"
              options={[
                { label: 'TikTok', value: 'tiktok' },
                { label: '抖音', value: 'douyin' },
                { label: 'YouTube', value: 'youtube' },
                { label: 'Instagram', value: 'instagram' },
              ]}
            />
          </Form.Item>
          <Form.Item name="category" label="商品类目" rules={[{ required: true, message: '请输入类目' }]}>
            <Input placeholder="如：美妆、服饰、3C" />
          </Form.Item>
          <Form.Item name="source_declaration" label="来源声明" rules={[{ required: true }]}>
            <Select
              placeholder="选择来源声明"
              options={[
                { label: '公开视频（分析用途）', value: 'public_reference' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
