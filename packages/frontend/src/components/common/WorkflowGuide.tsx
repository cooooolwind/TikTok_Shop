import { Button } from 'antd';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants';

type WorkflowStepKey = 'materials' | 'script' | 'creation' | 'editor';

interface WorkflowGuideProps {
  current: WorkflowStepKey;
  style?: CSSProperties;
  nextStep?: WorkflowStepKey;
}

const steps: { key: WorkflowStepKey; title: string; path: string }[] = [
  { key: 'materials', title: '上传素材', path: ROUTES.MATERIALS },
  { key: 'script', title: '生成剧本', path: ROUTES.SCRIPT_GENERATE },
  { key: 'creation', title: '新建创作', path: ROUTES.CREATION_NEW },
  { key: 'editor', title: '剪辑导出', path: ROUTES.CREATION },
];

export default function WorkflowGuide({ current, style, nextStep }: WorkflowGuideProps) {
  const navigate = useNavigate();
  const currentIndex = steps.findIndex((step) => step.key === current);
  const targetKey = nextStep ?? steps[Math.min(currentIndex + 1, steps.length - 1)].key;
  const target = steps.find((step) => step.key === targetKey) ?? steps[currentIndex];

  return (
    <Button type="primary" onClick={() => navigate(target.path)} style={style}>
      下一步：{target.title}
    </Button>
  );
}
