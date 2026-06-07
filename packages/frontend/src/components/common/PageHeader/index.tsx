import type { ReactNode } from 'react';
import { Typography, Breadcrumb } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

const { Title } = Typography;

interface BreadcrumbItem {
  title: ReactNode;
  path?: string; // 无 path 则为纯文本，不可点击
}

interface PageHeaderProps {
  title: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  extra?: ReactNode; // 右侧操作区插槽
}

export default function PageHeader({ title, breadcrumbs, extra }: PageHeaderProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={breadcrumbs.map((item) => ({
            title: item.path ? (
              <a onClick={() => navigate(item.path!)}>{item.title}</a>
            ) : (
              item.title
            ),
          }))}
        />
      )}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 0
        }}
      >
        <Title level={3} style={{ margin: 0 }}>{title}</Title>
        {extra && <div style={{ width: isMobile ? '100%' : 'auto' }}>{extra}</div>}
      </div>
    </div>
  );
}
