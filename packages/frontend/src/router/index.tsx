import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '../layouts/MainLayout';
import Loading from '../components/common/Loading';

/**
 * 包装 lazy 加载的页面组件，统一挂载 Suspense
 * 每个页面一个 chunk，按路由按需加载
 */
function LazyPage({ Component }: { Component: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  );
}

// ===== 首页 =====
const HomePage = lazy(() => import('../pages/Home/HomePage'));

// ===== 素材管理 =====
const MaterialManagementPage = lazy(() => import('../pages/MaterialManagement/MaterialManagementPage'));
const MaterialDetail = lazy(() => import('../pages/MaterialManagement/MaterialDetail'));

// ===== 剧本工作台 =====
const ScriptWorkbenchPage = lazy(() => import('../pages/ScriptWorkbench/ScriptWorkbenchPage'));
const ScriptGenerate = lazy(() => import('../pages/ScriptWorkbench/ScriptGenerate'));
const ScriptEditor = lazy(() => import('../pages/ScriptWorkbench/ScriptEditor'));
const ReferenceList = lazy(() => import('../pages/ScriptWorkbench/ReferenceList'));
const ReferenceDetail = lazy(() => import('../pages/ScriptWorkbench/ReferenceDetail'));
const TemplateManager = lazy(() => import('../pages/ScriptWorkbench/TemplateManager'));

// ===== 创作工作室 =====
const CreationStudioPage = lazy(() => import('../pages/CreationStudio/CreationStudioPage'));
const CreateTask = lazy(() => import('../pages/CreationStudio/CreateTask'));
const TaskDetail = lazy(() => import('../pages/CreationStudio/TaskDetail'));
const VideoPreview = lazy(() => import('../pages/CreationStudio/VideoPreview'));

// ===== 数据看板 =====
const AnalyticsDashboardPage = lazy(() => import('../pages/AnalyticsDashboard/AnalyticsDashboardPage'));

// ===== 404 =====
const NotFoundPage = lazy(() => import('../pages/NotFound'));

import type { Router } from '@remix-run/router';

export const router: Router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // 首页
      { index: true, element: <LazyPage Component={HomePage} /> },

      // 素材管理
      { path: 'materials', element: <LazyPage Component={MaterialManagementPage} /> },
      { path: 'materials/:id', element: <LazyPage Component={MaterialDetail} /> },

      // 剧本工作台
      { path: 'scripts', element: <LazyPage Component={ScriptWorkbenchPage} /> },
      { path: 'scripts/generate', element: <LazyPage Component={ScriptGenerate} /> },
      { path: 'scripts/:id', element: <LazyPage Component={ScriptEditor} /> },
      { path: 'references', element: <LazyPage Component={ReferenceList} /> },
      { path: 'references/:id', element: <LazyPage Component={ReferenceDetail} /> },
      { path: 'templates', element: <LazyPage Component={TemplateManager} /> },

      // 创作工作室
      { path: 'creation', element: <LazyPage Component={CreationStudioPage} /> },
      { path: 'creation/new', element: <LazyPage Component={CreateTask} /> },
      { path: 'creation/tasks/:taskId', element: <LazyPage Component={TaskDetail} /> },
      { path: 'creation/tasks/:taskId/preview', element: <LazyPage Component={VideoPreview} /> },

      // 数据看板
      { path: 'analytics', element: <LazyPage Component={AnalyticsDashboardPage} /> },

      // 404
      { path: '*', element: <LazyPage Component={NotFoundPage} /> },
    ],
  },
]);
