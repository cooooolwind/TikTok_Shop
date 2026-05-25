import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { isDark } = useTheme();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#fe2c55', // Douyin Pink
          borderRadius: 8,
          // customize dark mode colors to match Douyin
          ...(isDark && {
            colorBgBase: '#161823',
            colorBgLayout: '#000000',
            colorBgContainer: '#161823',
            colorBgElevated: '#252632',
          }),
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
