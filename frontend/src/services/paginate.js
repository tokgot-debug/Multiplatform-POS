/**
 * Client-side pagination shared by the screens that render unbounded tables.
 *
 * The rows are already in memory (Dexie is the till's system of record), so
 * this only ever slices - it never re-queries. Kept free of DOM imports below
 * the markup helpers so the maths can be exercised in a plain node test.
 */

export const PAGE_SIZE = 25;

/**
 * Slices `rows` to a page and reports what a pager needs to render.
 *
 * The page is clamped into range on every call. A filter that shrinks the list
 * while the user sits on page 5 would otherwise strand them on an empty table
 * with no way back.
 */
export function paginate(rows, page = 1, size = PAGE_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const perPage = Number.isSafeInteger(size) && size > 0 ? size : PAGE_SIZE;
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), pages);
  const start = (current - 1) * perPage;

  return {
    rows: list.slice(start, start + perPage),
    page: current,
    pages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, total)
  };
}

const BUTTON_STYLE = 'background:rgba(255,255,255,0.05);border:1px solid var(--border-color);'
  + 'border-radius:6px;padding:6px 12px;color:var(--text-primary);'
  + 'font-family:var(--font-main);font-size:12px;cursor:pointer;';

/** Pager strip. Empty string when there is nothing to page through. */
export function pagerHtml(id, view) {
  if (view.total === 0) return '';

  return `
    <div id="${id}" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border-color);font-size:12px;color:var(--text-secondary);">
      <span>Showing ${view.from}-${view.to} of ${view.total}</span>
      <span style="display:flex;gap:8px;align-items:center;">
        <button type="button" data-page="prev" ${view.page <= 1 ? 'disabled' : ''} style="${BUTTON_STYLE}">Prev</button>
        <span>Page ${view.page} of ${view.pages}</span>
        <button type="button" data-page="next" ${view.page >= view.pages ? 'disabled' : ''} style="${BUTTON_STYLE}">Next</button>
      </span>
    </div>`;
}

/** Wires the strip's buttons. Re-call after each re-render. */
export function bindPager(id, view, onChange) {
  const host = document.getElementById(id);
  if (!host) return;

  host.querySelectorAll('button[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-page') === 'prev' ? view.page - 1 : view.page + 1;
      if (next >= 1 && next <= view.pages) onChange(next);
    });
  });
}
