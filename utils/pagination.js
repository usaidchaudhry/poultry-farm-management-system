// Builds the list of page buttons, e.g. [1, 'start-ellipsis', 4, 5, 6, 'end-ellipsis', 12]
export function getPageItems(page, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push('start-ellipsis');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < totalPages - 1) items.push('end-ellipsis');
  items.push(totalPages);
  return items;
}
