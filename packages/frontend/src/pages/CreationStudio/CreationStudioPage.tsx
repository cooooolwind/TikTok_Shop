import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Select, Space, Spin } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import TaskCard from '../../components/creation/TaskCard';
import EmptyState from '../../components/common/EmptyState';
import { useCreationStore } from '../../stores/useGenerationStore';
import { generationApi } from '../../services/generation.api';
import { TASK_STATUS_LABELS } from '../../constants';
import { formatGenerationTaskDisplayId } from '../../utils/format';
import type { GenerationTask, GenerationStatus } from '@aigc/shared-types';

const PAGE_SIZE = 20;

export default function CreationStudioPage() {
  const navigate = useNavigate();
  const { remove } = useCreationStore();
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<GenerationStatus | undefined>();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await generationApi.listTasks({
          page: pageNum,
          pageSize: PAGE_SIZE,
          status: statusFilter,
        });
        const data = res as unknown as { items: GenerationTask[]; total: number };
        if (append) {
          setTasks((prev) => [...prev, ...(data.items ?? [])]);
        } else {
          setTasks(data.items ?? []);
        }
        setTotal(data.total ?? 0);
      } catch {
        /* handled by store */
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    setPage(1);
    fetchPage(1, false);
  }, [statusFilter, fetchPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading || loadingMore || tasks.length >= total) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPage(nextPage, true);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, tasks.length, total, page, fetchPage]);

  const deleteTask = (task: GenerationTask) => {
    Modal.confirm({
      title: '删除创作任务',
      content: `确认删除「${formatGenerationTaskDisplayId(task)}」吗？关联的视频记录也会一起删除。`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        await remove(task.id);
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setTotal((prev) => Math.max(prev - 1, 0));
      },
    });
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 200px)' }}>
      <PageHeader
        title="创作工作室"
        extra={
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/creation/new')}>
              新建创作
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => navigate('/creation/new?quick=1')}>
              快速成片
            </Button>
          </Space>
        }
      />

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Select
          placeholder="任务状态"
          allowClear
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={Object.entries(TASK_STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))}
        />
      </div>

      {!loading && tasks.length === 0 ? (
        <EmptyState
          description="暂无创作任务"
          actionText="新建创作"
          onAction={() => navigate('/creation/new')}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(226px, 1fr))',
              gap: 4,
            }}
          >
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => navigate(`/creation/tasks/${task.id}`)}
                onDelete={() => deleteTask(task)}
              />
            ))}
          </div>

          <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loadingMore && <Spin size="small" />}
            {tasks.length >= total && total > 0 && (
              <span style={{ color: '#666', fontSize: 12 }}>已加载全部 {total} 个任务</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
