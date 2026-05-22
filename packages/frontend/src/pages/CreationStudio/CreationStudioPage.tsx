import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Button, Space, Select, Empty } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import TaskCard from '../../components/creation/TaskCard';
import EmptyState from '../../components/common/EmptyState';
import { useCreationStore } from '../../stores/useGenerationStore';
import { usePagination } from '../../hooks/usePagination';
import { TASK_STATUS_LABELS } from '../../constants';

export default function CreationStudioPage() {
  const navigate = useNavigate();
  const {
    tasks, total, loading, filters,
    fetchTasks, setFilters,
  } = useCreationStore();
  const pagination = usePagination({ defaultPageSize: 12 });

  useEffect(() => {
    fetchTasks({ ...filters, ...pagination.query });
  }, [filters.status, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  return (
    <div>
      <PageHeader
        title="创作工作室"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/creation/new')}>
              新建创作
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => navigate('/creation/new?quick=1')}>
              快速成片
            </Button>
          </Space>
        }
      />

      {/* 状态筛选 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            placeholder="任务状态"
            allowClear
            style={{ width: 140 }}
            onChange={(v) => setFilters({ status: v })}
            options={Object.entries(TASK_STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))}
          />
        </Col>
      </Row>

      {!loading && tasks.length === 0 ? (
        <EmptyState
          description="暂无创作任务"
          actionText="新建创作"
          onAction={() => navigate('/creation/new')}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {tasks.map((task) => (
              <Col xs={24} sm={12} md={8} lg={6} key={task.id}>
                <TaskCard
                  task={task}
                  onClick={() => navigate(`/creation/tasks/${task.id}`)}
                />
              </Col>
            ))}
          </Row>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Button
              disabled={pagination.page <= 1}
              onClick={() => pagination.onChange(pagination.page - 1, pagination.pageSize)}
              style={{ marginRight: 8 }}
            >
              上一页
            </Button>
            <span style={{ margin: '0 12px' }}>
              第 {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
            </span>
            <Button
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              onClick={() => pagination.onChange(pagination.page + 1, pagination.pageSize)}
            >
              下一页
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
