import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../../services/apiError.js';
import { userService } from '../../services/userService.js';

export default function useUsers(query = {}) {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const sequence = useRef(0);
  const key = JSON.stringify(query);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setError(null);
    try {
      const result = await userService.listUsers(JSON.parse(key));
      if (request === sequence.current) { setUsers(result.data); setMeta(result.meta); }
    } catch (failure) {
      if (request === sequence.current) { setUsers([]); setMeta(null); setError(getErrorMessage(failure, 'Could not load users.')); }
    } finally { if (request === sequence.current) setLoading(false); }
  }, [key]);
  useEffect(() => { load(); return () => { sequence.current += 1; }; }, [load]);
  return { users, meta, loading, error, reload: load };
}
