export const MASTER_HEADERS = ['Product Id', 'Item Id', 'Case Pack'];
export const FLIPKART_HEADERS = ['Product Id', 'Item Id', 'Gross Units'];
export const WEBSITE_HEADERS = ['Item Id', 'Gross Units'];

const norm = value => String(value ?? '')
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .replace(/[ _-]/g, '');

const clean = value => String(value ?? '').trim();

function requiredHeaders(kind) {
  if (kind === 'master') return MASTER_HEADERS;
  if (kind === 'flipkart') return FLIPKART_HEADERS;
  if (kind === 'website') return WEBSITE_HEADERS;
  throw new Error(`Unknown file type: ${kind}`);
}

function parseWholeNumber(value, label, rowNumber, { positive = false } = {}) {
  const text = clean(value);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new Error(`Row ${rowNumber}: ${label} must be a ${positive ? 'positive' : 'non-negative'} whole number.`);
  }
  const n = Number(text);
  if (positive && n <= 0) {
    throw new Error(`Row ${rowNumber}: ${label} must be a positive whole number.`);
  }
  return n;
}

export function validateRows(matrix, kind) {
  if (!Array.isArray(matrix) || matrix.length < 2) {
    throw new Error('The file needs a header row and at least one data row.');
  }

  const required = requiredHeaders(kind);
  const headers = matrix[0].map(norm);
  const nonBlankHeaders = headers.filter(Boolean);
  if (new Set(nonBlankHeaders).size !== nonBlankHeaders.length) {
    throw new Error('Duplicate column headers found.');
  }

  const missing = required.filter(h => !headers.includes(norm(h)));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);

  const result = [];
  const productMappings = new Map();
  const itemCasePacks = new Map();
  const masterPairs = new Set();

  for (let i = 1; i < matrix.length; i++) {
    const inputRow = matrix[i];
    if (inputRow.every(v => clean(v) === '')) continue;

    const row = Object.fromEntries(
      required.map(h => [h, clean(inputRow[headers.indexOf(norm(h))])])
    );

    for (const h of required) {
      if (!row[h]) throw new Error(`Row ${i + 1}: ${h} is empty.`);
    }

    if (kind === 'master') {
      row['Case Pack'] = parseWholeNumber(row['Case Pack'], 'Case Pack', i + 1, { positive: true });

      const product = row['Product Id'];
      const item = row['Item Id'];
      const casePack = row['Case Pack'];

      if (productMappings.has(product) && productMappings.get(product) !== item) {
        throw new Error(`Row ${i + 1}: Product ${product} maps to more than one Item Id.`);
      }
      productMappings.set(product, item);

      if (itemCasePacks.has(item) && itemCasePacks.get(item) !== casePack) {
        throw new Error(`Row ${i + 1}: Item ${item} has more than one Case Pack.`);
      }
      itemCasePacks.set(item, casePack);

      const pair = `${product}\u0000${item}\u0000${casePack}`;
      if (masterPairs.has(pair)) continue;
      masterPairs.add(pair);
    } else {
      row['Gross Units'] = parseWholeNumber(row['Gross Units'], 'Gross Units', i + 1);
    }

    result.push(row);
  }

  if (!result.length) throw new Error('No data rows found.');
  if (result.length > 50000) throw new Error('Use a maximum of 50,000 rows per file.');
  return result;
}

export function validateProjectionPercentage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1000) {
    throw new Error('Projection percentage must be between 0 and 1000.');
  }
  return n;
}

function roundToCasePack(gross, percentage, casePack) {
  if (gross === 0) return 0;
  const uplifted = gross * (1 + percentage / 100);
  return Math.ceil((uplifted - Number.EPSILON) / casePack) * casePack;
}

export function buildProjection(sales, master, source, percentageInput) {
  if (!Array.isArray(sales) || !sales.length) return { rows: [], errors: [] };
  if (!Array.isArray(master) || !master.length) {
    return { rows: [], errors: ['Item master is not available.'] };
  }

  const percentage = validateProjectionPercentage(percentageInput);
  const byProduct = new Map();
  const byItem = new Map();

  for (const row of master) {
    byProduct.set(row['Product Id'], row);
    const existing = byItem.get(row['Item Id']);
    if (!existing) byItem.set(row['Item Id'], row);
  }

  const totals = new Map();
  const errorSet = new Set();

  for (const row of sales) {
    let masterRow;
    if (source === 'flipkart') {
      masterRow = byProduct.get(row['Product Id']);
      if (!masterRow) {
        errorSet.add(`Product Id ${row['Product Id']} is not in the master.`);
        continue;
      }
      if (masterRow['Item Id'] !== row['Item Id']) {
        errorSet.add(`Product Id ${row['Product Id']} is mapped to ${masterRow['Item Id']} in the master, but the sales file contains ${row['Item Id']}.`);
        continue;
      }
    } else if (source === 'website') {
      masterRow = byItem.get(row['Item Id']);
      if (!masterRow) {
        errorSet.add(`Item Id ${row['Item Id']} is not in the master.`);
        continue;
      }
    } else {
      throw new Error('Select Flipkart or Website before building the projection.');
    }

    const itemId = masterRow['Item Id'];
    const current = totals.get(itemId) || {
      'Item Id': itemId,
      'Gross Units(total)': 0,
      'Projection Percentage': percentage,
      'Case Pack': masterRow['Case Pack']
    };
    current['Gross Units(total)'] += row['Gross Units'];
    if (!Number.isSafeInteger(current['Gross Units(total)'])) {
      throw new Error('Gross unit total exceeds the safe calculation limit.');
    }
    totals.set(itemId, current);
  }

  const rows = [...totals.values()]
    .map(row => ({
      ...row,
      'Projected Unit': roundToCasePack(
        row['Gross Units(total)'],
        percentage,
        row['Case Pack']
      )
    }))
    .sort((a, b) => a['Item Id'].localeCompare(b['Item Id'], undefined, { numeric: true }));

  return { rows, errors: [...errorSet] };
}
