import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, csvCell } from '../src/modules/insights/csv.js';

test('CSV preserves quotes, delimiters, newlines and numeric deficits while neutralizing formula text', () => {
  assert.equal(csvCell('quoted "name", next\nline'), '"quoted ""name"", next\nline"');
  for (const text of ['=SUM(1,2)', '+CMD', '-HYPERLINK("x")', '@SUM(1)', ' \t\r=1+1', '\u0000=1']) assert.equal(csvCell(text).startsWith('"\''), true);
  assert.equal(csvCell('-7000.00'), '"-7000.00"'); assert.equal(csvCell(-7000), '"-7000"'); assert.equal(csvCell(null), '""');
  assert.equal(csv([{ key: 'amount', label: 'Surplus', unit: 'PKR' }], [{ amount: '-7000.00' }]), '\uFEFF"Surplus (PKR)"\r\n"-7000.00"\r\n');
});
