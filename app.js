import { groupByWeek } from './scripts/groupArchive.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const $ = (sel) => document.querySelector(sel);

// Firebase 初期化（★をFirestoreにミラー保存する）
const fbApp = initializeApp({
  apiKey: "AIzaSyDJyN52ZW_gsESmJ4zhDRLjFbZvj4bTf_w",
  authDomain: "cc-daily-897f4.firebaseapp.com",
  projectId: "cc-daily-897f4",
  storageBucket: "cc-daily-897f4.firebasestorage.app",
  messagingSenderId: "1053058214515",
  appId: "1:1053058214515:web:e1bddfdda37b4c46ffd806",
});
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
let uid = null;
signInAnonymously(auth).then((cred) => { uid = cred.user.uid; }).catch(() => {});

// 端末内に保存する状態（お気に入り・既読）
const LS_FAV = 'ccd_fav';
const LS_READ = 'ccd_read';
const getSet = (k) => new Set(JSON.parse(localStorage.getItem(k) || '[]'));
const saveSet = (k, s) => localStorage.setItem(k, JSON.stringify([...s]));
let favorites = getSet(LS_FAV);
let read = getSet(LS_READ);

let manifest = [];
let current = null;     // 表示中の号
let view = 'todo';      // todo（やること）| fav（お気に入り）| archive（アーカイブ）

// URL から Firestore docId 生成用ハッシュ（小規模用途・速度優先）
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ★状態を Firestore にベストエフォートでミラー（失敗しても UI に影響しない）
async function mirrorFav(adding, url, title, tagsStr, date) {
  if (!uid) return;
  try {
    const ref = doc(db, 'favorites', `${uid}_${simpleHash(url)}`);
    if (adding) {
      await setDoc(ref, {
        uid, url,
        title_ja: title,
        tags: tagsStr ? tagsStr.split(',').filter(Boolean) : [],
        issue_date: date,
        timestamp: serverTimestamp(),
      });
    } else {
      await deleteDoc(ref);
    }
  } catch (_) {}
}

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

// やること判定：まだ手をつけていない＝未読 かつ 非お気に入り
const isTodo = (item) => !read.has(item.url) && !favorites.has(item.url);
// 処理済み判定：お気に入り or 既読
const isHandled = (item) => favorites.has(item.url) || read.has(item.url);

// HTML属性値エスケープ
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function itemCard(item, date = '') {
  const tags = (item.tags || []).map((t) => `<span class="tag">${t}</span>`).join('');
  const reason = item.trust_reason ? `<div class="reason">${item.trust} ${item.trust_reason}</div>` : '';
  const dateLine = item.source_date ? `<div class="date">📅 ${item.source_date} の情報</div>` : '';
  const lead = (item.summary_ja || []).map((s) => `<span>${s}</span>`).join('');
  // 記事本文（何が新しく加わり、各機能は何か＝覚える事実・定義）。配列の各要素を段落に。
  const articleBody = Array.isArray(item.article) ? item.article : (item.article ? [item.article] : []);
  const article = articleBody.length
    ? `<div class="article"><div class="article-title">📰 記事</div>${articleBody.map((p) => `<p>${p}</p>`).join('')}</div>`
    : '';
  // 試すなら（手を動かす実践レシピ＝身につく知恵）。
  const tryLine = item.try_hint ? `<div class="try"><div class="try-title">🔧 試すなら（やってみよう）</div><p>${item.try_hint}</p></div>` : '';
  const isFav = favorites.has(item.url);
  const isRead = read.has(item.url);
  return `
    <details class="card${isRead ? ' is-read' : ''}" data-card="${item.url}">
      <summary>
        <span class="row">
          <span class="badge">${item.trust}</span>
          <span class="title">${!isRead && !isFav ? '<span class="dot" aria-label="未読"></span>' : ''}${item.title_ja}</span>
          <span class="acts">
            <button class="act act-fav${isFav ? ' on' : ''}" data-act="fav" data-url="${item.url}" data-title="${escAttr(item.title_ja || '')}" data-tags="${escAttr((item.tags || []).join(','))}" data-date="${escAttr(date)}" aria-label="お気に入り" title="お気に入り">${isFav ? '★' : '☆'}</button>
            <button class="act act-read${isRead ? ' on' : ''}" data-act="read" data-url="${item.url}" aria-label="既読チェック" title="読んだら押す">✓</button>
          </span>
        </span>
        <span class="lead-label">こんなことができます</span>
        <span class="lead">${lead}</span>
      </summary>
      ${article}
      ${dateLine}
      ${reason}
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${tryLine}
      <a class="src" href="${item.url}" target="_blank" rel="noopener">原文を開く ↗</a>
    </details>`;
}

// その号の進捗（細い・上部固定バー）。やること表示のときだけ。
function renderProgress(issue) {
  if (!issue || view !== 'todo') { $('#progressbar').innerHTML = ''; return; }
  const items = allItems(issue);
  const total = items.length;
  const done = items.filter(isHandled).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  $('#progressbar').innerHTML = `
    <div class="pbar${allDone ? ' done' : ''}">
      <span class="pbar-track"><span class="pbar-fill" style="width:${pct}%"></span></span>
      <span class="pbar-num">${done}/${total}${allDone ? ' 読了' : ''}</span>
    </div>`;
}

const legend = `<div class="legend"><span>🟩 安全（公式・本人発）</span><span>🟨 注意（二次・未確認）</span><span>🟥 要警戒（SNS等・鵜呑み禁物）</span></div>`;

// お祝い（やることが全部片付いたとき）
function celebrateBlock() {
  return `
    <section class="celebrate">
      <div class="celebrate-emoji">🎉</div>
      <h2>全部読みました！</h2>
      <p>今日の CC Daily はこれで読了です。おつかれさまでした。</p>
      <p class="celebrate-sub">読み返したい記事は <b>🗄️ アーカイブ</b>、とっておきは <b>⭐ お気に入り</b> からいつでも見られます。</p>
    </section>`;
}

// 通常表示（やること：未読かつ非お気に入りだけ）
function renderTodo(issue) {
  const top = issue.headline_top && isTodo(issue.headline_top)
    ? `<section class="top"><h2>🌟 今日の一番</h2>${itemCard(issue.headline_top, issue.date || '')}</section>`
    : '';
  const cats = (issue.categories || []).map((cat) => {
    const items = (cat.items || []).filter(isTodo);
    if (!items.length) return '';
    return `<section class="cat" data-key="${cat.key || ''}"><h3>${cat.label || cat.key}</h3>${items.map((i) => itemCard(i, issue.date || '')).join('')}</section>`;
  }).join('');

  const hasArticles = allItems(issue).length > 0;
  const nothingLeft = !top && !cats;

  let body;
  if (issue.quiet_day && nothingLeft) {
    body = `<p class="quiet">今日は静かでした。</p>`;
  } else if (nothingLeft && hasArticles) {
    body = celebrateBlock();
  } else {
    body = `${top}${cats}`;
  }
  $('#issue').innerHTML = `${body}${legend}`;
}

// お気に入り横断表示（全号のお気に入りを月の第N週ごとに折りたたみ）
async function renderFavorites() {
  const entries = [];
  for (const m of manifest) {
    try {
      const issue = await loadJSON(m.path);
      allItems(issue).forEach((it) => { if (favorites.has(it.url)) entries.push({ item: it, date: issue.date }); });
    } catch (e) { /* skip */ }
  }
  const groups = groupByWeek(entries);
  const total = entries.length;
  const body = groups.length
    ? groups.map((g) => `
        <details class="week-group">
          <summary><span class="week-label">${g.label}</span><span class="week-count">${g.entries.length}</span></summary>
          ${g.entries.map((e) => itemCard(e.item, e.date || '')).join('')}
        </details>`).join('')
    : `<p class="quiet">まだお気に入りがありません。記事の ☆ をタップすると、ここにまとまります。</p>`;
  $('#issue').innerHTML = `<h1>⭐ お気に入り（${total}件）</h1>${body}${legend}`;
}

// アーカイブ横断表示（全号の「既読かつ非お気に入り」を月の第N週ごとに折りたたみ）
async function renderArchive() {
  const entries = [];
  for (const m of manifest) {
    try {
      const issue = await loadJSON(m.path);
      allItems(issue).forEach((it) => {
        if (read.has(it.url) && !favorites.has(it.url)) entries.push({ item: it, date: issue.date });
      });
    } catch (e) { /* skip */ }
  }
  const groups = groupByWeek(entries);
  const total = entries.length;
  const body = groups.length
    ? groups.map((g) => `
        <details class="week-group">
          <summary><span class="week-label">${g.label}</span><span class="week-count">${g.entries.length}</span></summary>
          ${g.entries.map((e) => itemCard(e.item, e.date || '')).join('')}
        </details>`).join('')
    : `<p class="quiet">まだ読んだ記事がありません。記事の ✓ をタップすると、ここにまとまります。</p>`;
  $('#issue').innerHTML = `<h1>🗄️ アーカイブ（${total}件）</h1>${body}${legend}`;
}

function render() {
  renderProgress(current);
  $('#favBtn').classList.toggle('on', view === 'fav');
  $('#archiveBtn').classList.toggle('on', view === 'archive');
  if (view === 'fav') { renderFavorites(); return; }
  if (view === 'archive') { renderArchive(); return; }
  if (current) renderTodo(current);
}

// ☆✓を押したら「消し込み」アニメーション→状態保存→Firestoreミラー→再描画
function handleAct(act) {
  const url = act.getAttribute('data-url');
  const kind = act.getAttribute('data-act');
  const set = kind === 'fav' ? favorites : read;
  if (set.has(url)) set.delete(url); else set.add(url);
  saveSet(kind === 'fav' ? LS_FAV : LS_READ, set);
  // お気に入りにしたら同時に既読をつける（進捗カウント用）
  if (kind === 'fav' && favorites.has(url) && !read.has(url)) { read.add(url); saveSet(LS_READ, read); }

  // ★トグル時にFirestoreへミラー（ベストエフォート・失敗してもUIは変わらない）
  if (kind === 'fav') {
    mirrorFav(
      favorites.has(url),
      url,
      act.getAttribute('data-title') || '',
      act.getAttribute('data-tags') || '',
      act.getAttribute('data-date') || '',
    );
  }

  // やること表示で、この操作によって一覧から外れる場合はスッと消す演出
  const card = document.querySelector(`[data-card="${CSS.escape(url)}"]`);
  const willLeave = view === 'todo' && isHandled({ url });
  if (card && willLeave) {
    card.classList.add('removing');
    setTimeout(render, 280);
  } else {
    render();
  }
}

async function boot() {
  manifest = await loadJSON('issues/manifest.json');
  const sel = $('#dates');
  sel.innerHTML = manifest.map((m) => `<option value="${m.path}">${m.date}</option>`).join('');
  sel.addEventListener('change', async () => { current = await loadJSON(sel.value); view = 'todo'; render(); });

  $('#favBtn').addEventListener('click', () => { view = view === 'fav' ? 'todo' : 'fav'; render(); });
  $('#archiveBtn').addEventListener('click', () => { view = view === 'archive' ? 'todo' : 'archive'; render(); });

  // ☆✓ トグル（イベント委譲）
  $('#issue').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      e.preventDefault();
      e.stopPropagation();
      handleAct(act);
    }
  });

  current = await loadJSON(manifest[0].path);
  render();
}

boot().catch((e) => { $('#issue').textContent = '読み込みに失敗しました: ' + e.message; });
