import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate } from 'react-router';
// In react-router v8 the DOM RouterProvider lives in the /dom entry point.
import { RouterProvider } from 'react-router/dom';
import { AppLayout } from './components/AppLayout.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { useMe } from './lib/queries.ts';
import { AdminPage } from './routes/AdminPage.tsx';
import { EventPage, ToEvent } from './routes/EventPage.tsx';
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
      { index: true, Component: Home },
      { path: 'event', Component: EventPage },
      // Old pages, and links in emails already sent, all open the Event page.
      { path: 'details', element: <ToEvent /> },
      { path: 'faq', element: <ToEvent hash="#faq" /> },
      { path: 'register', element: <ToEvent /> },
      { path: 'rsvp', element: <ToEvent /> },
      { path: 'submit', Component: SubmitPage },
      { path: 'vote', Component: VotePage },
      { path: 'admin', Component: AdminPage },
      { path: 'results', element: <Navigate to="/admin" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

/** Guests who are signed in land on voting; everyone else on the event and its RSVP. */
function Home() {
  const me = useMe();
  if (me.isLoading) return null;
  return <Navigate to={me.data ? '/vote' : '/event'} replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
