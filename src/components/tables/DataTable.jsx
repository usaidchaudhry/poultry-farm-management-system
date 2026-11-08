import { cn } from '../../utils/classNames.js';
import EmptyState from '../common/EmptyState.jsx';
import ErrorState from '../common/ErrorState.jsx';
import Icon from '../common/Icon.jsx';
import LoadingState from '../common/LoadingState.jsx';
import Pagination from './Pagination.jsx';
import './Table.css';

/*
  columns: [{ key, header, render?(row), sortable?, align?, width? }]
  sort: { key, direction: 'asc' | 'desc' }  -> controlled by the parent (see hooks/useClientTable.js)
  pagination: { page, pageSize, total, onPageChange, onPageSizeChange }
*/
export default function DataTable({
  columns,
  rows,
  rowKey = 'id',
  caption,
  loading = false,
  error = null,
  onRetry,
  sort,
  onSortChange,
  pagination,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription = 'Try changing your filters, or add a new record.',
  emptyAction,
}) {
  if (error) return <ErrorState message={typeof error === 'string' ? error : undefined} onRetry={onRetry} />;
  if (loading) return <LoadingState message="Loading records..." />;
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const handleSort = (key) => {
    const direction = sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange?.({ key, direction });
  };

  const getKey = (row) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey]);

  return (
    <div>
      <div className="table-scroll">
        <table className="table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width, textAlign: col.align }}
                    aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {col.sortable && onSortChange ? (
                      <button type="button" className="table__sort" onClick={() => handleSort(col.key)}>
                        {col.header}
                        <Icon
                          name={isSorted && sort.direction === 'desc' ? 'chevronDown' : 'chevronUp'}
                          size={14}
                          className={cn('table__sort-icon', isSorted && 'table__sort-icon--active')}
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getKey(row)}
                className={cn(onRowClick && 'table__row--clickable')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => event.key === 'Enter' && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
