import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './pages/HomePage';
import RequirementsPage from './pages/RequirementsPage';
import TasksPage from './pages/TasksPage';
import EstimatePage from './pages/EstimatePage';
import './styles/app.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'requirements', element: <RequirementsPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'estimate', element: <EstimatePage /> },
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
