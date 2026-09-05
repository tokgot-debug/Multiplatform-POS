import assert from 'node:assert/strict';
import { deflateRawSync, crc32 } from 'node:zlib';
import test from 'node:test';

import { columnIndex, parseSharedStrings, parseSheet, readWorkbook } from './xlsx.js';

/** Builds a real .xlsx byte stream so the ZIP reader is exercised, not stubbed. */
function buildXlsx(entries, { compress = true } = {}) {
  const encoder = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const raw = encoder.encode(content);
    const data = compress ? new Uint8Array(deflateRawSync(raw)) : raw;
    const method = compress ? 8 : 0;
    const crc = crc32(Buffer.from(raw));

    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    Buffer.from(nameBytes).copy(local, 30);
    Buffer.from(data).copy(local, 30 + nameBytes.length);
    locals.push(local);

    const entry = Buffer.alloc(46 + nameBytes.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    Buffer.from(nameBytes).copy(entry, 46);
    central.push(entry);

    offset += local.length;
  }

  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  const zip = Buffer.concat([...locals, directory, eocd]);
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
}

const SHARED = `<?xml version="1.0"?><sst count="4">
  <si><t>SKU</t></si>
  <si><t>Product Name</t></si>
  <si><t>Price</t></si>
  <si><r><t>Nyama </t></r><r><t>Choma</t></r></si>
</sst>`;

const SHEET = `<?xml version="1.0"?><worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
  <row r="2"><c r="A2" t="inlineStr"><is><t>FOD-01</t></is></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>800</v></c></row>
  <row r="3"><c r="A3" t="inlineStr"><is><t>BAR-02</t></is></c><c r="C3"><v>0</v></c></row>
</sheetData></worksheet>`;

const workbook = (options) => buildXlsx(
  { 'xl/sharedStrings.xml': SHARED, 'xl/worksheets/sheet1.xml': SHEET },
  options,
);

test('column letters convert to zero-based indexes', () => {
  assert.equal(columnIndex('A1'), 0);
  assert.equal(columnIndex('C3'), 2);
  assert.equal(columnIndex('Z1'), 25);
  assert.equal(columnIndex('AA1'), 26);
  assert.equal(columnIndex('BC12'), 54);
});

test('a shared string split into styled runs is rejoined', () => {
  assert.deepEqual(parseSharedStrings(SHARED), ['SKU', 'Product Name', 'Price', 'Nyama Choma']);
});

test('an omitted cell leaves a gap instead of shifting the row', () => {
  // Row 3 has no B cell. Reading cells in document order would slide the price
  // into the product name column and import every row wrong.
  const rows = parseSheet(SHEET, parseSharedStrings(SHARED));
  assert.deepEqual(rows[2], ['BAR-02', '', '0']);
});

test('a deflated workbook reads end to end', async () => {
  const { headers, rows } = await readWorkbook(workbook());

  assert.deepEqual(headers, ['SKU', 'Product Name', 'Price']);
  assert.deepEqual(rows[0], ['FOD-01', 'Nyama Choma', '800']);
});

test('an uncompressed workbook reads too', async () => {
  const { rows } = await readWorkbook(workbook({ compress: false }));
  assert.deepEqual(rows[0], ['FOD-01', 'Nyama Choma', '800']);
});

test('a zero price survives as a zero, not a blank', async () => {
  const { rows } = await readWorkbook(workbook());
  assert.equal(rows[1][2], '0');
});

test('something that is not a workbook fails with a readable message', async () => {
  await assert.rejects(
    () => readWorkbook(new TextEncoder().encode('just some text').buffer),
    /not a valid .xlsx workbook/,
  );
});
