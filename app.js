const $ = (sel) => document.querySelector(sel);

// 端末内に保存する状態（お気に入り・既読）
const LS_FAV = 'ccd_fav';
const LS_READ = 'ccd_read';
const getSet = (k) => new Set(JSON.parse(localStorage.getItem(k) || '[]'));
const saveSet = (k, s) => localStorage.setItem(k, JSON.stringify([...s]));
let favorites = getSet(LS_FAV);
let read = getSet(LS_READ);

let manifest = [];
let current = null;     // 表示中の号
let filter = 'all';     // all | unread | fav

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`load failed: ${path}`);
  return res.json();
}

// 号の全記事を1本の配列に（headline + 各カテゴリ）
function allItems(issue) {
  const items = [];
  if (issue.headline_top) items.push(issue.headline_top);
  (issue.categories || []).forEach((c) => (c.items || []).forEach((i) => items.push(i)));
  return items;
}

function itemCard(item) {
  const tags = (item.tags || []).map((t) => `<span class="tag">${t}</span>`).join('');
  const reason = item.trust_reason ? `<div class="reason">${item.trust} ${item.trust_reason}</div>` : '';
  const dateLine = item.source_date ? `<div class="date">📅 ${item.source_date} の情報</div>` : '';
  const lead = (item.summary_ja || []).map((s) => `<span>${s}</span>`).join('');
  const more = (Array.isArray(item.ideas) && item.ideas.length)
    ? `<div class="more"><div class="more-title">💡 ほかにもこんな使い方</div><ul>${item.ideas.map((i) => `<li>${i}</li>`).join('')}</ul></div>`
    : '';
  const tryLine = item.try_hint ? `<div class="try">試すなら：${item.try_hint}</div>` : '';
  const isFav = favorites.has(item.url);
  const isRead = read.has(item.url);
  return `
    <details class="card${isRead ? ' is-read' : ''}">
      <summary>
        <span class="row">
          <span class="badge">${item.trust}</span>
          <span class="title">${!isRead ? '<span class="dot" aria-label="未読"></span>' : ''}${item.title_ja}</span>
          <span class="acts">
            <button class="act act-fav${isFav ? ' on' : ''}" data-act="fav" data-url="${item.url}" aria-label="お気に入り" title="お気に入り">${isFav ? '★' : '☆'}</button>
            <button class="act act-read${isRead ? ' on' : ''}" data-act="read" data-url="${item.url}" aria-label="既読チェック" title="読んだら押す">✓</button>
          </span>
        </span>
        <span class="lead-label">こんなことができます</span>
        <span class="lead">${lead}</span>
      </summary>
      ${dateLine}
      ${reason}
      ${more}
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${tryLine}
      <a class="src" href="${item.url}" target="_blank" rel="noopener">原文を開く ↗</a>
    </details>`;
}

// その号の既読進捗（細い・上部固定バー）
function renderProgress(issue) {
  if (!issue || filter === 'fav') { $('#progressbar').innerHTML = ''; return; }
  const items = allItems(issue);
  const total = items.length;
  const done = items.filter((i) => read.has(i.url)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  $('#progressbar').innerHTML = `
    <div class="pbar${allDone ? ' done' : ''}">
      <span class="pbar-track"><span class="pbar-fill" style="width:${pct}%"></span></span>
      <span class="pbar-num">${done}/${total}${allDone ? ' 読了' : ''}</span>
    </div>`;
}

function filterBar() {
  const tab = (key, label) => `<button class="ftab${filter === key ? ' on' : ''}" data-filter="${key}">${label}</button>`;
  return `<div class="filters">${tab('all', 'すべて')}${tab('unread', '未読')}</div>`;
}

const legend = `<div class="legend"><span>🟩 公式・本家発で安心</span><span>🟦 信頼できる二次情報</span><span>🟨 要注意（理由つき）</span></div>`;

// 通常表示（1つの号）
function renderIssue(issue) {
  const top = issue.headline_top && (filter !== 'unread' || !read.has(issue.headline_top.url))
    ? `<section class="top"><h2>🌟 今日の一番</h2>${itemCard(issue.headline_top)}</section>`
    : '';
  const quiet = issue.quiet_day ? `<p class="quiet">今日は静かでした。</p>` : '';
  const cats = (issue.categories || []).map((cat) => {
    const items = (cat.items || []).filter((i) => filter !== 'unread' || !read.has(i.url));
    if (!items.length) return '';
    return `<section class="cat" data-key="${cat.key || ''}"><h3>${cat.label || cat.key}</h3>${items.map(itemCard).join('')}</section>`;
  }).join('');
  $('#issue').innerHTML = `${filterBar()}${quiet}${top}${cats}${legend}`;
}

// お気に入り横断表示（全号からお気に入り記事を集約）
async function renderFavorites() {
  const collected = [];
  for (const m of manifest) {
    try {
      const issue = await loadJSON(m.path);
      allItems(issue).forEach((it) => { if (favorites.has(it.url)) collected.push(it); });
    } catch (e) { /* skip */ }
  }
  const body = collected.length
    ? `<section class="cat"><h3>★ お気に入り（${collected.length}件）</h3>${collected.map(itemCard).join('')}</section>`
    : `<p class="quiet">まだお気に入りがありません。記事の ☆ をタップすると、ここにまとまります。</p>`;
  $('#issue').innerHTML = `<h1>★ お気に入り</h1>${body}${legend}`;
}

function render() {
  renderProgress(current);
  $('#favBtn').classList.toggle('on', filter === 'fav');
  $('#favBtn').innerHTML = filter === 'fav' ? '★ お気に入り' : '☆ お気に入り';
  if (filter === 'fav') { renderFavorites(); return; }
  if (current) renderIssue(current);
}

async function boot() {
  manifest = await loadJSON('issues/manifest.json');
  const sel = $('#dates');
  sel.innerHTML = manifest.map((m) => `<option value="${m.path}">${m.date}</option>`).join('');
  sel.addEventListener('change', async () => { current = await loadJSON(sel.value); filter = 'all'; render(); });

  $('#favBtn').addEventListener('click', () => { filter = filter === 'fav' ? 'all' : 'fav'; render(); });

  // ☆✓ トグルとフィルタ切替（イベント委譲）
  $('#issue').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      e.preventDefault();
      e.stopPropagation();
      const url = act.getAttribute('data-url');
      const kind = act.getAttribute('data-act');
      const set = kind === 'fav' ? favorites : read;
      if (set.has(url)) set.delete(url); else set.add(url);
      saveSet(kind === 'fav' ? LS_FAV : LS_READ, set);
      // お気に入りにしたら同時に既読をつける
      if (kind === 'fav' && favorites.has(url) && !read.has(url)) { read.add(url); saveSet(LS_READ, read); }
      render();
      return;
    }
    const ftab = e.target.closest('[data-filter]');
    if (ftab) { filter = ftab.getAttribute('data-filter'); render(); }
  });

  current = await loadJSON(manifest[0].path);
  render();
}

boot().catch((e) => { $('#issue').textContent = '読み込みに失敗しました: ' + e.message; });
