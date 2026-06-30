# CC Daily — お気に入り自動収集・週次プロフィールチューニング 設計書

**作成:** 2026-06-30  
**スコープ:** CC Daily リポジトリ（静的 GitHub Pages + Firestore + Claude クラウドルーティン）

---

## 目的

CC Daily の★（お気に入り）を端末ローカルだけでなく Firestore にも自動ミラー保存し、週1 Claude ルーティンがタグ傾向を集計して `profile.json` の `interest_tags` 並び順を自動調整する。タグ増減など大きな変更は PR 本文で提案し人間が承認する（ハイブリッド方式）。

---

## 全体アーキテクチャ

```
[端末] ★トグル
   ├─ localStorage（UIの真実・変更なし）
   └─ Firestore favorites コレクションに1件ミラー書き込み（匿名認証）
              ↓
[公開読み取り] Firestore REST GET（Function なし・秘密鍵不要）
              ↓
[週1ルーティン] cc-daily-weekly-tune（日曜21:00 JST）
   1. Firestore REST を WebFetch
   2. scripts/tuneProfile.js で直近7日★タグ集計
   3. 並べ替えは自動適用、テーマ増減は提案 → PR 作成
              ↓
[毎朝ルーティン] 更新済み profile.json を読んで記事選定（既存・変更なし）
```

---

## 1. 書き込み側（アプリ）

### 変更ファイル
- `index.html` — Firebase Web SDK CDN 追加
- `app.js` — 匿名認証初期化 + ★トグル時の Firestore 書き込み/削除

### Firestore ドキュメント構造

コレクション: `favorites`  
ドキュメントキー: `{uid}_{url の MD5 下8文字}`

```json
{
  "uid": "匿名認証uid",
  "url": "https://...",
  "title_ja": "記事タイトル",
  "tags": ["アプリ開発", "自動化"],
  "issue_date": "2026-06-30",
  "timestamp": "2026-06-30T12:34:56Z"
}
```

### 書き込みポリシー
- **localStorage が UI の真実**。Firestore 書き込みはベストエフォート（失敗してもエラー表示なし・UI は変わらない）。
- ★ ON → `setDoc`（上書き）、★ OFF → `deleteDoc`。同期はこれだけ。
- `uid` は重複排除と削除のために使うのみ。二人分を同じコレクションに合算保存。

---

## 2. 公開読み取り側（Firestore セキュリティルール）

```javascript
match /favorites/{docId} {
  allow read: if true;                                  // 公開読み取り
  allow write: if request.auth != null                  // 書き込みは認証済みのみ
               && request.resource.data.uid == request.auth.uid;
  allow delete: if request.auth != null
               && resource.data.uid == request.auth.uid;
}
```

- 週次ルーティンは Firestore REST の公開 GET を `WebFetch` するだけ（秘密鍵不要）。
- 保存データは記事 URL・タグ・日付のみ。個人情報なし。

---

## 3. 週次チューニングルーティン

### ルーティン設定
- 名前: `cc-daily-weekly-tune`
- スケジュール: 毎週日曜 21:00 JST（月曜6時の毎朝号生成の前）
- モデル: Sonnet（$0）

### ルーティン手順
1. Firestore REST GET で直近7日の `favorites` を全件取得
2. `scripts/tuneProfile.js` を呼び出してタグ集計・新 `interest_tags` 生成
3. `profile.json` を更新して PR 作成（タイトル: `chore(profile): 週次★チューニング <date>`）

### scripts/tuneProfile.js

純粋関数として実装（入力＝★JSON配列＋現 profile.json、出力＝結果オブジェクト）。

```javascript
function tuneProfile(favorites, currentProfile) {
  // 直近7日のタグ頻度を集計
  const counts = {};
  favorites.forEach(f => (f.tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));

  const current = currentProfile.interest_tags;

  // 自動適用: 2件以上★のタグを繰り上げ、残りは元順を維持
  const promoted = current.filter(t => (counts[t] || 0) >= 2)
    .sort((a, b) => counts[b] - counts[a]);
  const rest = current.filter(t => (counts[t] || 0) < 2);
  const newTags = [...promoted, ...rest];

  // 提案: 未登録タグ（追加候補）、ゼロ★タグ（削除候補）
  const knownSet = new Set(current);
  const addCandidates = Object.keys(counts).filter(t => !knownSet.has(t) && counts[t] >= 2);
  const removeCandidates = current.filter(t => !counts[t]);

  return { newTags, addCandidates, removeCandidates, counts };
}
```

### ハイブリッドルール

| 変更の種類 | 対応 |
|---|---|
| `interest_tags` の並べ替え（2件以上★が上位へ） | **自動適用**（PR diff に現れる） |
| ★に出たが未登録のタグ（追加候補） | PR 本文に「追加しては?」として**提案のみ** |
| 数週間ゼロ★のタグ（削除候補） | PR 本文に「外しては?」として**提案のみ** |

★が0件の週は PR を立てない（ノイズ回避）。Firestore 不通は何もせずログのみ。

---

## 4. テスト方針

- `scripts/tuneProfile.js` は純粋関数なので**ユニットテスト必須**（入力 JSON を変えたパターンを最低5ケース）。
- 書き込み側（`app.js`）と週次ルーティンは**手動確認**（Firestore エミュレータで書き込み→ルーティン手動実行→PR 確認）。

---

## 5. YAGNI スコープ（今回やらないこと）

- 妻用の別 profile.json 分離（合算のまま）
- ROUTINE.md のキーワード自動書き換え（interest_tags の並べ替えに集中）
- リアルタイム反映（週1で十分）
- ダッシュボード（Firestore コンソールで直接見ればよい）
- Firebase Analytics / カスタムイベント

---

## 実装ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `index.html` | 編集 | Firebase Web SDK CDN 追加 |
| `app.js` | 編集 | 匿名認証初期化、★トグル時 Firestore 書き込み/削除 |
| `scripts/tuneProfile.js` | 新規 | タグ集計・チューニング純粋関数 |
| `scripts/tuneProfile.test.js` | 新規 | ユニットテスト（5ケース以上） |
| `scripts/weeklyTune.js` | 新規 | 週次ルーティン本体（Firestore 取得 → tuneProfile → PR） |
| Firestore セキュリティルール | 設定 | `favorites` の公開 read / 認証 write |
