# CC Daily — 夫婦別プロファイル学習ループ（案B：共有探索1回→人別選抜）設計書

**作成:** 2026-07-02
**スコープ:** cc-daily（探索・学習ループ・プロファイル）／ juku-reservation（Firestoreルール）／ yomimono（読み先1行）
**前提設計:** [2026-06-30-favorite-auto-tuning-design.md](2026-06-30-favorite-auto-tuning-design.md)（単一 profile.json の自動チューニング）を、夫婦で別プロファイルに拡張する。

---

## 目的

毎晩23:00の学習ループが、**夫の星（SRcockpit）と妻の星（yomimono）を別々に学習**し、**夫用・妻用の2つの好みプロファイル**を育てる。朝は**探索を1回だけ共有**で行い（コスト増を最小化）、集めたプールから**人ごとに記事を選抜**して2つの号を出す。アプリ内レコメンドUIは今回のスコープ外（学習の器を先に作る）。

### 現状の問題（実確認済み・2026-07-02）

- 学習ループ（[TUNE.md](../../../TUNE.md)）が読む★は **cc-daily 専用プロジェクト `cc-daily-897f4` の `favorites`** だけ。書くのは cc-daily の GitHub Pages ビューア（app.js・匿名認証）のみ。
- 妻の星は `yomimono_marks`、夫の星は `srcockpit_dailyMarks`（共に **juku-reservation** プロジェクト）に入る。**どちらも今のループに入っていない。**
- プロファイルは単一 `profile.json`（夫婦合算）。前提設計の YAGNI:139 で「妻用profile分離」は先送り済み。本設計でそれを実装する。

---

## 全体アーキテクチャ

```
[Phase 0] juku-reservation/firestore.rules
   yomimono_marks / srcockpit_dailyMarks に「公開read」を追加（writeはメール制限のまま）
              ↓
[朝 6:00 ルーティン ROUTINE.md]（1本・内部2段）
   Stage A（共有・1回・探索）: UNION(夫tags, 妻tags) で広く探索 → プール 8〜12本を執筆・タグ付け
   Stage B（人別・LLM不要・純粋スクリプト）:
        node scripts/curateForProfile.js <pool> profile.json      → issues/<TODAY>.json（夫・既存名）
        node scripts/curateForProfile.js <pool> profile.wife.json → issues/<TODAY>.wife.json（妻・新規）
        node scripts/writeManifest.js（夫）＋ writeManifest.wife（妻）
              ↓
[配信] GitHub Pages
   夫: issues/manifest.json         ← SRcockpit（変更なし）
   妻: issues/manifest.wife.json    ← yomimono（fetchIssues の1行変更）
              ↓
[夜 23:00 ルーティン TUNE.md]（1本・内部2回）
   Firestore REST で2コレクションを WebFetch（fav=true の url 収集）:
        juku-reservation / srcockpit_dailyMarks → 夫★URL
        juku-reservation / yomimono_marks       → 妻★URL
   node scripts/runTune.js <夫★> 14 --profile profile.json      → profile.json 並べ替え
   node scripts/runTune.js <妻★> 14 --profile profile.wife.json → profile.wife.json 並べ替え
   人ごとにログ・PR（chore(tune): 自動merge / タグ増減は proposal draft PR）
```

**このダイジェストの読者と教材方針・探索ジャンル・信頼度・執筆規約は ROUTINE.md / WRITING_GUIDE.md を継承する。本設計はそれらを上書きしない。**

---

## Phase 0：星源をループに繋ぐ（前提・人間ゲートで deploy）

### firestore.rules（編集）— **2リポジトリ同期が必須**

⚠️ juku-reservation は SRcockpit と同じ Firestore プロジェクトを共用し、**両リポジトリの `firestore.rules` を同期してからでないと deploy できない**（juku-reservation/firestore.rules:45-47 の警告）。したがって**同じ編集を2ファイルに適用**する：
- `C:\Users\ryuya\juku-reservation\firestore.rules`
- `C:\Users\ryuya\SRcockpit\firestore.rules`（同期対象・現物を Read して同じ2ブロックを直す）

現状はどちらのブロックも `allow read, write:` が1行で書かれている（juku側 line 89-92 と 103-107）。これを **read と write に分割**し、read だけ公開にする：

```javascript
// srcockpit_dailyMarks（現: read,write が1行のメール制限）→ 分割
match /srcockpit_dailyMarks/{document=**} {
  allow read: if true;                                  // ← 公開read（新）
  allow write: if request.auth != null                  // ← 既存の write 条件を維持
    && request.auth.token.email == 'r.sakuraguchi@oikaze-juku.com';
}

// yomimono_marks（現: read,write が1行のメール制限）→ 分割
match /yomimono_marks/{document=**} {
  allow read: if true;                                  // ← 公開read（新）
  allow write: if request.auth != null                  // ← 既存の write 条件を維持
    && (request.auth.token.email == 'rsoavxe2.msc@gmail.com'
      || request.auth.token.email == 'r.sakuraguchi@oikaze-juku.com');
}
```

- 保存データは記事URL・articleKey・fav/read（＋srcockpitは sent）・timestamp のみ＝**非PII**。cc-daily favorites と同じ公開読み取り姿勢。write は不変（メール制限のまま）。
- ⚠️トレードオフ：公開readで「どの開発記事を星したか」が公開APIキー経由で読める（機微度低）。抵抗があれば代替＝各アプリが cc-daily-897f4/favorites にミラー書き込み（改修増・本設計は非採用）。
- **deploy は本番操作＝人間ゲート。** 実装フェーズでは2ファイルの編集までで止め、`firebase deploy --only firestore:rules`（どちらか一方のリポジトリから・両者同期後）は塾長承認後に実行。

---

## Component 1：好みプロファイルを2つに

### profile.json（据え置き）
- 共有コンテキスト（owner / life_goal / stack / domains / pains）＋ **夫の `interest_tags`**。owner=桜口で既に夫寄り。**参照箇所を壊さないため rename しない。**

### profile.wife.json（新規）
- 共有コンテキストは profile.json を再掲せず、**妻に固有の最小情報＋ `interest_tags`** のみ持たせる（curate/tune が読むのは実質 `interest_tags`）。
- 初期シード（妻＝リアリングのデザイナー・広報／HP・SNS担当）：

```json
{
  "owner": "桜口さんの妻（株式会社リアリング デザイナー・広報／HP・Instagram @juku_oikaze 担当）",
  "note": "curate と tune が読むのは interest_tags のみ。共有文脈は profile.json 側。夜ループが実際の★で並べ替えて育てる。",
  "interest_tags": ["デザイン", "SNS運用", "Instagram", "Canva", "ノーコード", "LP・HP制作", "画像生成AI", "動画編集", "集客", "ブランディング", "AI活用", "業務効率化"]
}
```

- ⚠️このシードは仮。塾長・妻に後で微調整可（初期値であって、以降は tune が動かす）。

---

## Component 2：朝ルーティン（1本のまま・内部2段）

### Stage A（共有・探索＝高コスト部分を1回だけ）
- ROUTINE.md の探索・執筆を継承しつつ次を変更：
  - **興味の和集合で探索**：探索方針を `UNION(profile.json.interest_tags, profile.wife.json.interest_tags)` に広げる。妻のデザイン/SNS系ジャンル（Zenn/Qiita/note の非エンジニア向けAI活用・Canva・画像生成・SNS運用）も第1〜3段に含める。
  - **プールを増やす**：現行「5記事目標」→ **プール 8〜12本**を執筆・タグ付け（WebFetch 上限は現行8→**最大12**に緩和）。各記事は今まで通り title_ja / summary_ja / article / try_hint / tags / trust を持つ。
  - **タグ付けは和集合で**：ROUTINE.md 手順7の「profile.json の interest_tags で tags を付ける」を、`UNION(夫tags, 妻tags)` で付けるよう変更。これにより Stage B で夫profile・妻profileの**どちらのタグ重なりでもスコアできる**（片方のタグしか付かないと妻の号が空になる）。
  - この段の出力は「号」ではなく**候補プール** `issues/<TODAY>.pool.json`（同スキーマの items 配列を持つ中間ファイル）。
- ⚠️正直なコスト：妻ジャンルは今の探索に無いので**探索の幅は今日より広がる**（案A＝2回探索よりは安いが、現状より1回分広い）。

### Stage B（人別・LLM不要・純粋スクリプト＝ほぼ無料）
- 新規 `scripts/curateForProfile.js`：**純粋関数** `curateForProfile(pool, profile)` を中核に、プールの各記事を profile の `interest_tags` との**タグ重なりでスコアリング→上位を選抜・並べ替え**して「号」JSON（headline_top＋categories）を組む。
  - スコア：記事tagが interest_tags 上位にあるほど高い（既存 `scripts/scoreRepo.js` / `tuneProfile.js` のタグ重み付けの考え方を踏襲）。
  - 号の形（4ジャンル・official最下段・headlineは上段から）は ROUTINE.md の構造規約を満たすよう選抜する。プールにジャンルが足りなければ空カテゴリ許容。
  - **決定的**（同じ pool＋profile なら同じ号）。LLM を呼ばない。
- 朝ルーティンは Stage A の後にこれを2回呼ぶ：
  - `node scripts/curateForProfile.js issues/<TODAY>.pool.json profile.json      > issues/<TODAY>.json`
  - `node scripts/curateForProfile.js issues/<TODAY>.pool.json profile.wife.json > issues/<TODAY>.wife.json`
- manifest：
  - 既存 `scripts/writeManifest.js` は `issues/manifest.json`（夫・`*.json` から `*.pool.json` と `*.wife.json` を除外）。
  - 新規 `scripts/writeManifestWife.js`（or writeManifest に引数）で `issues/manifest.wife.json`（`*.wife.json` を対象）。

---

## Component 3：各アプリの読み先（最小改修）

- **yomimono**：[src/lib/daily/fetchIssues.ts](../../../../yomimono/src/lib/daily/fetchIssues.ts) の manifest 参照を `issues/manifest.wife.json` に変更（issue path は manifest 内で解決されるので1行）。静的エクスポートなので**再ビルド＋再デプロイが必要**（人間ゲート）。
- **SRcockpit**：変更なし（既存 `issues/manifest.json` ＝ 夫の号）。

---

## Component 4：夜ルーティン（1本のまま・内部2回）

### TUNE.md 手順の変更点
- 手順1「見る」の★取得を**2ソース**に：
  - `https://firestore.googleapis.com/v1/projects/juku-reservation/databases/(default)/documents/srcockpit_dailyMarks?key=<juku-reservation公開APIキー>&pageSize=300` → `fields.fav.booleanValue==true` の `fields.url.stringValue` を `fav-urls.husband.json` に。
  - 同 `.../documents/yomimono_marks?...` → `fav-urls.wife.json` に。
  - どちらも失敗したら空配列で続行（ベストエフォート）。
- 集計を人ごとに2回：
  - `node scripts/runTune.js fav-urls.husband.json 14 --profile profile.json`
  - `node scripts/runTune.js fav-urls.wife.json 14 --profile profile.wife.json`
  - `runTune.js` に `--profile <path>` オプションを追加（既定は `profile.json`＝後方互換）。読む issues は当面共有 manifest（夫）でよい（★率の分母は「提示記事」。将来 `--manifest` で人別に分離可）。
- 記録・PR規約（枠つき）は現行を人ごとに適用：
  - `chore(tune):` に profile.json / profile.wife.json の**並べ替えのみ**を入れて自動merge。
  - タグ増減は `proposal(profile):` draft PR（人ごとに分けてよい）。
  - `tuning_log.md` に人別セクション（夫／妻）で記録。`data/tune-state.jsonl` の行に `"who":"husband"|"wife"` を追加。
- サーキットブレーカー（手順5）は各ソース独立に判定（片方の Firestore 不通でもう片方は続行）。

### ★あなたの問い「二段階のルーティン登録が要るか」への回答
**新規ルーティン登録は不要。** 既存の朝6:00・夜23:00の**2本を内部で人別ステージに拡張するだけ**。探索は1回のまま。増える実体は主に：①`scripts/curateForProfile.js`（＋テスト）②`profile.wife.json` ③公開readルール ④`runTune.js` の `--profile` 対応 ⑤manifest.wife 生成 ⑥yomimono 1行、および ROUTINE.md / TUNE.md の手順追記。

---

## テスト方針

- `scripts/curateForProfile.js`：純粋関数 `curateForProfile(pool, profile)` の**ユニットテスト必須**（最低5ケース）：
  1. プール12本→profileの上位tagに合う号が決定的に選抜される。
  2. 夫profileと妻profileで**異なる選抜**になる（同一プールで並びが変わる）。
  3. official がプールにあっても headline_top に来ない・最下段1件に収まる。
  4. あるジャンルがプールに無ければ空カテゴリで壊れない。
  5. tag が空の記事・interest_tags に無い tag のみの記事の扱い（末尾 or 除外）が決定的。
- `runTune.js`：既存テストを維持しつつ `--profile` 経路のケースを追加（profile.wife.json を渡すと妻tagで集計される）。
- ルーティン本体（探索 Stage A・Firestore取得）は手動確認（エミュレータ or 実データで1回 dry-run）。

---

## 実装順（Phase）とファイル一覧

| # | フェーズ | 変更 | ゲート |
|---|---|---|---|
| 1 | プロファイル | `profile.wife.json` 新規（cc-daily） | コードのみ |
| 2 | 選抜スクリプト | `scripts/curateForProfile.js` ＋ `scripts/curateForProfile.test.js` 新規（cc-daily） | コードのみ |
| 3 | manifest 分離 | `scripts/writeManifest.js` 除外調整＋ `scripts/writeManifestWife.js`（cc-daily） | コードのみ |
| 4 | 夜集計 | `scripts/runTune.js` に `--profile` 追加＋テスト（cc-daily） | コードのみ |
| 5 | 朝手順 | `ROUTINE.md` に Stage A/B 追記（プール化・和集合探索・curate 2回） | コードのみ |
| 6 | 夜手順 | `TUNE.md` に2ソース取得・人別集計・人別ログを追記 | コードのみ |
| 7 | 妻読み先 | yomimono `fetchIssues.ts` を manifest.wife.json に（1行） | コード＋**再デプロイ人間ゲート** |
| 8 | ルール | juku-reservation `firestore.rules` に公開read追加 | 編集はコード／**deploy人間ゲート** |
| 9 | 反映 | rules deploy・yomimono 再ビルド/デプロイ・（必要なら）ルーティン手順の再登録 | **全て人間ゲート** |

**実装フェーズ（Sonnet/カセキ）は #1〜#8 のコード変更まで。#9 の本番反映（deploy・register）は塾長承認後に別途。**

---

## YAGNI（今回やらない）

- アプリ内「あなたへのおすすめ」レコメンドUI（表示層）は将来。今回は学習の器＝2プロファイルを育てるまで。
- cc-daily-897f4/favorites（ビューア直利用の星）はループから外す（実質未使用に）。
- 3人目対応：Stage B の curate と夜集計に profile を1つ足すだけで拡張できるよう、スクリプトは profile パスを引数化しておく（今回は2人分のみ）。
- ★率の分母を人別 manifest にする分離（当面は共有 manifest でよい。`--manifest` の余地だけ残す）。
