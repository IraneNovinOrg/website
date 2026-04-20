import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useProject(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/projects/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000, // Reduced from 10s to 2s for faster updates
      keepPreviousData: true,
    }
  );

  // Revalidate without clearing the cache — otherwise `data` flips to undefined
  // mid-update, which unmounts any child holding local state (e.g. the task
  // detail view keeping track of the selected task).
  const refresh = () => mutate();

  return { data, error, isLoading, refresh };
}
