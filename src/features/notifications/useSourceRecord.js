import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
// A source URL selects a record; the existing service/detail authorization still applies.
export function useSourceRecord(open) {
  const [params] = useSearchParams(); const id = params.get('sourceId'); const callback = useRef(open); callback.current = open;
  useEffect(() => { if (/^[a-f\d]{24}$/i.test(id || '')) void callback.current(id); }, [id]);
}
