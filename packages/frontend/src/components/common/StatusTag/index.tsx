import { Tag } from 'antd';
import { STATUS_COLOR_MAP } from '../../../constants';

interface StatusTagProps {
  status: string;
  labels?: Record<string, string>;
}

export default function StatusTag({ status, labels = {} }: StatusTagProps) {
  const color = STATUS_COLOR_MAP[status] ?? 'default';
  const label = labels[status] ?? status;
  return <Tag color={color}>{label}</Tag>;
}
