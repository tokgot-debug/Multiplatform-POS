/**
 * CSV parsing for the catalogue import.
 *
 * Tolerant on purpose: the file comes from whatever the restaurant already
 * keeps its menu in, so columns are matched by a list of aliases rather than
 * one exact spelling, and the caller shows the operator which column it picked
 * before anything is written.
 */

/** Column aliases, lowercased and stripped of anything but letters. */
const FIELD_ALIASES = {
  sku: ['sku', 'code', 'itemcode', 'productcode', 'barcode', 'ref', 'itemno'],
  name: ['name', 'itemname', 'productname', 'product', 'item', 'description', 'menuitem'],
  sellPrice: ['sellprice', 'price', 'unitprice', 'selling', 'sellingprice', 'rate', 'amount', 'menuprice'],
  costPrice: ['costprice', 'cost', 'buyingprice', 'buy', 'purchaseprice'],
  categoryId: ['category', 'categoryid', 'group', 'section', 'menugroup', 'type'],
  uom: ['uom', 'unit', 'units', 'measure', 'unitofmeasure'],
  taxCode: ['taxcode', 'tax', 'vat', 'vatcode', 'taxclass']
};

const normalise = (header) => String(header || '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Turns a header row plus data rows into the shape importProducts accepts.
 * Shared by the CSV and workbook readers so both go through one mapper.
 */
export function rowsFromGrid(headers, grid) {
  const mapping = matchColumns(headers);
  if (!mapping.name && !mapping.sku) {
    return {
      rows: [],
      mapping,
      headers,
      error: `No product name or SKU column found. Headers read: ${headers.join(', ')}`
    };
  }

  const indexOf = {};
  for (const [field, header] of Object.entries(mapping)) {
    indexOf[field] = headers.indexOf(header);
  }

  const rows = grid.map((cells) => {
    const row = {};
    for (const [field, index] of Object.entries(indexOf)) {
      row[field] = cells[index] ?? '';
    }
    return row;
  });

  return { rows, mapping, headers, error: null };
}

/**
 * Splits one CSV line, honouring quoted fields and doubled quotes inside them.
 * A plain split(',') breaks on "Nyama Choma, 1/2 kg", which is exactly the kind
 * of name a menu contains.
 */
export function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

/** Maps the file's headers onto our fields. Returns { field: headerName }. */
export function matchColumns(headers) {
  const mapping = {};
  const used = new Set();

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = headers.findIndex((header, position) => {
      if (used.has(position)) return false;
      return aliases.includes(normalise(header));
    });
    if (index !== -1) {
      mapping[field] = headers[index];
      used.add(index);
    }
  }

  return mapping;
}

/**
 * Parses a CSV into rows the importProducts callable accepts.
 *
 * Returns the column mapping alongside the rows so the operator can confirm
 * that "Rate" really was read as the selling price before committing.
 */
export function parseProductCsv(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    return { rows: [], mapping: {}, headers: [], error: 'The file needs a header row and at least one product.' };
  }

  return rowsFromGrid(splitCsvLine(lines[0]), lines.slice(1).map(splitCsvLine));
}

const skuKey = (value) => String(value ?? '').trim().toUpperCase();

/**
 * Gives every row a SKU that is unique across the whole file.
 *
 * Products are stored under a key derived from their SKU, so any column that
 * repeats - a category, a supplier, a blank cell - silently collapses hundreds
 * of different products onto one record. That looks like a successful import
 * of a few dozen items.
 *
 * A repeated code carrying a different product name is treated as a code that
 * simply is not unique, and the row is kept under a suffixed one. A repeated
 * code carrying the same name is a genuine duplicate line and is dropped.
 */
export function ensureUniqueSkus(rows) {
  const seen = new Map();
  let generated = 0;
  let duplicates = 0;
  const result = [];

  for (const row of rows) {
    const name = String(row.name ?? '').trim();
    const base = skuKey(row.sku) || skuKey(name);

    // No code and no name: leave it for the server to reject and report.
    if (!base) {
      result.push(row);
      continue;
    }

    const signature = name.toLowerCase();
    if (!seen.has(base)) {
      seen.set(base, signature);
      result.push({ ...row, sku: String(row.sku ?? '').trim() || name });
      continue;
    }

    if (seen.get(base) === signature) {
      duplicates += 1;
      continue;
    }

    let suffix = 2;
    while (seen.has(`${base}-${suffix}`)) suffix += 1;
    const unique = `${base}-${suffix}`;
    seen.set(unique, signature);
    generated += 1;
    result.push({ ...row, sku: unique });
  }

  return { rows: result, generated, duplicates };
}

/**
 * Reads a product file, CSV or xlsx, into the same shape.
 *
 * The workbook reader is imported only when a workbook is actually chosen, so
 * a till that never imports one never downloads it.
 */
export async function parseProductFile(file) {
  const isWorkbook = /\.xlsx$/i.test(file.name)
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (!isWorkbook) {
    return parseProductCsv(await file.text());
  }

  try {
    const { readWorkbook } = await import('./xlsx.js');
    const { headers, rows } = await readWorkbook(await file.arrayBuffer());
    if (headers.length === 0) {
      return { rows: [], mapping: {}, headers: [], error: 'That workbook is empty.' };
    }
    return rowsFromGrid(headers, rows);
  } catch (err) {
    return { rows: [], mapping: {}, headers: [], error: err.message || 'Could not read that workbook.' };
  }
}
