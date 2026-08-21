import { useEffect, useRef, useState } from "react";
import type { StreamEvent } from "../api/types";

export function useLiveStream(onEvent?: (event: StreamEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource("/api/v1/stream/live", { withCredentials: true });

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.addEventListener("risk", (msg) => {
      const event = JSON.parse((msg as MessageEvent).data) as StreamEvent;
      setEvents((prev) => [event, ...prev].slice(0, 120));
      onEventRef.current?.(event);
    });

    return () => source.close();
  }, []);

  return { connected, events };
}
