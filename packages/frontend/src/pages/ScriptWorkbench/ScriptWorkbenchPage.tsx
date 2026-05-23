import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Script } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { usePagination } from '../../hooks/usePagination';
import { SCRIPT_MODE_LABELS, SCRIPT_STATUS_LABELS } from '../../constants';
import { useScriptStore } from '../../stores/useScriptStore';

const columns: ColumnsType<Script> = [
  {
    title: '剧本 ID',
    dataIndex: 'id',
    width: 120,
    render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id.slice(0, 8)}...</span>,
  },
  {
    title: '商品',
    dataIndex: ['product_info', 'name'],
    ellipsis: true,
  },
  {
    title: '模式',
    dataIndex: 'mode',
    width: 120,
    render: (mode: string) => <Tag>{SCRIPT_MODE_LABELS[mode] ?? mode}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 120,
    render: (status: string) => <StatusTag status={status} labels={SCRIPT_STATUS_LABELS} />,
  },
  {
    title: '分镜数',
    dataIndex: 'scenes',
    width: 90,
    render: (scenes: Script['scenes']) => scenes?.length ?? 0,
  },
  {
    title: '总时长',
    dataIndex: 'total_duration',
    width: 90,
    render: (duration: number) => `${duration ?? 0}s`,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    width: 180,
    render: (value: string) => new Date(value).toLocaleString(),
  },
];

export default function ScriptWorkbenchPage() {
  const navigate = useNavigate();
  const { items, total, loading, filters, fetchList, setFilters } = useScriptStore();
  const pagination = usePagination({ defaultPageSize: 20 });

  useEffect(() => {
    fetchList({ ...filters, ...pagination.query });
  }, [filters.status, filters.mode, filters.keyword, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  return (
    <div>
      <PageHeader
        title="剧本工作台"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/scripts/generate')}>
            新建剧本
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索商品名称"
          allowClear
          style={{ width: 220 }}
          onSearch={(keyword) => setFilters({ keyword, page: 1 })}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 140 }}
          onChange={(status) => setFilters({ status, page: 1 })}
          options={Object.entries(SCRIPT_STATUS_LABELS).map(([value, label]) => ({ label, value }))}
        />
        <Select
          placeholder="模式"
          allowClear
          style={{ width: 140 }}
          onChange={(mode) => setFilters({ mode, page: 1 })}
          options={Object.entries(SCRIPT_MODE_LABELS).map(([value, label]) => ({ label, value }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: pagination.onChange,
          showSizeChanger: false,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/scripts/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
}
