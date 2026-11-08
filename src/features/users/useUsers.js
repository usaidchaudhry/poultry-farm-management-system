import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../services/apiError.js';
import { userService } from '../../services/userService.js';

// Loads the user list and exposes loading / error state plus helpers to update the list locally.
export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await userService.listUsers());
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Replace an existing user in the list, or add a new one
  const upsert = useCallback((user) => {
    setUsers((current) =>
      current.some((item) => item.id === user.id) ? current.map((item) => (item.id === user.id ? user : item)) : [...current, user]
    );
  }, []);

  return { users, loading, error, reload: load, upsert };
}
