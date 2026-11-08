// Joins class names and skips falsy values: cn('btn', isBig && 'btn--big')
export const cn = (...classes) => classes.filter(Boolean).join(' ');
