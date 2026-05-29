import { useEffect, useState } from 'react';
import {
  Card, Button, Table, Space, Modal, Form, Input, Select,
  Tag, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Template } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { useTemplateStore } from '../../stores/useTemplateStore';
import { usePagination } from '../../hooks/usePagination';
import { formatBeijingDateTime } from '../../utils/format';

const { TextArea } = Input;
const { Text } = Typography;

const columns: ColumnsType<Template> = [
  { title: '模板名称', dataIndex: 'name', width: 180 },
  { title: '策略', dataIndex: 'strategy', ellipsis: true },
  {
    title: '适用类目', dataIndex: 'applicable_categories', width: 200,
    render: (cats: string[]) => <Space wrap>{cats.map((c) => <Tag key={c}>{c}</Tag>)}</Space>,
  },
  {
    title: '因子数', dataIndex: 'factors', width: 80,
    render: (f: Record<string, string>) => Object.keys(f).length,
  },
  {
    title: '更新时间', dataIndex: 'updated_at', width: 180,
    render: (t: string) => formatBeijingDateTime(t),
  },
];

export default function TemplateManager() {
  const { items, total, loading, selectedTemplate, fetchList, fetchDetail, create, update, remove } = useTemplateStore();
  const pagination = usePagination({ defaultPageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchList(pagination.query);
  }, [pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  const openCreate = () => {
    form.resetFields();
    setEditing(false);
    setModalOpen(true);
  };

  const openEdit = (record: Template) => {
    fetchDetail(record.id);
    // 由于 fetchDetail 是异步的，这里直接从 record 初始化表单
    form.setFieldsValue({
      ...record,
      constraints: record.constraints.join('\n'),
    });
    setEditing(true);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const data = {
        ...values,
        constraints: typeof values.constraints === 'string'
          ? values.constraints.split('\n').filter(Boolean)
          : values.constraints,
        factors: values.factors || {},
      };
      if (editing && selectedTemplate) {
        update(selectedTemplate.id, data);
      } else {
        create(data);
      }
      setModalOpen(false);
    });
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除模板后不可恢复',
      okType: 'danger',
      onOk: () => remove(id),
    });
  };

  return (
    <div>
      <PageHeader
        title="灵感模板"
        breadcrumbs={[
          { title: '剧本工作台', path: '/scripts' },
          { title: '灵感模板' },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建模板
          </Button>
        }
      />

      <Table
        columns={[
          ...columns,
          {
            title: '操作', width: 120,
            render: (_, record) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEdit(record); }} />
                <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }} />
              </Space>
            ),
          },
        ]}
        dataSource={items}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <EmptyState description="暂无模板" actionText="新建模板" onAction={openCreate} /> }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: pagination.onChange,
          showSizeChanger: false,
        }}
      />

      <Modal
        title={editing ? '编辑模板' : '新建模板'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如：第一人称 BGM 氛围沉浸" />
          </Form.Item>
          <Form.Item name="strategy" label="策略描述" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="视频创作的抽象方法，如「第一人称 BGM 氛围沉浸」" />
          </Form.Item>
          <Form.Item name="constraints" label="约束条件（一行一条）">
            <TextArea rows={3} placeholder="必说的卖点&#10;禁止的动作&#10;品牌露出要求" />
          </Form.Item>
          <Form.Item name="applicable_categories" label="适用类目" rules={[{ required: true }]}>
            <Select mode="tags" placeholder="输入类目后回车" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
