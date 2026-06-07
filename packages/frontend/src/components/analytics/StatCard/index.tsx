import { Card, Statistic, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { StatCardConfig } from '../../../types';

const { Text } = Typography;

interface StatCardProps extends StatCardConfig {
  onClick?: () => void;
}

export default function StatCard({
  title, value, suffix, change, changePositive = true, icon, loading, onClick,
}: StatCardProps) {
  const renderChange = () => {
    if (change === undefined) return null;
    const isUp = change >= 0;
    const isGood = changePositive ? isUp : !isUp;
    return (
      <Text
        type={isGood ? 'success' : 'danger'}
        style={{ fontSize: 14 }}
      >
        {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        {' '}{typeof change === 'number' ? Math.abs(change).toFixed(1) : Math.abs(Number(change) || 0).toFixed(1)}%
      </Text>
    );
  };

  return (
    <Card hoverable={!!onClick} onClick={onClick}>
      <Statistic
        title={title}
        value={value}
        suffix={suffix}
        prefix={icon}
        loading={loading}
      />
      {renderChange()}
    </Card>
  );
}
