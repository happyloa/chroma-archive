/**
 * 可排序表格（US-06-4）：表頭按鈕帶 data-sort-key，資料列帶同名的 data-* 值。
 * 同一欄再點一次反向排序，並更新 aria-sort。
 */
export function initSortTable(): void {
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-sort-key]');
    const table = button?.closest<HTMLTableElement>('table[data-sortable]');
    if (!button || !table) return;
    const key = button.dataset.sortKey!;
    const th = button.closest('th')!;
    const ascending = th.getAttribute('aria-sort') !== 'ascending';
    for (const other of table.querySelectorAll('th')) other.removeAttribute('aria-sort');
    th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');

    const body = table.tBodies[0]!;
    const rows = [...body.rows];
    rows.sort((a, b) => {
      const x = a.dataset[key] ?? '';
      const y = b.dataset[key] ?? '';
      const nx = Number(x);
      const ny = Number(y);
      const diff = Number.isNaN(nx) || Number.isNaN(ny) ? x.localeCompare(y) : nx - ny;
      return ascending ? diff : -diff;
    });
    body.append(...rows);
  });
}
