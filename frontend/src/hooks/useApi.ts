import { useCallback, useEffect, useRef, useState } from "react";

interface UseApiState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<UseApiState<T>>({ data: undefined, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, error: null, loading: false });
    } catch (err) {
      setState({
        data: undefined,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, refetch: run };
}
