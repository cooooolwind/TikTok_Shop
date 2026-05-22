import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Tag, Select, Input } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Script } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { useScriptStore } from '../../stores/useScriptStore';
import { usePagination } from '../../hooks/usePagination';
import { SCRIPT_MODE_LABELS, SCRIPT_STATUS_LABELS } from '../../constants';

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
    width: 100,
    render: (mode: string) => <Tag>{SCRIPT_MODE_LABELS[mode] ?? mode}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (s: string) => <StatusTag status={s} labels={SCRIPT_STATUS_LABELS} />,
  },
  {
    title: '分镜数',
    dataIndex: 'scenes',
    width: 80,
    render: (scenes: Script['scenes']) => scenes?.length ?? 0,
  },
  {
    title: '总时长',
    dataIndex: 'total_duration',
    width: 80,
    render: (d: number) => `${d}s`,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    width: 180,
    render: (t: string) => new Date(t).toLocaleString(),
  },
];

export default function ScriptWorkbenchPage() {
  const navigate = useNavigate();
  const { items, total, loading, filters, fetchList, setFilters } = useScriptStore();
  const pagination = usePagination({ defaultPageSize: 20 });

  useEffect(() => {
    fetchList({ ...filters, ...pagination.query });
  }, [filters.status, filters.mode, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  return (
    <div>
      <PageHeader
        title="剧本工作台"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/scripts/generate')}>
            生成剧本
          </Button>
        }
      />

      {/* 筛选栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 120 }}
          onChange={(v) => setFilters({ status: v })}
          options={Object.entries(SCRIPT_STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))}
        />
        <Select
          placeholder="模式"
          allowClear
          style={{ width: 120 }}
          onChange={(v) => setFilters({ mode: v })}
          options={Object.entries(SCRIPT_MODE_LABELS).map(([k, v]) => ({ label: v, value: k }))}
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
