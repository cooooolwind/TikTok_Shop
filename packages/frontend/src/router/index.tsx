import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '../layouts/MainLayout';
import { Spin } from 'antd';

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);

const HomePage = lazy(() => import('../pages/Home/HomePage'));
const MaterialManagementPage = lazy(() => import('../pages/MaterialManagement/MaterialManagementPage'));
const ScriptWorkbenchPage = lazy(() => import('../pages/ScriptWorkbench/ScriptWorkbenchPage'));
const CreationStudioPage = lazy(() => import('../pages/CreationStudio/CreationStudioPage'));
const AnalyticsDashboardPage = lazy(() => import('../pages/AnalyticsDashboard/AnalyticsDashboardPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Suspense fallback={<Loading />}><HomePage /></Suspense>,
      },
      {
        path: 'materials',
        element: <Suspense fallback={<Loading />}><MaterialManagementPage /></Suspense>,
      },
      {
        path: 'scripts',
        element: <Suspense fallback={<Loading />}><ScriptWorkbenchPage /></Suspense>,
      },
      {
        path: 'scripts/:id',
        element: <Suspense fallback={<Loading />}><ScriptWorkbenchPage /></Suspense>,
      },
      {
        path: 'creation',
        element: <Suspense fallback={<Loading />}><CreationStudioPage /></Suspense>,
      },
      {
        path: 'creation/tasks/:taskId',
        element: <Suspense fallback={<Loading />}><CreationStudioPage /></Suspense>,
      },
      {
        path: 'analytics',
        element: <Suspense fallback={<Loading />}><AnalyticsDashboardPage /></Suspense>,
      },
    ],
  },
]);
