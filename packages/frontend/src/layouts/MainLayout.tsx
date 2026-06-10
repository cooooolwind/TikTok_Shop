import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Dropdown, Button, Row, Col } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  PictureOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
  MenuOutlined,
  CloseOutlined,
  ScissorOutlined,
  DashboardOutlined,
  DollarOutlined,
  RiseOutlined,
  ExperimentOutlined,
  ShopOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useUIStore } from '../stores/useAppStore';
import { ROUTES } from '../constants';
import { useTheme } from '../hooks/useTheme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useMaterialSubscription } from '../hooks/useMaterialSubscription';
import { useEffect, useState } from 'react';
import { TempApiKeyModal } from '../components/TempApiKeyModal';

const { Sider, Content, Header } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

/**
 * 菜单结构：
 * - 首页
 * - 素材管理
 * - 剧本工作台（子菜单：剧本列表、参考视频库、灵感模板）
 * - 创作工作室
 * - 视频剪辑
 * - 数据看板（子菜单：产出总览、成本分析、转化分析、策略洞察）
 */
const menuItems: MenuItem[] = [
  {
    key: ROUTES.HOME,
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: ROUTES.MATERIALS,
    icon: <PictureOutlined />,
    label: '素材管理',
  },
  {
    key: 'scripts-group',
    icon: <FileTextOutlined />,
    label: '剧本工作台',
    children: [
      {
        key: ROUTES.SCRIPTS,
        icon: <FileTextOutlined />,
        label: '剧本列表',
      },

      {
        key: ROUTES.TEMPLATES,
        icon: <BulbOutlined />,
        label: '灵感模板',
      },
    ],
  },
  {
    key: ROUTES.CREATION,
    icon: <VideoCameraOutlined />,
    label: '创作工作室',
  },
  {
    key: ROUTES.TEMPLATE_MARKET,
    icon: <ShopOutlined />,
    label: '模板广场',
  },
  {
    key: ROUTES.EDITOR,
    icon: <ScissorOutlined />,
    label: '视频剪辑',
  },
  {
    key: 'analytics-group',
    icon: <BarChartOutlined />,
    label: '数据看板',
    children: [
      {
        key: ROUTES.ANALYTICS_OVERVIEW,
        icon: <DashboardOutlined />,
        label: '产出总览',
      },
      {
        key: ROUTES.ANALYTICS_COST,
        icon: <DollarOutlined />,
        label: '成本分析',
      },
      {
        key: ROUTES.ANALYTICS_CONVERSION,
        icon: <RiseOutlined />,
        label: '转化分析',
      },
      {
        key: ROUTES.ANALYTICS_STRATEGY,
        icon: <ExperimentOutlined />,
        label: '策略洞察',
      },
    ],
  },
];

/**
 * 根据当前路径推导选中的菜单项 key 和展开的父级 key。
 * 路径结构：references 和 templates 映射到 scripts-group 父菜单下。
 */
function deriveMenuState(pathname: string): { selectedKey: string; openKeys: string[] } {
  // 精确匹配不做额外处理
  const pathToParent: Record<string, string> = {
    [ROUTES.REFERENCES]: 'scripts-group',
    [ROUTES.TEMPLATES]: 'scripts-group',
    [ROUTES.ANALYTICS_OVERVIEW]: 'analytics-group',
    [ROUTES.ANALYTICS_COST]: 'analytics-group',
    [ROUTES.ANALYTICS_CONVERSION]: 'analytics-group',
    [ROUTES.ANALYTICS_STRATEGY]: 'analytics-group',
  };

  // 对于匹配 /references/:id 这样的路径，也需要展开父菜单
  if (pathname.startsWith('/references')) {
    return { selectedKey: ROUTES.REFERENCES, openKeys: ['scripts-group'] };
  }
  if (pathname.startsWith('/templates')) {
    return { selectedKey: ROUTES.TEMPLATES, openKeys: ['scripts-group'] };
  }
  if (pathname.startsWith('/template-market')) {
    return { selectedKey: ROUTES.TEMPLATE_MARKET, openKeys: [] };
  }
  if (pathname.startsWith('/editor')) {
    return { selectedKey: ROUTES.EDITOR, openKeys: [] };
  }
  if (pathname.startsWith('/analytics')) {
    // 对于 /analytics/* 映射到对应的子菜单项
    const key = pathToParent[pathname] ? pathname : ROUTES.ANALYTICS_OVERVIEW;
    return { selectedKey: key, openKeys: ['analytics-group'] };
  }

  const parentKey = pathToParent[pathname];
  return {
    selectedKey: pathname.split('/').slice(0, 2).join('/') || '/', // /scripts/generate → /scripts
    openKeys: parentKey ? [parentKey] : [],
  };
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const [tempApiKeyOpen, setTempApiKeyOpen] = useState(false);

  useMaterialSubscription();

  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const mobileDrawerOpen = useUIStore((s) => s.mobileDrawerOpen);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isDark, themeMode } = useTheme();

  useEffect(() => {
    if (isMobile && mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, mobileDrawerOpen]);

  const { selectedKey, openKeys } = deriveMenuState(location.pathname);

  const themeMenuItems: MenuProps['items'] = [
    { key: 'system', label: collapsed ? <DesktopOutlined /> : '跟随系统' },
    { key: 'light', label: collapsed ? <SunOutlined /> : '浅色模式' },
    { key: 'dark', label: collapsed ? <MoonOutlined /> : '深色模式' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={toggleSidebar}
          theme={isDark ? 'dark' : 'light'}
          style={{
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            background: isDark ? '#161823' : '#ffffff',
            position: 'sticky',
            top: 0,
            height: '100vh',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* Logo 区：折叠时显示简短图标文字 */}
              <div
                style={{
                  height: 48,
                  margin: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorPrimary,
                  fontWeight: 700,
                  fontSize: collapsed ? 16 : 18,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  letterSpacing: 1,
                }}
              >
                {collapsed ? 'AIGC' : 'AIGC 视频生成'}
              </div>

              <Menu
                theme={isDark ? 'dark' : 'light'}
                mode="inline"
                selectedKeys={[selectedKey]}
                defaultOpenKeys={openKeys}
                items={menuItems}
                style={{
                  background: 'transparent',
                  borderRight: 'none',
                }}
                onClick={({ key }) => {
                  // 跳过父菜单组
                  if (key === 'scripts-group' || key === 'analytics-group') return;
                  navigate(key);
                }}
              />
            </div>

            <div style={{ padding: collapsed ? '0 0 16px' : '0 16px 16px', marginTop: 'auto' }}>
              <Dropdown
                menu={{
                  items: themeMenuItems,
                  selectedKeys: [themeMode],
                  onClick: ({ key }) => setThemeMode(key as 'system' | 'light' | 'dark'),
                }}
                placement="topRight"
              >
                <Button
                  type="text"
                  icon={
                    themeMode === 'dark' ? (
                      <MoonOutlined />
                    ) : themeMode === 'light' ? (
                      <SunOutlined />
                    ) : (
                      <DesktopOutlined />
                    )
                  }
                  block
                  style={{
                    color: token.colorText,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? 0 : '4px 15px',
                    height: 32,
                    borderRadius: collapsed ? 0 : token.borderRadius,
                  }}
                >
                  {!collapsed && '主题切换'}
                </Button>
              </Dropdown>
              <Button
                type="text"
                icon={<KeyOutlined />}
                block
                onClick={() => setTempApiKeyOpen(true)}
                style={{
                  color: token.colorText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? 0 : '4px 15px',
                  height: 32,
                  marginTop: 8,
                  borderRadius: collapsed ? 0 : token.borderRadius,
                }}
              >
                {!collapsed && '临时 API Key'}
              </Button>
            </div>
          </div>
        </Sider>
      )}

      {/* Mobile Grid Menu Overlay */}
      <div id="mobile-grid-menu" className={mobileDrawerOpen ? 'show' : ''}>
        <div className="mobile-grid-menu-inner">
          <Row justify="center" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', padding: '0 16px' }}>
            {/* 提取有效导航项并分组显示 */}
            {[
              {
                title: '',
                items: [
                  { key: ROUTES.HOME, icon: <HomeOutlined />, label: '首页' },
                  { key: ROUTES.CREATION, icon: <VideoCameraOutlined />, label: '创作工作室' },
                  { key: ROUTES.SCRIPTS, icon: <FileTextOutlined />, label: '剧本列表' },
                ]
              },
              {
                title: '资源与工具',
                items: [
                  { key: ROUTES.MATERIALS, icon: <PictureOutlined />, label: '素材管理' },
                  { key: ROUTES.TEMPLATE_MARKET, icon: <ShopOutlined />, label: '模板广场' },
                  { key: ROUTES.TEMPLATES, icon: <BulbOutlined />, label: '灵感模板' },
                ]
              },
              {
                title: '数据看板',
                items: [
                  { key: ROUTES.ANALYTICS_OVERVIEW, icon: <DashboardOutlined />, label: '产出总览' },
                  { key: ROUTES.ANALYTICS_COST, icon: <DollarOutlined />, label: '成本分析' },
                  { key: ROUTES.ANALYTICS_CONVERSION, icon: <RiseOutlined />, label: '转化分析' },
                  { key: ROUTES.ANALYTICS_STRATEGY, icon: <ExperimentOutlined />, label: '策略洞察' },
                ]
              },
              {
                title: '系统设置',
                items: [
                  { key: 'THEME_TOGGLE', icon: themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />, label: themeMode === 'dark' ? '开灯' : '关灯' },
                  { key: 'TEMP_API_KEY', icon: <KeyOutlined />, label: '临时 API Key' },
                ]
              }
            ].flatMap((group, groupIndex) => {
              const colSpan = group.items.length === 4 ? 12 : 8;
              return [
                group.title ? (
                  <Col span={24} key={group.title}>
                    <div className="mobile-grid-group-header" style={{ 
                      marginTop: groupIndex === 0 ? '0.5rem' : '1.5rem', 
                      paddingTop: groupIndex === 0 ? 0 : '1rem', 
                      borderTop: groupIndex === 0 ? 'none' : '1px solid rgba(128,128,128,0.2)', 
                      paddingBottom: '0.5rem', 
                      opacity: 0.6, 
                      fontSize: '0.8rem', 
                      textAlign: 'center' 
                    }}>
                      {group.title}
                    </div>
                  </Col>
                ) : null,
                ...group.items.map((item, itemIndex) => (
                  <Col span={colSpan} className="mobile-grid-cell" key={item.key} style={{ animationDelay: `${(groupIndex * 5 + itemIndex) * 20}ms` }}>
                    <div
                      className="mobile-grid-item"
                      onClick={() => {
                        if (item.key === 'THEME_TOGGLE') {
                          setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
                        } else if (item.key === 'TEMP_API_KEY') {
                          setTempApiKeyOpen(true);
                        } else if (item.key) {
                          navigate(item.key);
                        }
                        setMobileDrawerOpen(false);
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  </Col>
                ))
              ];
            })}
          </Row>
        </div>
      </div>

      <Layout style={{ background: 'transparent' }}>
        <Header
          style={{
            padding: '0 24px',
            background: (isMobile && mobileDrawerOpen) 
              ? 'transparent' 
              : (isDark ? 'rgba(22, 24, 35, 0.8)' : 'rgba(255, 255, 255, 0.8)'),
            backdropFilter: (isMobile && mobileDrawerOpen) ? 'none' : 'blur(10px)',
            borderBottom: (isMobile && mobileDrawerOpen) 
              ? 'none' 
              : `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'flex-end',
            position: 'sticky',
            top: 0,
            zIndex: (isMobile && mobileDrawerOpen) ? 1030 : 9,
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={mobileDrawerOpen ? <CloseOutlined /> : <MenuOutlined />}
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              style={{ fontSize: 18, zIndex: 1030 }} // Ensure it stays on top of the overlay
            />
          )}
          {isMobile && (
            <div style={{ 
              fontWeight: 700, 
              color: token.colorPrimary, 
              marginLeft: 12, 
              fontSize: 16,
              opacity: mobileDrawerOpen ? 0 : 1, // Hide when menu is open for cleaner look
              transition: 'opacity 0.2s ease'
            }}>
              AIGC 视频生成
            </div>
          )}
        </Header>
        <Content
          style={{
            margin: isMobile ? '12px 12px' : '24px 24px',
            padding: isMobile ? 16 : 24,
            background: isDark ? 'transparent' : token.colorBgContainer,
            borderRadius: token.borderRadius,
            minHeight: 280,
          }}
          className="hover-scale"
        >
          <Outlet />
        </Content>
      </Layout>
      <TempApiKeyModal open={tempApiKeyOpen} onCancel={() => setTempApiKeyOpen(false)} />
    </Layout>
  );
}
