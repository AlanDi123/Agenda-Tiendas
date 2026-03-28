import { QueryClient } from '@tanstack/react-query';

export const agendaEventsQueryKey = ['agenda-events'] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});
