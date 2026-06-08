import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Table, Tag, Select, Modal, Form, Input, List, Row, Col, Tabs, Upload, message
} from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ReferenceVideo } from '@aigc/shared-types';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { useReferenceStore } from '../../stores/useReferenceStore';
import { usePagination } from '../../hooks/usePagination';
import { ANALYSIS_STATUS_LABELS } from '../../constants';
import EmptyState from '../../components/common/EmptyState';
import { formatBeijingDateTime } from '../../utils/format';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const columns: ColumnsType<ReferenceVideo> = [
  { title: '来源平台', dataIndex: 'source_platform', width: 100, render: (p: string) => <Tag>{p === 'local_upload' ? '本地上传' : p}</Tag> },
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
    render: (t: string) => formatBeijingDateTime(t),
  },
];

export default function ReferenceList() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { items, total, loading, filters, fetchList, create, upload } = useReferenceStore();
  const pagination = usePagination({ defaultPageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [fileList, setFileList] = useState<any[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchList({ ...filters, ...pagination.query });
  }, [filters.category, filters.source_platform, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (activeTab === 'link') {
        create({
          source_url: values.source_url,
          source_platform: values.source_platform,
          category: values.category,
          source_declaration: values.source_declaration,
        });
        setModalOpen(false);
        form.resetFields();
      } else {
        if (fileList.length === 0) {
          message.error('请选择视频文件');
          return;
        }
        const file = fileList[0].originFileObj;
        upload(file, values.category, values.source_declaration);
        setModalOpen(false);
        form.resetFields();
        setFileList([]);
      }
    });
  };

  const renderMobileList = () => (
    <List
      loading={loading}
      dataSource={items}
      renderItem={(item) => (
        <Card
          key={item.id}
          style={{ marginBottom: 12 }}
          onClick={() => navigate(`/references/${item.id}`)}
          hoverable
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
            <Space>
              <Tag color="blue">{item.source_platform === 'local_upload' ? '本地上传' : item.source_platform}</Tag>
              <span style={{ fontWeight: 600 }}>{item.category}</span>
            </Space>
            <StatusTag status={item.analysis_status} labels={ANALYSIS_STATUS_LABELS} />
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            <div style={{ marginBottom: 4 }}>
              <strong>Hook:</strong> {item.analysis?.hook || '-'}
            </div>
            <div>
              <strong>声明:</strong> <Tag>{item.source_declaration}</Tag>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#999', textAlign: 'right' }}>
            {formatBeijingDateTime(item.created_at)}
          </div>
        </Card>
      )}
    />
  );

  return (
    <div>
      <PageHeader
        title="参考视频库"
        breadcrumbs={[
          { title: '剧本工作台', path: '/scripts' },
          { title: '参考视频库' },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} block={isMobile}>
            添加参考视频
          </Button>
        }
      />

      {isMobile ? (
        renderMobileList()
      ) : (
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
        title="添加参考视频"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setFileList([]);
        }}
        onOk={handleSubmit}
        width={isMobile ? '100%' : 520}
        style={isMobile ? { top: 20 } : {}}
        okText={activeTab === 'upload' ? '上传并分析' : '添加并分析'}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="本地上传" key="upload">
            <Form form={form} layout="vertical" initialValues={{ source_declaration: 'public_reference' }}>
              <Form.Item label="视频文件" required>
                <Upload
                  accept="video/*"
                  maxCount={1}
                  beforeUpload={() => false} // 手动处理上传
                  fileList={fileList}
                  onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                >
                  <Button icon={<UploadOutlined />}>选择视频</Button>
                </Upload>
              </Form.Item>
              <Form.Item name="category" label="商品类目" rules={[{ required: true, message: '请输入类目' }]}>
                <Input placeholder="如：美妆、服饰、3C" />
              </Form.Item>
              <Form.Item name="source_declaration" label="来源声明" rules={[{ required: true }]}>
                <Select
                  placeholder="选择来源声明"
                  options={[
                    { label: '自有视频（可商用）', value: 'owned_reference' },
                    { label: '公开视频（分析用途）', value: 'public_reference' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Tabs.TabPane>
          <Tabs.TabPane tab="链接提取 (暂未开放)" key="link" disabled>
            <Form form={form} layout="vertical" initialValues={{ source_declaration: 'public_reference' }}>
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
          </Tabs.TabPane>
        </Tabs>
      </Modal>
    </div>
  );
}
