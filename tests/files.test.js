import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readFile, exportProjection } from '../src/files.js';

test('CSV and XLSX import preserve values', async () => {
  const csv = new File(['Product Id,Item Id,Case Pack\nP1,I1,12'], 'master.csv');
  assert.deepEqual(await readFile(csv), [['Product Id', 'Item Id', 'Case Pack'], ['P1', 'I1', '12']]);

  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Master').addRows([['Product Id', 'Item Id', 'Case Pack'], ['P1', 'I1', 12]]);
  const file = new File([await wb.xlsx.writeBuffer()], 'master.xlsx');
  const rows = await readFile(file);
  assert.deepEqual(rows[0].slice(0, 3), ['Product Id', 'Item Id', 'Case Pack']);
  assert.deepEqual(rows[1].slice(0, 3), ['P1', 'I1', '12']);
});

test('Excel export contains final item-wise columns', async () => {
  let output;
  const original = URL.createObjectURL;
  URL.createObjectURL = blob => { output = blob; return 'blob:test'; };
  global.document = { createElement: () => ({ click() {} }) };
  try {
    await exportProjection([
      {
        'Item Id': 'I1',
        'Gross Units(total)': 100,
        'Projection Percentage': 25,
        'Case Pack': 12,
        'Projected Unit': 132
      }
    ], 'website', 25);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await output.arrayBuffer());
    assert.equal(wb.worksheets[0].name, 'Final Projection');
    assert.equal(wb.worksheets[0].getCell('A2').value, 'I1');
    assert.equal(wb.worksheets[0].getCell('D2').value, 132);
  } finally {
    URL.createObjectURL = original;
    delete global.document;
  }
});
