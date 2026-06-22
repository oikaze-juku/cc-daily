const $ = (sel) => document.querySelector(sel);

async function loadJSON(path) {
  // 毎朝更新される号を常に最新で取得する（ブラウザキャッシュを使わない）
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`load failed: ${path}`);
  return res.json();
}

function itemCard(item) {
  const tags = (item.tags || []).map((t) => `<span class="tag">${t}</span>`).join('');
  const reason = item.trust_reason ? `<div class="reason">${item.trust} ${item.trust_reason}</div>` : '';
  const dateLine = item.source_date ? `<div class="date">📅 ${item.source_date} の情報</div>` : '';
  // 折りたたみ時に見える「こんなことができます」概要（メインの活用イメージ）
  const lead = (item.summary_ja || []).map((s) => `<span>${s}</span>`).join('');
  // 展開時に出る「ほかにもこんな使い方」（同じ熱量の別案）
  const more = (Array.isArray(item.ideas) && item.ideas.length)
    ? `<div class="more"><div class="more-title">💡 ほかにもこんな使い方</div><ul>${item.ideas.map((i) => `<li>${i}</li>`).join('')}</ul></div>`
    : '';
  const tryLine = item.try_hint ? `<div class="try">試すなら：${item.try_hint}</div>` : '';
  return `
    <details class="card">
      <summary>
        <span class="badge">${item.trust}</span>
        <span class="head">
          <span class="title">${item.title_ja}</span>
          <span class="lead-label">こんなことができます</span>
          <span class="lead">${lead}</span>
        </span>
      </summary>
      ${dateLine}
      ${reason}
      ${more}
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
    <section class="cat" data-key="${cat.key || ''}">
      <h3>${cat.label || cat.key}</h3>
      ${(cat.items || []).map(itemCard).join('')}
    </section>`).join('');
  const legend = `<div class="legend"><span>🟩 公式・本家発で安心</span><span>🟦 信頼できる二次情報</span><span>🟨 要注意（理由つき）</span></div>`;
  $('#issue').innerHTML = `<h1>${issue.date} の号</h1>${legend}${quiet}${top}${cats}`;
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
