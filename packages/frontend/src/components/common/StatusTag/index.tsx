import { Tag } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { STATUS_COLOR_MAP } from '../../../constants';

interface StatusTagProps {
  status: string;
  labels?: Record<string, string>;
}

export default function StatusTag({ status, labels = {} }: StatusTagProps) {
  const color = STATUS_COLOR_MAP[status] ?? 'default';
  const label = labels[status] ?? status;
  
  const isProcessing = ['processing', 'generating', 'analyzing'].includes(status);

  return (
    <Tag color={color} icon={isProcessing ? <LoadingOutlined spin /> : null}>
      {label}
    </Tag>
  );
}
