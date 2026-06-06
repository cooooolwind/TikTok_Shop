import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, List, Modal, Select, Space, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Template } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { useTemplateStore } from '../../stores/useTemplateStore';
import { usePagination } from '../../hooks/usePagination';
import { formatBeijingDateTime } from '../../utils/format';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  getTemplateModalMode,
  parseFactors,
  stringifyFactors,
  type TemplateModalMode,
} from './templateManager.helpers';

const { TextArea } = Input;

const columns: ColumnsType<Template> = [
  { title: '模板名称', dataIndex: 'name', width: 180 },
  { title: '策略', dataIndex: 'strategy', ellipsis: true },
  {
    title: '适用类目',
    dataIndex: 'applicable_categories',
    width: 200,
    render: (categories: string[]) => (
      <Space wrap>{categories.map((category) => <Tag key={category}>{category}</Tag>)}</Space>
    ),
  },
  {
    title: '因子数',
    dataIndex: 'factors',
    width: 90,
    render: (factors: Record<string, string>) => Object.keys(factors ?? {}).length,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (status: Template['status']) => (
      <Tag color={status === 'disabled' ? 'default' : 'success'}>
        {status === 'disabled' ? '停用' : '启用'}
      </Tag>
    ),
  },
  {
    title: '更新时间',
    dataIndex: 'updated_at',
    width: 180,
    render: (time: string) => formatBeijingDateTime(time),
  },
];

function getModalTitle(mode: TemplateModalMode) {
  if (mode === 'view') return '查看模板';
  if (mode === 'edit') return '编辑模板';
  return '新建模板';
}

export default function TemplateManager() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { items, total, loading, fetchList, fetchDetail, create, update, remove } = useTemplateStore();
  const pagination = usePagination({ defaultPageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [mode, setMode] = useState<TemplateModalMode>('create');
  const [form] = Form.useForm();

  const readOnly = mode === 'view';
  const modalTitle = useMemo(() => getModalTitle(mode), [mode]);

  useEffect(() => {
    fetchList(pagination.query);
  }, [fetchList, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ status: 'enabled' });
    setActiveTemplate(null);
    setMode('create');
    setModalOpen(true);
  };

  const openTemplate = (record: Template) => {
    fetchDetail(record.id);
    form.setFieldsValue({
      ...record,
      constraints: record.constraints.join('\n'),
      factorsText: stringifyFactors(record.factors),
      status: record.status ?? 'enabled',
    });
    setActiveTemplate(record);
    setMode(getTemplateModalMode(record));
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (readOnly) {
      setModalOpen(false);
      return;
    }

    form.validateFields().then((values) => {
      const { factorsText, ...rest } = values;
      const data = {
        ...rest,
        constraints:
          typeof values.constraints === 'string'
            ? values.constraints
                .split('\n')
                .map((item: string) => item.trim())
                .filter(Boolean)
            : values.constraints ?? [],
        factors: parseFactors(factorsText),
      };

      if (mode === 'edit' && activeTemplate) {
        update(activeTemplate.id, data);
      } else {
        create(data);
      }
      setModalOpen(false);
    });
  };

  const handleDelete = (record: Template) => {
    if (record.is_builtin) return;
    Modal.confirm({
      title: '确认删除',
      content: '删除模板后不可恢复',
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => remove(record.id),
    });
  };

  const renderActions = (record: Template) => (
    <Space>
      <Button
        size="small"
        icon={record.is_builtin ? <EyeOutlined /> : <EditOutlined />}
        onClick={(event) => {
          event.stopPropagation();
          openTemplate(record);
        }}
      >
        {record.is_builtin ? '查看' : '编辑'}
      </Button>
      <Button
        size="small"
        danger
        icon={<DeleteOutlined />}
        disabled={record.is_builtin}
        onClick={(event) => {
          event.stopPropagation();
          handleDelete(record);
        }}
      >
        删除
      </Button>
    </Space>
  );

  const renderMobileList = () => (
    <List
      loading={loading}
      dataSource={items}
      renderItem={(item) => (
        <Card key={item.id} style={{ marginBottom: 12, borderRadius: 8 }} hoverable onClick={() => openTemplate(item)}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{item.name}</strong>
              {item.is_builtin ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>{item.strategy}</div>
            <Space wrap>{item.applicable_categories.map((category) => <Tag key={category}>{category}</Tag>)}</Space>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #f0f0f0',
                paddingTop: 12,
              }}
            >
              <span style={{ fontSize: 12, color: '#999' }}>因子数：{Object.keys(item.factors || {}).length}</span>
              {renderActions(item)}
            </div>
          </Space>
        </Card>
      )}
    />
  );

  return (
    <div>
      <PageHeader
        title="灵感模板管理"
        breadcrumbs={[
          { title: '脚本工作台', path: '/scripts' },
          { title: '灵感模板管理' },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block={isMobile}>
            新建模板
          </Button>
        }
      />

      {isMobile ? (
        renderMobileList()
      ) : (
        <Table
          columns={[
            ...columns,
            {
              title: '操作',
              width: 160,
              render: (_, record) => renderActions(record),
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
          onRow={(record) => ({
            onClick: () => openTemplate(record),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      {isMobile && total > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button
            type="link"
            disabled={pagination.page * pagination.pageSize >= total}
            onClick={() => pagination.onChange(pagination.page + 1, pagination.pageSize)}
          >
            {pagination.page * pagination.pageSize >= total ? '没有更多了' : '加载更多'}
          </Button>
        </div>
      )}

      <Modal
        title={modalTitle}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={readOnly ? '关闭' : '保存'}
        cancelText="取消"
        cancelButtonProps={{ style: readOnly ? { display: 'none' } : undefined }}
        width={isMobile ? '100%' : 720}
        destroyOnClose
        style={isMobile ? { top: 20 } : {}}
      >
        <Form form={form} layout="vertical" disabled={readOnly}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如：痛点解决型" />
          </Form.Item>
          <Form.Item name="strategy" label="策略描述" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="如：先提出用户痛点，再展示商品解决方案，最后强化购买理由。" />
          </Form.Item>
          <Form.Item name="applicable_categories" label="适用类目" rules={[{ required: true }]}>
            <Select
              mode="tags"
              placeholder="选择或输入类目"
              options={[
                { value: 'fashion', label: 'fashion' },
                { value: 'beauty', label: 'beauty' },
                { value: 'home', label: 'home' },
                { value: 'electronics', label: 'electronics' },
                { value: 'food', label: 'food' },
                { value: 'general', label: 'general' },
              ]}
            />
          </Form.Item>
          <Form.Item name="factorsText" label="模板因子" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder={'pain: 痛点\nsolution: 解决方案\ncta: 转化引导'} />
          </Form.Item>
          <Form.Item name="constraints" label="约束条件（一行一条）">
            <TextArea rows={3} placeholder={'不要夸大商品功效\n不要虚假宣传\n避免使用绝对化表达'} />
          </Form.Item>
          <Form.Item name="prompt" label="模板提示词">
            <TextArea rows={5} placeholder="不填写时，系统会根据模板名称、策略和因子自动生成通用 prompt" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="enabled">
            <Select
              options={[
                { value: 'enabled', label: '启用' },
                { value: 'disabled', label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
