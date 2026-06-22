const $ = (sel) => document.querySelector(sel);

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`load failed: ${path}`);
  return res.json();
}

function itemCard(item) {
  const tags = (item.tags || []).map((t) => `<span class="tag">${t}</span>`).join('');
  const reason = item.trust_reason ? `<div class="reason">${item.trust} ${item.trust_reason}</div>` : '';
  const dateLine = item.source_date ? `<div class="date">📅 ${item.source_date} の情報</div>` : '';
  const ideaLine = item.idea ? `<div class="idea">💡 こんな使い方：${item.idea}</div>` : '';
  const tryLine = item.try_hint ? `<div class="try">試すなら：${item.try_hint}</div>` : '';
  return `
    <details class="card">
      <summary><span class="badge">${item.trust}</span> ${item.title_ja}</summary>
      ${dateLine}
      <ul>${(item.summary_ja || []).map((s) => `<li>${s}</li>`).join('')}</ul>
      ${reason}
      ${ideaLine}
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${tryLine}
      <a class="src" href="${item.url}" target="_blank" rel="noopener">原文を開く ↗</a>
    </details>`;
}

function render(issue) {
  const top = issue.headline_top
    ? `<section class="top"><h2>🌟 今日の一番</h2>${itemCard(issue.headline_top)}</section>`
    : '';
  const quiet = issue.quiet_day ? `<p class="quiet">今日は静かでした。</p>` : '';
  const cats = (issue.categories || []).map((cat) => `
    <section class="cat">
      <h3>${cat.label || cat.key}</h3>
      ${(cat.items || []).map(itemCard).join('')}
    </section>`).join('');
  $('#issue').innerHTML = `<h1>${issue.date} の号</h1>${quiet}${top}${cats}`;
}

function applySearch(issue, q) {
  if (!q) return issue;
  const match = (it) => it.title_ja.includes(q) || (it.tags || []).some((t) => t.includes(q));
  return {
    ...issue,
    headline_top: issue.headline_top && match(issue.headline_top) ? issue.headline_top : null,
    categories: (issue.categories || []).map((c) => ({ ...c, items: (c.items || []).filter(match) })),
  };
}

let current = null;

async function boot() {
  const manifest = await loadJSON('issues/manifest.json');
  const sel = $('#dates');
  sel.innerHTML = manifest.map((m) => `<option value="${m.path}">${m.date}</option>`).join('');
  sel.addEventListener('change', async () => { current = await loadJSON(sel.value); render(current); });
  $('#q').addEventListener('input', (e) => render(applySearch(current, e.target.value.trim())));
  current = await loadJSON(manifest[0].path);
  render(current);
}

boot().catch((e) => { $('#issue').textContent = '読み込みに失敗しました: ' + e.message; });
