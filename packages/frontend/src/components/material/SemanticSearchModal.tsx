import { useState, useCallback } from 'react';
import { Modal, Input, Select, Row, Col, Card, Empty, Spin, Tag, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { MaterialType } from '@aigc/shared-types';
import { useMaterialStore } from '../../stores/useMaterialStore';
import { useNavigate } from 'react-router-dom';
import { routePath } from '../../constants';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SemanticSearchModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { semanticResults, semanticLoading, semanticQuery, semanticSearch, clearSemanticSearch } = useMaterialStore();
  const handleClose = useCallback(() => {
    clearSemanticSearch();
    onClose();
  }, [clearSemanticSearch, onClose]);

  const handleViewDetail = useCallback((id: string) => {
    handleClose();
    navigate(routePath.materialDetail(id));
  }, [handleClose, navigate]);

  return (
    <Modal
      title="语义搜索"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">        {semanticLoading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="语义搜索中..." />
          </div>
        )}

        {!semanticLoading && semanticResults.length === 0 && semanticQuery && (
          <Empty description={`未找到与「${semanticQuery}」相关的素材`} />
        )}

        {!semanticLoading && semanticResults.length > 0 && (
          <div>
            <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
              搜索「{semanticQuery}」找到 {semanticResults.length} 个相关素材（相似度由高到低）
            </Text>
            <Row gutter={[12, 12]}>
              {semanticResults.map(({ material, score }) => (
                <Col xs={12} sm={8} md={6} key={material.id}>
                  <Card
                    hoverable
                    size="small"
                    cover={
                      material.type === 'video' ? (
                        <div style={{ position: 'relative' }}>
                          <img
                            src={material.thumbnail_url}
                            alt={material.name}
                            style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '6px 6px 0 0' }}
                          />
                          <Tag color="blue" style={{ position: 'absolute', top: 4, right: 4 }}>视频</Tag>
                        </div>
                      ) : (
                        <img
                          src={material.url}
                          alt={material.name}
                          style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '6px 6px 0 0' }}
                        />
                      )
                    }
                    onClick={() => handleViewDetail(material.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Card.Meta
                      title={<Text ellipsis style={{ fontSize: 13 }}>{material.name}</Text>}
                      description={
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <Tag color={score >= 0.8 ? 'green' : score >= 0.5 ? 'blue' : 'default'}>
                            相似度 {(score * 100).toFixed(0)}%
                          </Tag>
                          {material.ai_description && (
                            <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                              {material.ai_description}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </Space>
    </Modal>
  );
}