import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CreateLayout from './layouts/CreateLayout';
import ManageLayout from './layouts/ManageLayout';
import SettingsPage from './pages/SettingsPage';
import NewProjectPage from './pages/NewProjectPage';
import RequirementsPage from './pages/RequirementsPage';
import ImportPage from './pages/ImportPage';
import TasksPage from './pages/TasksPage';
import EstimatePage from './pages/EstimatePage';
import WbsEditPage from './pages/WbsEditPage';
import GanttPage from './pages/GanttPage';
import ReportsPage from './pages/ReportsPage';
import DailyReportsPage from './pages/DailyReportsPage';
import DelaysPage from './pages/DelaysPage';
import './styles/app.css';

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    path: '/create',
    element: <CreateLayout />,
    children: [
      { index: true, element: <NewProjectPage /> },
      { path: 'requirements', element: <RequirementsPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'estimate', element: <EstimatePage /> },
      { path: 'wbs', element: <WbsEditPage /> },
    ],
  },
  {
    path: '/manage',
    element: <ManageLayout />,
    children: [
      { index: true, element: <Navigate to="gantt" replace /> },
      { path: 'gantt', element: <GanttPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'daily', element: <DailyReportsPage /> },
      { path: 'delays', element: <DelaysPage /> },
    ],
  },
  { path: '/settings', element: <SettingsPage /> },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
