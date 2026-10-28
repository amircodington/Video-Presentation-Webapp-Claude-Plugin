// Northwind Ledger sample app: live search, export toast, settings switches.
const search = document.getElementById('search');
if (search) {
  const rows = [...document.querySelectorAll('#report-rows tr')];
  const count = document.getElementById('row-count');
  const empty = document.getElementById('empty');
  const filter = () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const r of rows) {
      const hit = !q || r.textContent.toLowerCase().includes(q);
      r.hidden = !hit;
      if (hit) shown++;
    }
    count.textContent = `${shown} of ${rows.length} reports`;
    empty.hidden = shown > 0;
  };
  search.addEventListener('input', filter);
  filter();
}

const exportBtn = document.getElementById('export');
const toast = document.getElementById('toast');
let toastTimer;
if (exportBtn && toast) {
  exportBtn.addEventListener('click', () => {
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  });
}

for (const sw of document.querySelectorAll('.switch')) {
  sw.addEventListener('change', () => {
    const saved = document.getElementById('saved');
    if (!saved) return;
    saved.classList.add('show');
    clearTimeout(saved._t);
    saved._t = setTimeout(() => saved.classList.remove('show'), 2000);
  });
}
