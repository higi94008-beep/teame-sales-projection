import Papa from 'papaparse';

export async function readFile(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Maximum file size is 15 MB.');

  if (/\.csv$/i.test(file.name)) {
    const parsed = Papa.parse(await file.text(), { skipEmptyLines: 'greedy' });
    if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
    return parsed.data;
  }

  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error('Upload a .csv or .xlsx file. Save older .xls files as .xlsx first.');
  }

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('No worksheet found.');
  if (ws.rowCount > 50001) throw new Error('Use a maximum of 50,000 data rows.');

  const rows = [];
  ws.eachRow({ includeEmpty: true }, row => {
    const values = [];
    const width = Math.max(ws.columnCount, 3);
    for (let i = 1; i <= width; i++) {
      const cell = row.getCell(i);
      if (cell.type === ExcelJS.ValueType.Formula && cell.result === undefined) {
        throw new Error('Save formula results in Excel before uploading.');
      }
      values.push(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text);
    }
    rows.push(values);
  });
  return rows;
}

export async function exportProjection(rows, source, percentage) {
  if (!rows.length) throw new Error('There is no projection to download.');

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TEAME';
  wb.created = new Date();

  const ws = wb.addWorksheet('Final Projection');
  const headers = ['Item Id', 'Gross Units(total)', 'Projection Percentage', 'Projected Unit'];
  ws.columns = [
    { header: headers[0], key: headers[0], width: 22 },
    { header: headers[1], key: headers[1], width: 22 },
    { header: headers[2], key: headers[2], width: 24 },
    { header: headers[3], key: headers[3], width: 20 }
  ];

  rows.forEach(row => ws.addRow({
    'Item Id': row['Item Id'],
    'Gross Units(total)': row['Gross Units(total)'],
    'Projection Percentage': row['Projection Percentage'],
    'Projected Unit': row['Projected Unit']
  }));

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174E42' } };
  ws.getRow(1).alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'D1' };
  ws.getColumn(2).numFmt = '0';
  ws.getColumn(3).numFmt = '0.00';
  ws.getColumn(4).numFmt = '0';

  const notes = wb.addWorksheet('Read me');
  notes.addRows([
    ['Source', source === 'flipkart' ? 'Flipkart' : 'Website'],
    ['Projection percentage', `${percentage}%`],
    ['Calculation', 'Gross Units × (1 + projection percentage), then rounded UP to the next full case pack from the saved master.'],
    ['Example', 'If gross units = 100, projection = 25%, and case pack = 12, raw projection = 125 and final projected unit = 132.'],
    ['Created', new Date().toISOString()]
  ]);
  notes.columns = [{ width: 24 }, { width: 100 }];
  notes.getColumn(1).font = { bold: true };

  const blob = new Blob(
    [await wb.xlsx.writeBuffer()],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TEAME-Final-Projection-${source === 'flipkart' ? 'Flipkart' : 'Website'}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
