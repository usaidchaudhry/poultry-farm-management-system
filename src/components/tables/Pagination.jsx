import { cn } from '../../utils/classNames.js';
import { getPageItems } from '../../utils/pagination.js';
import Icon from '../common/Icon.jsx';
import './Table.css';

// page is 1-based. Works with client-side data now and server-side data later.
export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <p className="pagination__summary">
        Showing {start}-{end} of {total}
      </p>

      <div className="pagination__controls">
        {onPageSizeChange && (
          <label className="pagination__size">
            <span>Rows</span>
            <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        )}

        <nav className="pagination__pages" aria-label="Pagination">
          <button
            type="button"
            className="pagination__btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <Icon name="chevronLeft" size={16} />
          </button>

          {getPageItems(page, totalPages).map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                className={cn('pagination__btn', item === page && 'pagination__btn--active')}
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="pagination__gap" aria-hidden="true">...</span>
            )
          )}

          <button
            type="button"
            className="pagination__btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      </div>
    </div>
  );
}
