import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Button, Input, Select, Space, Modal,
  Upload, Form, message,
} from 'antd';
import {
  UploadOutlined, SearchOutlined, DeleteOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import PageHeader from '../../components/common/PageHeader';
import MaterialCard from '../../components/material/MaterialCard';
import EmptyState from '../../components/common/EmptyState';
import { useMaterialStore } from '../../stores/useMaterialStore';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { usePagination } from '../../hooks/usePagination';
import { MATERIAL_CATEGORY_LABELS, MATERIAL_STATUS_LABELS } from '../../constants';
import { routePath } from '../../constants';
import { useNavigate } from 'react-router-dom';

const { Dragger } = Upload;

export default function MaterialManagementPage() {
  const navigate = useNavigate();
  const {
    items, total, loading, filters,
    uploadVisible, uploading, uploadProgress,
    fetchList, setFilters, remove, batchRemove,
    setUploadVisible, upload,
  } = useMaterialStore();

  const { value: keyword, debouncedValue: debouncedKeyword, setValue: setKeyword } = useDebouncedSearch(500);
  const pagination = usePagination({ defaultPageSize: 20 });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 初始加载 + 筛选变化时重新加载
  useEffect(() => {
    fetchList({
      ...filters,
      keyword: debouncedKeyword || undefined,
      ...pagination.query,
    });
  }, [debouncedKeyword, filters.type, filters.category, filters.status, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.setTotal(total);
  }, [total]);

  // 类型筛选
  const handleTypeChange = useCallback((val: string | undefined) => {
    setFilters({ type: val as 'image' | 'video' | undefined, page: 1 });
    pagination.reset();
  }, [setFilters, pagination]);

  const handleCategoryChange = useCallback((val: string | undefined) => {
    setFilters({ category: val, page: 1 });
    pagination.reset();
  }, [setFilters, pagination]);

  const handleStatusChange = useCallback((val: string | undefined) => {
    setFilters({ status: val as 'uploaded' | 'processing' | 'ready' | 'failed' | undefined, page: 1 });
    pagination.reset();
  }, [setFilters, pagination]);

  const handleBatchDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedIds.length} 项素材吗？`,
      okType: 'danger',
      onOk: () => {
        batchRemove(selectedIds);
        setSelectedIds([]);
      },
    });
  };

  const handleUploadOk = async (file: File) => {
    // 需要 category 和 source_declaration 从表单获取
    // 简化版：直接用默认值，完整版在 modal 中提供表单
    await upload(file, 'product', 'owned');
  };

  return (
    <div>
      <PageHeader
        title="素材管理"
        extra={
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>
            上传素材
          </Button>
        }
      />

      {/* 筛选栏 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input
            placeholder="搜索文件名 / 描述 / 标签..."
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={8} sm={5} md={3}>
          <Select
            placeholder="类型"
            allowClear
            style={{ width: '100%' }}
            onChange={handleTypeChange}
            options={[
              { label: '图片', value: 'image' },
              { label: '视频', value: 'video' },
            ]}
          />
        </Col>
        <Col xs={8} sm={5} md={3}>
          <Select
            placeholder="分类"
            allowClear
            style={{ width: '100%' }}
            onChange={handleCategoryChange}
            options={Object.entries(MATERIAL_CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
          />
        </Col>
        <Col xs={8} sm={5} md={3}>
          <Select
            placeholder="状态"
            allowClear
            style={{ width: '100%' }}
            onChange={handleStatusChange}
            options={Object.entries(MATERIAL_STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))}
          />
        </Col>
        {selectedIds.length > 0 && (
          <Col>
            <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              删除 ({selectedIds.length})
            </Button>
          </Col>
        )}
      </Row>

      {/* 素材列表 */}
      {!loading && items.length === 0 ? (
        <EmptyState
          description="暂无素材"
          actionText="上传素材"
          onAction={() => setUploadVisible(true)}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {items.map((m) => (
              <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
                <MaterialCard
                  material={m}
                  selected={selectedIds.includes(m.id)}
                  onClick={() => {
                    if (selectedIds.length > 0) {
                      // 多选模式
                      setSelectedIds((prev) =>
                        prev.includes(m.id)
                          ? prev.filter((id) => id !== m.id)
                          : [...prev, m.id],
                      );
                    } else {
                      navigate(routePath.materialDetail(m.id));
                    }
                  }}
                  onDelete={() => remove(m.id)}
                />
              </Col>
            ))}
          </Row>

          {/* 分页 */}
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Button
              disabled={pagination.page <= 1}
              onClick={() => pagination.onChange(pagination.page - 1, pagination.pageSize)}
              style={{ marginRight: 8 }}
            >
              上一页
            </Button>
            <span style={{ margin: '0 12px' }}>
              第 {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize) || 1} 页 (共 {pagination.total} 项)
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

      {/* 上传 Modal */}
      <Modal
        title="上传素材"
        open={uploadVisible}
        onCancel={() => setUploadVisible(false)}
        footer={null}
        width={560}
      >
        <UploadForm
          uploading={uploading}
          uploadProgress={uploadProgress}
          onUpload={(values: { file: any; category: string; source_declaration: string; tags: string[] }) => {
            const file = (values.file as any)?.originFileObj || values.file;
            upload(file as File, values.category, values.source_declaration, values.tags);
          }}
          onCancel={() => setUploadVisible(false)}
        />
      </Modal>
    </div>
  );
}

/** 上传表单子组件 */
function UploadForm({
  uploading, uploadProgress, onUpload, onCancel,
}: {
  uploading: boolean;
  uploadProgress: number;
  onUpload: (values: { file: File; category: string; source_declaration: string; tags: string[] }) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (!fileList[0]) return;
      const originFile = fileList[0].originFileObj || fileList[0];
      onUpload({
        file: originFile as unknown as File,
        category: values.category,
        source_declaration: values.source_declaration,
        tags: values.tags || [],
      });
    });
  };

  return (
    <Form form={form} layout="vertical" initialValues={{ category: 'product', source_declaration: 'owned' }}>
      <Form.Item label="选择文件" required>
        <Dragger
          fileList={fileList}
          onChange={({ fileList: fl }) => setFileList(fl)}
          beforeUpload={() => false}
          maxCount={1}
          accept="image/*,video/*"
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
          <p className="ant-upload-hint">支持 jpg/png/webp/mp4/mov/webm，图片最大 20MB，视频最大 500MB</p>
        </Dragger>
      </Form.Item>

      <Form.Item name="category" label="分类" rules={[{ required: true }]}>
        <Select
          options={Object.entries(MATERIAL_CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
        />
      </Form.Item>

      <Form.Item name="source_declaration" label="来源声明" rules={[{ required: true, message: '请选择素材来源' }]}>
        <Select
          options={[
            { label: '自有素材', value: 'owned' },
            { label: '公开可商用', value: 'public_commercial' },
            { label: '参考素材', value: 'reference' },
          ]}
        />
      </Form.Item>

      <Form.Item name="tags" label="标签">
        <Select mode="tags" placeholder="输入标签后回车" />
      </Form.Item>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={handleSubmit} loading={uploading}>
          {uploading ? `上传中 ${uploadProgress}%` : '确认上传'}
        </Button>
      </Space>
    </Form>
  );
}
