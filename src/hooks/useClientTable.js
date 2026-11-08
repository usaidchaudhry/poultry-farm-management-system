import { useMemo, useState } from 'react';

function compare(a, b) {
  if (a === null || a === undefined) return 1; // empty values go last
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

// Client-side sorting and pagination for mock data.
// The returned shape matches what DataTable expects, so when the backend
// provides server-side paging later, only this hook needs to be replaced.
export default function useClientTable(rows, { initialPageSize = 10, initialSort = null } = {}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const direction = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => direction * compare(a[sort.key], b[sort.key]));
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages); // stays valid when filters shrink the list
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    rows: pageRows,
    sort,
    onSortChange: (next) => {
      setSort(next);
      setPage(1);
    },
    pagination: {
      page: safePage,
      pageSize,
      total: sorted.length,
      onPageChange: setPage,
      onPageSizeChange: (size) => {
        setPageSize(size);
        setPage(1);
      },
    },
  };
}
