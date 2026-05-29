import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Dropdown, Button, Drawer } from 'antd';
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
} from '@ant-design/icons';
import { useUIStore } from '../stores/useAppStore';
import { ROUTES } from '../constants';
import { useTheme } from '../hooks/useTheme';
import { useMediaQuery } from '../hooks/useMediaQuery';

const { Sider, Content, Header } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

/**
 * 菜单结构：
 * - 首页
 * - 素材管理
 * - 剧本工作台（子菜单：剧本列表、参考视频库、灵感模板）
 * - 创作工作室
 * - 数据看板
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
        key: ROUTES.REFERENCES,
        icon: <BookOutlined />,
        label: '参考视频库',
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
    key: ROUTES.ANALYTICS,
    icon: <BarChartOutlined />,
    label: '数据看板',
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
  };

  // 对于匹配 /references/:id 这样的路径，也需要展开父菜单
  if (pathname.startsWith('/references')) {
    return { selectedKey: ROUTES.REFERENCES, openKeys: ['scripts-group'] };
  }
  if (pathname.startsWith('/templates')) {
    return { selectedKey: ROUTES.TEMPLATES, openKeys: ['scripts-group'] };
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

  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const mobileDrawerOpen = useUIStore((s) => s.mobileDrawerOpen);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isDark, themeMode } = useTheme();

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
                  if (key === 'scripts-group') return;
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
            </div>
          </div>
        </Sider>
      )}

      <Drawer
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        styles={{ body: { padding: 0 } }}
        width={250}
        closable={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: isDark ? '#161823' : '#ffffff' }}>
          <div
            style={{
              height: 48,
              margin: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              color: token.colorPrimary,
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            AIGC 视频生成
          </div>
          <Menu
            theme={isDark ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={openKeys}
            items={menuItems}
            style={{ borderRight: 'none' }}
            onClick={({ key }) => {
              if (key === 'scripts-group') return;
              navigate(key);
              setMobileDrawerOpen(false);
            }}
          />
        </div>
      </Drawer>

      <Layout style={{ background: 'transparent' }}>
        <Header
          style={{
            padding: '0 24px',
            background: isDark ? 'rgba(22, 24, 35, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'flex-end',
            position: 'sticky',
            top: 0,
            zIndex: 9,
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileDrawerOpen(true)}
              style={{ fontSize: 18 }}
            />
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
    </Layout>
  );
}
