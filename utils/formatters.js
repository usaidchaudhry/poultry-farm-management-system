export const formatNumber = (value) =>
  value === null || value === undefined ? '-' : new Intl.NumberFormat('en-US').format(value);

export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
