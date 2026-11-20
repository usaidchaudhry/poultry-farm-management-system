import Decimal from 'decimal.js';
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export const money = (value) => new Decimal(value).toFixed(2);
export const quantity = (value) => new Decimal(value).toFixed(3);
export { Decimal };
