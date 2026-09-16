import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRows,
  buildProjection,
  MASTER_HEADERS,
  FLIPKART_HEADERS,
  WEBSITE_HEADERS
} from '../src/core.js';

const master = validateRows([
  MASTER_HEADERS,
  ['P1', 'I1', 12],
  ['P2', 'I1', 12],
  ['P3', 'I2', 18]
], 'master');

test('master validates product, item and case pack', () => {
  assert.equal(master.length, 3);
  assert.equal(master[0]['Case Pack'], 12);
  assert.throws(() => validateRows([MASTER_HEADERS, ['P1', 'I1', 0]], 'master'), /positive/);
  assert.throws(() => validateRows([MASTER_HEADERS, ['P1', 'I1', 12], ['P1', 'I2', 12]], 'master'), /more than one Item Id/);
  assert.throws(() => validateRows([MASTER_HEADERS, ['P1', 'I1', 12], ['P2', 'I1', 24]], 'master'), /more than one Case Pack/);
});

test('flipkart aggregates by item and rounds to case pack after uplift', () => {
  const sales = validateRows([
    FLIPKART_HEADERS,
    ['P1', 'I1', 100],
    ['P2', 'I1', 35]
  ], 'flipkart');
  const { rows, errors } = buildProjection(sales, master, 'flipkart', 25);
  assert.equal(errors.length, 0);
  assert.equal(rows[0]['Gross Units(total)'], 135);
  assert.equal(rows[0]['Projected Unit'], 180); // 135 * 1.25 = 168.75 -> next multiple of 12 = 180
});

test('website uses item id and custom percentage', () => {
  const sales = validateRows([
    WEBSITE_HEADERS,
    ['I2', 100]
  ], 'website');
  const { rows, errors } = buildProjection(sales, master, 'website', 10);
  assert.equal(errors.length, 0);
  assert.equal(rows[0]['Projected Unit'], 126); // 110 -> next multiple of 18
  assert.equal(rows[0]['Projection Percentage'], 10);
});

test('flipkart detects product and item mismatch', () => {
  const sales = validateRows([FLIPKART_HEADERS, ['P1', 'I2', 10]], 'flipkart');
  const { rows, errors } = buildProjection(sales, master, 'flipkart', 25);
  assert.equal(rows.length, 0);
  assert.match(errors[0], /mapped to I1/);
});

test('website detects unknown item', () => {
  const sales = validateRows([WEBSITE_HEADERS, ['UNKNOWN', 10]], 'website');
  const { errors } = buildProjection(sales, master, 'website', 25);
  assert.match(errors[0], /not in the master/);
});

test('zero gross remains zero', () => {
  const sales = validateRows([WEBSITE_HEADERS, ['I1', 0]], 'website');
  const { rows } = buildProjection(sales, master, 'website', 25);
  assert.equal(rows[0]['Projected Unit'], 0);
});
