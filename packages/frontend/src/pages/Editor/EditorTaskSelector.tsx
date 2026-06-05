import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, List, Tag, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useCreationStore } from '../../stores/useGenerationStore';
import { routePath } from '../../constants';
import { formatDuration } from '../../utils/format';
import PageHeader from '../../components/common/PageHeader';

const { Text } = Typography;

export default function EditorTaskSelector() {
  const navigate = useNavigate();
  const { tasks, loading, fetchTasks } = useCreationStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const doneTasks = tasks.filter((t) => t.status === 'done' && t.result?.segments?.length);

  return (
    <div>
      <PageHeader
        title="视频剪辑"
        breadcrumbs={[{ title: '首页', path: '/' }, { title: '视频剪辑' }]}
      />
      <Card title="选择任务进行剪辑">
        <List
          loading={loading}
          dataSource={doneTasks}
          locale={{
            emptyText: (
              <Empty description="暂无已完成的任务，请先在创作工作室生成视频" />
            ),
          }}
          renderItem={(task) => (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => navigate(routePath.editorTask(task.id))}
                >
                  进入剪辑
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={task.display_id ?? task.id}
                description={
                  <>
                    <Tag color="green">{task.result?.resolution ?? '--'}</Tag>
                    <Tag>{task.result?.segments?.length ?? 0} 个片段</Tag>
                    <Text type="secondary">
                      {task.result ? formatDuration(task.result.duration) : '--'}
                    </Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
