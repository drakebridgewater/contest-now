import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate } from 'react-router';
// In react-router v8 the DOM RouterProvider lives in the /dom entry point.
import { RouterProvider } from 'react-router/dom';
import { AppLayout } from './components/AppLayout.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { AdminPage } from './routes/AdminPage.tsx';
import { SubmitPage } from './routes/SubmitPage.tsx';
import { VotePage } from './routes/VotePage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

const router = createBrowserRouter([
  {
    path: '/',
    Component: AppLayout,
    children: [
      { index: true, element: <Navigate to="/submit" replace /> },
      { path: 'submit', Component: SubmitPage },
      { path: 'vote', Component: VotePage },
      { path: 'admin', Component: AdminPage },
      { path: 'results', element: <Navigate to="/admin" replace /> },
      { path: '*', element: <Navigate to="/submit" replace /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
