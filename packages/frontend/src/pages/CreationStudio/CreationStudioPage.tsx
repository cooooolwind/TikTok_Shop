import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
<<<<<<< HEAD
import { Row, Col, Button, Modal, Space, Select } from 'antd';
=======
import { Button, Col, Modal, Row, Select, Space } from 'antd';
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import TaskCard from '../../components/creation/TaskCard';
import EmptyState from '../../components/common/EmptyState';
import { useCreationStore } from '../../stores/useGenerationStore';
import { usePagination } from '../../hooks/usePagination';
import { TASK_STATUS_LABELS } from '../../constants';
import { formatGenerationTaskDisplayId } from '../../utils/format';
import type { GenerationTask } from '@aigc/shared-types';

export default function CreationStudioPage() {
  const navigate = useNavigate();
  const {
    tasks, total, loading, filters,
<<<<<<< HEAD
    fetchTasks, remove, setFilters,
=======
    fetchTasks, setFilters, remove,
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
  } = useCreationStore();
  const pagination = usePagination({ defaultPageSize: 12 });

  useEffect(() => {
    fetchTasks({ ...filters, ...pagination.query });
  }, [filters.status, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

<<<<<<< HEAD
  const handleDeleteTask = (taskId: string) => {
    Modal.confirm({
      title: '删除创作任务',
      content: '删除后任务记录和已生成的视频记录会一起移除，确认删除？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => remove(taskId),
=======
  const deleteTask = (task: GenerationTask) => {
    Modal.confirm({
      title: '删除创作任务',
      content: `确认删除「${formatGenerationTaskDisplayId(task)}」吗？关联的视频记录也会一起删除。`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        await remove(task.id);
        fetchTasks({ ...filters, ...pagination.query });
      },
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
    });
  };

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
          <Row gutter={[16, 16]} align="stretch">
            {tasks.map((task) => (
              <Col xs={24} sm={12} md={8} lg={6} key={task.id} style={{ display: 'flex' }}>
                <TaskCard
                  task={task}
                  onClick={() => navigate(`/creation/tasks/${task.id}`)}
<<<<<<< HEAD
                  onDelete={() => handleDeleteTask(task.id)}
=======
                  onDelete={() => deleteTask(task)}
>>>>>>> 3e1695cd564c5204c16ded6213fd5889a8cae315
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
