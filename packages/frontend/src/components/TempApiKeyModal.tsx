import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message, Typography, Collapse } from 'antd';
import { systemApi } from '../services/system.api';
import type { AiSettingsDto } from '@aigc/shared-types';
import CryptoJS from 'crypto-js';

const { Text } = Typography;

export interface TempApiKeyModalProps {
  open: boolean;
  onCancel: () => void;
}

export const TempApiKeyModal: React.FC<TempApiKeyModalProps> = ({ open, onCancel }) => {
  const [form] = Form.useForm<AiSettingsDto>();
  const [status, setStatus] = React.useState<{ has_temp_settings: boolean; settings?: AiSettingsDto }>({
    has_temp_settings: false,
  });
  const [loading, setLoading] = React.useState(false);

  // Read secret from Vite env, fallback to hardcoded string to avoid crash if not set in some env
  const SECRET = import.meta.env.VITE_TEMP_KEY_SECRET || 'your_secret_passphrase';

  const fetchStatus = async () => {
    try {
      const res = await systemApi.getTempApiKey();
      setStatus({
        has_temp_settings: res.has_temp_settings,
        settings: res.settings,
      });
      if (res.has_temp_settings && res.settings) {
        form.setFieldsValue({
          volcano_api_key: '',
          volcano_text_api_key: '',
          volcano_text_endpoint: res.settings.volcano_text_endpoint || '',
          volcano_image_api_key: '',
          volcano_image_endpoint: res.settings.volcano_image_endpoint || '',
          volcano_video_api_key: '',
          volcano_video_endpoint: res.settings.volcano_video_endpoint || '',
          volcano_embedding_api_key: '',
          volcano_embedding_endpoint: res.settings.volcano_embedding_endpoint || '',
        });
      } else {
        form.resetFields();
      }
    } catch (error) {
      console.error('Failed to fetch temp api settings status', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open]);

  const onFinish = async (values: AiSettingsDto) => {
    setLoading(true);
    try {
      const payload: AiSettingsDto = {};
      Object.entries(values).forEach(([key, val]) => {
        if (val) payload[key as keyof AiSettingsDto] = val;
      });

      // 加盐 AES 加密传输
      const jsonStr = JSON.stringify(payload);
      const ciphertext = CryptoJS.AES.encrypt(jsonStr, SECRET).toString();

      await systemApi.setTempApiKey({ payload: ciphertext });
      message.success('临时配置已设置，仅在本次服务器运行期间有效。');
      await fetchStatus();
      onCancel();
    } catch (error) {
      message.error('设置失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      // 传递空对象的加密串
      const ciphertext = CryptoJS.AES.encrypt('{}', SECRET).toString();
      await systemApi.setTempApiKey({ payload: ciphertext });
      message.success('已清除临时配置，恢复系统默认。');
      form.resetFields();
      await fetchStatus();
    } catch (error) {
      message.error('清除失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = (key?: string) => {
    if (!key) return <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>未设置</Text>;
    return <Text type="success" style={{ fontSize: 12, marginLeft: 8 }}>已覆盖 ({key})</Text>;
  };

  const items = [
    {
      key: '1',
      label: '通用配置',
      children: (
        <>
          <Form.Item name="volcano_api_key" label={<>公共 API Key {renderStatus(status.settings?.volcano_api_key)}</>}>
            <Input.Password placeholder="留空则使用系统环境变量" />
          </Form.Item>
        </>
      ),
    },
    {
      key: '2',
      label: '文本模型 (Seed)',
      children: (
        <>
          <Form.Item name="volcano_text_api_key" label={<>API Key {renderStatus(status.settings?.volcano_text_api_key)}</>}>
            <Input.Password placeholder="留空则使用公共 API Key" />
          </Form.Item>
          <Form.Item name="volcano_text_endpoint" label="接入点 (Endpoint)">
            <Input placeholder="例如：ep-..." />
          </Form.Item>
        </>
      ),
    },
    {
      key: '3',
      label: '图像模型 (Seedream)',
      children: (
        <>
          <Form.Item name="volcano_image_api_key" label={<>API Key {renderStatus(status.settings?.volcano_image_api_key)}</>}>
            <Input.Password placeholder="留空则使用公共 API Key" />
          </Form.Item>
          <Form.Item name="volcano_image_endpoint" label="接入点 (Endpoint)">
            <Input placeholder="例如：ep-..." />
          </Form.Item>
        </>
      ),
    },
    {
      key: '4',
      label: '视频模型 (Seedance)',
      children: (
        <>
          <Form.Item name="volcano_video_api_key" label={<>API Key {renderStatus(status.settings?.volcano_video_api_key)}</>}>
            <Input.Password placeholder="留空则使用公共 API Key" />
          </Form.Item>
          <Form.Item name="volcano_video_endpoint" label="接入点 (Endpoint)">
            <Input placeholder="例如：ep-..." />
          </Form.Item>
        </>
      ),
    },
    {
      key: '5',
      label: '向量化模型 (Embedding)',
      children: (
        <>
          <Form.Item name="volcano_embedding_api_key" label={<>API Key {renderStatus(status.settings?.volcano_embedding_api_key)}</>}>
            <Input.Password placeholder="留空则使用公共 API Key" />
          </Form.Item>
          <Form.Item name="volcano_embedding_endpoint" label="接入点 (Endpoint)">
            <Input placeholder="例如：ep-..." />
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <Modal
      title="高级配置 - 临时 API 覆盖"
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      width={600}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          当前状态：
          {status.has_temp_settings ? (
            <Text type="success">存在有效的临时配置拦截</Text>
          ) : (
            <Text type="warning">未设置（当前完全依赖系统环境变量配置）</Text>
          )}
        </Text>
        <div style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
          注意：临时替换的配置会应用到当前服务器的所有 AI 请求中（包含后台队列）。系统重启后将会失效。此操作不会修改底层 .env 配置文件。
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Collapse items={items} defaultActiveKey={['1']} style={{ marginBottom: 24 }} />

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          {status.has_temp_settings && (
            <Button 
              danger 
              onClick={handleClear} 
              loading={loading}
              style={{ marginRight: 8 }}
            >
              清除所有覆盖
            </Button>
          )}
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            应用设置
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};
