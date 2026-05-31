import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Select, Slider, Button, Typography,
  Row, Col, Divider, Spin, Alert, Image, message,
} from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { useCreationStore } from '../../stores/useGenerationStore';
import { useScriptStore } from '../../stores/useScriptStore';
import { useTTSStore } from '../../stores/useTTSStore';
import { useBGMStore } from '../../stores/useBGMStore';
import { RESOLUTIONS } from '../../utils/constants';
import type { Script } from '@aigc/shared-types';
import { formatScriptDisplayId } from '../../utils/format';
import { hasScriptProductImageInput } from './createTask.helpers';

const { Text } = Typography;

export default function CreateTask() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { creating, createVideo } = useCreationStore();
  const { items: scripts, loading: scriptsLoading, fetchList: fetchScripts } = useScriptStore();
  const { voices, loading: ttsLoading, fetchVoices } = useTTSStore();
  const { items: bgms, loading: bgmLoading, fetchList: fetchBGM } = useBGMStore();

  const [selectedScript, setSelectedScript] = useState<Script | null>(null);

  useEffect(() => {
    fetchScripts({ status: 'confirmed', pageSize: 100 });
    fetchVoices();
    fetchBGM({ pageSize: 100 });
  }, []);

  const handleScriptSelect = (scriptId: string) => {
    const s = scripts.find((sc) => sc.id === scriptId);
    setSelectedScript(s || null);
  };

  const handleCreate = () => {
    form.validateFields().then((values) => {
      if (!hasScriptProductImageInput(selectedScript)) {
        message.error('请先为剧本补充商品图，再生成视频');
        return;
      }
      createVideo({
        script_id: values.script_id,
        options: {
          resolution: values.resolution,
          tts_voice: values.tts_voice,
          tts_speed: values.tts_speed,
          bgm_id: values.bgm_id,
          bgm_volume: values.bgm_volume,
        },
      }).then((task) => {
        navigate(`/creation/tasks/${task.id}`);
      });
    });
  };


  return (
    <div>
      <PageHeader
        title="新建创作任务"
        breadcrumbs={[
          { title: '创作工作室', path: '/creation' },
          { title: '新建任务' },
        ]}
      />

      <Row gutter={24}>
        <Col xs={24} md={16}>
          <Card>
            <Form form={form} layout="vertical" initialValues={{ resolution: '1080x1920', tts_speed: 1.0, bgm_volume: 0.3 }}>
              <Text strong style={{ fontSize: 16 }}>选择剧本</Text>
              <Divider />
              <Form.Item name="script_id" label="已确认的剧本" rules={[{ required: true, message: '请选择剧本' }]}>
                <Select
                  showSearch
                  placeholder="选择已确认的剧本..."
                  loading={scriptsLoading}
                  onChange={handleScriptSelect}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  options={scripts
                    .filter((s) => s.status === 'confirmed')
                    .map((s) => ({
                      label: `${formatScriptDisplayId(s.created_at)} ${s.product_info.name} (${s.scenes.length} 分镜)`,
                      value: s.id,
                    }))}
                  notFoundContent={scriptsLoading ? <Spin size="small" /> : '无已确认的剧本，请先在剧本工作台中确认剧本'}
                />
              </Form.Item>

              {selectedScript && (
                <Card size="small" style={{ background: '#f6f8fa', marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={8}><Text type="secondary">分镜数：</Text><Text strong>{selectedScript.scenes.length}</Text></Col>
                    <Col span={8}><Text type="secondary">总时长：</Text><Text strong>{selectedScript.total_duration}s</Text></Col>
                    <Col span={8}><Text type="secondary">视觉风格：</Text><Text strong>{selectedScript.visual_style}</Text></Col>
                  </Row>
                  <Divider style={{ margin: '12px 0' }} />
                  {selectedScript.product_info.images?.length ? (
                    <Image.PreviewGroup>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selectedScript.product_info.images.slice(0, 4).map((url) => (
                          <Image
                            key={url}
                            src={url}
                            width={56}
                            height={56}
                            style={{ objectFit: 'cover', borderRadius: 6 }}
                            alt="商品图"
                          />
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  ) : selectedScript.source_material_ids?.length ? (
                    <Alert
                      type="info"
                      showIcon
                      message="该剧本绑定了素材库图片，后台会在出片前校验商品图素材。"
                    />
                  ) : (
                    <Alert
                      type="warning"
                      showIcon
                      message="缺少商品图，无法生成 Seedream 分镜首帧。"
                      description="请回到剧本生成页选择图片素材，或补充商品图 URL。"
                    />
                  )}
                </Card>
              )}

              <Text strong style={{ fontSize: 16 }}>输出配置</Text>
              <Divider />
              <Form.Item name="resolution" label="分辨率">
                <Select options={RESOLUTIONS} />
              </Form.Item>

              <Text strong style={{ fontSize: 16 }}>配音设置</Text>
              <Divider />
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="tts_voice" label="TTS 音色">
                    <Select
                      showSearch
                      placeholder="选择音色..."
                      loading={ttsLoading}
                      allowClear
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                      options={voices.map((v) => ({
                        label: `${v.name} (${v.gender === 'male' ? '男' : '女'} - ${v.language})`,
                        value: v.id,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tts_speed" label={`语速: ${form.getFieldValue('tts_speed') || 1.0}x`}>
                    <Slider min={0.5} max={2.0} step={0.1} marks={{ 0.5: '0.5x', 1: '1x', 1.5: '1.5x', 2: '2x' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Text strong style={{ fontSize: 16 }}>背景音乐</Text>
              <Divider />
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="bgm_id" label="BGM">
                    <Select
                      placeholder="选择背景音乐..."
                      loading={bgmLoading}
                      allowClear
                      options={bgms.map((b) => ({
                        label: `${b.name} (${b.style} - ${b.bpm}BPM)`,
                        value: b.id,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="bgm_volume" label={`BGM 音量: ${Math.round((form.getFieldValue('bgm_volume') || 0.3) * 100)}%`}>
                    <Slider min={0} max={1} step={0.1} marks={{ 0: '0%', 0.3: '30%', 0.5: '50%', 1: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Button
                type="primary"
                onClick={handleCreate}
                loading={creating}
                icon={<ThunderboltOutlined />}
                size="large"
                block
                style={{ marginTop: 16 }}
              >
                {creating ? '提交中...' : '一键成片'}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="生成步骤" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { step: '1', title: '剧本解析', desc: '解析分镜脚本，提取场景片段' },
                { step: '2', title: '素材匹配', desc: '基于向量检索匹配最佳素材' },
                { step: '3', title: '视频生成', desc: '逐分镜调用火山引擎生成视频' },
                { step: '4', title: 'TTS 配音', desc: '合成语音旁白，对齐时间轴' },
                { step: '5', title: '合成导出', desc: '拼接分镜 + 叠加字幕 + 混入 BGM' },
              ].map((item) => (
                <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#1677ff', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600, flexShrink: 0,
                  }}>
                    {item.step}
                  </div>
                  <div>
                    <Text strong>{item.title}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
