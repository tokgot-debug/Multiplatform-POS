/**
 * Minimal .xlsx reader.
 *
 * An xlsx is a ZIP of XML, and the platform already provides both halves:
 * DecompressionStream inflates the entries and the sheet format is regular
 * enough to scan directly. That avoids putting a megabyte of spreadsheet
 * library on a till, and avoids the npm `xlsx` package, whose known parser
 * CVEs sit exactly where untrusted files would be read.
 *
 * Reads what a product list needs - the first worksheet, shared and inline
 * strings, numbers - and nothing else. Formulas resolve to their cached value;
 * styles, dates and multiple sheets are ignored.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** Reads the ZIP central directory and inflates the entries we care about. */
async function unzip(buffer, wanted) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // The end-of-central-directory record sits at the tail, after an optional
  // comment, so it has to be found by scanning backwards for its signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66_000; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('That file is not a valid .xlsx workbook.');

  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const files = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    );

    if (wanted(name)) {
      // The local header repeats the name and extra fields, and its own
      // lengths are the authoritative ones for locating the data.
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const raw = bytes.subarray(start, start + compressedSize);

      let inflated;
      if (method === 0) {
        inflated = raw;
      } else if (method === 8) {
        const stream = new Blob([raw]).stream().pipeThrough(
          new DecompressionStream('deflate-raw')
        );
        inflated = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error(`Unsupported compression in ${name}.`);
      }

      files.set(name, new TextDecoder().decode(inflated));
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

const unescapeXml = (value) => value
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

/** Every <t> inside one <si>, joined - a styled cell is split into runs. */
export function parseSharedStrings(xml) {
  if (!xml) return [];

  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((match) => {
    const runs = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g));
    return unescapeXml(runs.map((run) => run[1]).join(''));
  });
}

/** "BC12" -> 54. Column letters are base-26 with no zero. */
export function columnIndex(reference) {
  const letters = String(reference).replace(/[^A-Z]/gi, '').toUpperCase();
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

/**
 * Sheet XML into a grid of strings.
 *
 * Empty cells are omitted from the XML entirely, so each cell is placed by its
 * own reference rather than by the order it appears in - otherwise one blank
 * cell shifts every column after it.
 */
export function parseSheet(xml, sharedStrings) {
  const rows = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];

    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2];
      const reference = /r="([A-Z]+\d+)"/i.exec(attributes);
      const type = /t="([^"]+)"/.exec(attributes);
      const at = reference ? columnIndex(reference[1]) : cells.length;

      let value = '';
      if (type && type[1] === 'inlineStr') {
        const runs = Array.from(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g));
        value = unescapeXml(runs.map((run) => run[1]).join(''));
      } else {
        const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);
        if (raw) {
          value = type && type[1] === 's'
            ? (sharedStrings[Number(raw[1])] ?? '')
            : unescapeXml(raw[1]);
        }
      }

      while (cells.length < at) cells.push('');
      cells[at] = value;
    }

    rows.push(cells);
  }

  return rows;
}

/** Reads a workbook into a header row plus data rows. */
export async function readWorkbook(arrayBuffer) {
  const files = await unzip(
    arrayBuffer,
    (name) => name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );

  const sheetName = Array.from(files.keys())
    .filter((name) => name.startsWith('xl/worksheets/'))
    .sort()[0];
  if (!sheetName) throw new Error('That workbook has no worksheets.');

  const shared = parseSharedStrings(files.get('xl/sharedStrings.xml'));
  const grid = parseSheet(files.get(sheetName), shared).filter(
    (row) => row.some((cell) => String(cell).trim() !== ''),
  );

  return { headers: grid[0] ?? [], rows: grid.slice(1) };
}
