import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './pages/HomePage';
import RequirementsPage from './pages/RequirementsPage';
import TasksPage from './pages/TasksPage';
import EstimatePage from './pages/EstimatePage';
import GanttPage from './pages/GanttPage';
import MastersPage from './pages/MastersPage';
import ReportsPage from './pages/ReportsPage';
import DelaysPage from './pages/DelaysPage';
import DailyReportsPage from './pages/DailyReportsPage';
import WbsEditPage from './pages/WbsEditPage';
import './styles/app.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'requirements', element: <RequirementsPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'wbs', element: <WbsEditPage /> },
      { path: 'estimate', element: <EstimatePage /> },
      { path: 'gantt', element: <GanttPage /> },
      { path: 'masters', element: <MastersPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'delays', element: <DelaysPage /> },
      { path: 'daily', element: <DailyReportsPage /> },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
