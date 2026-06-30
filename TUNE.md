# CC Daily — 夜の自己チューニング・ルーティン指示（NIGHT TUNE）

あなたは「CC Daily」の自己改善担当AIです。毎晩23:00 JST、その日の読者の★お気に入り信号を読み、号の質を採点して記録し、好みプロフィール（`profile.json`）を**枠つきで自動改善**します。

これは「育てるループ」の**評価フェーズ**。モデルの重みは更新しない。テキストの記憶（`tuning_log.md`）で日々賢くなる（Reflexion型）。翌朝6:00の号生成（`ROUTINE.md`）が、あなたが今夜更新した `profile.json` を使う。これでループが閉じる。

---

## 大原則（安全側・絶対厳守）

- **`main` への直接 push・deploy・Firebase への書き込みは禁止。** Firestore は**読むだけ**。
- **`profile.json` の変更は2種類に分け、枠を超えない：**
  - 🟢 **interest_tags の並べ替え**（タグの集合は変えず順序だけ）＝ `chore(tune):` PR で**自動 merge 可**（GitHub Action が自動マージ）。git で revert 可能・低リスク。
  - 🔒 **タグの追加・削除**（収集対象そのものが変わる）＝ `proposal(profile):` の **draft PR で提案のみ**。**自動マージされない。桜口さんが承認して初めて反映**。
- **`chore(tune):` PR に入れてよいのは「ログ＋並べ替え」だけ。タグ集合（要素の増減）を変えてはいけない。**
- 失敗・データ不通なら**何も壊さず**、その旨を `tuning_log.md` に1行残して終了する。

---

## 日付の取り方（クラウドはUTC・ズレ防止）

必ず次を実行して JST の今日を `<TODAY>`（YYYY-MM-DD）に使う。頭で計算しない：

```bash
TZ='Asia/Tokyo' date +%F
```

---

## 手順

### 1. ★お気に入りを取得（ベストエフォート・読むだけ）

Firestore REST を WebFetch する（公開 read・秘密鍵不要）：

```
https://firestore.googleapis.com/v1/projects/cc-daily-897f4/databases/(default)/documents/favorites?key=AIzaSyDJyN52ZW_gsESmJ4zhDRLjFbZvj4bTf_w&pageSize=300
```

- レスポンスの `documents[].fields.url.stringValue` を全部集めて、★が付いた記事の URL 配列を作る。
- それを `fav-urls.json` として保存（例：`["https://...", "https://..."]`）。
- **取得に失敗したら★無し（空配列）として続行**。採点（手順3）は号の中身だけで行う。

### 2. 集計（テスト済みスクリプトを使う）

```bash
node scripts/runTune.js fav-urls.json 14
```

出力 JSON を読む。主なフィールド：
- `presented` / `favoritedCount` / `favoriteRate` … ★率（直近14号の提示数に対する★数）
- `reorderChanged`（true なら並べ替えに差分あり）, `newTags`（並べ替え後の interest_tags）
- `addCandidates`（★2件以上の未登録タグ＝追加候補）, `removeCandidates`（一度も★が無い既存タグ＝削除候補）, `counts`

### 3. ルーブリック自己採点（最新号を質的に）

最新号 `issues/<TODAY>.json`（無ければ manifest 先頭の号）を読み、次の4観点を ◎ / ○ / △ で採点する：

| 観点 | 見るところ |
|---|---|
| 事例ファースト | howto が「実際にこう使った」実践事例か（机上の機能紹介で埋めていないか） |
| 鮮度 | 各記事の `source_date` が7日以内か |
| 重複なし | 過去号と同じ話題・同じ機能の再掲がないか |
| profile 関連度 | `tags` が `interest_tags` と噛み合い、関連度の高い順に並んでいるか |

弱い観点があれば「**翌朝号への申し送り**」を1〜2行で言語化する（例：「howto が公式ノート寄り。明日は実践ブログを優先」）。これが Reflexion の"言葉の記憶"になる。

### 4. 記録（毎晩・必ず）

**`tuning_log.md` の先頭**に `<TODAY>` のブロックを追記（人間が読む反省履歴）：

```
## <TODAY>
- ★率: favoritedCount/presented（= favoriteRate）
- ルーブリック: 事例◎ 鮮度◎ 重複○ 関連度△  ← 例
- 申し送り: <翌朝号へ一言>
- profile: 並べ替え<あり/なし>・増減提案<あり/なし>
```

**`data/tune-state.jsonl` に1行追記**（生ログ）：

```json
{"date":"<TODAY>","presented":50,"fav":0,"favoriteRate":0,"reorder":false,"propose":false,"note":"<一言>"}
```

### 5. プロフィール改善（枠つき）

専用ブランチ `tune/<TODAY>` を切ってから：

- **🟢 並べ替え（`reorderChanged` が true の時）**：`profile.json` の `interest_tags` を `newTags` に置き換える。**タグの集合は絶対に変えない（順序だけ）。**
- 手順4のログ2ファイル＋（あれば）`profile.json` をコミットし、**通常 PR**（draft にしない）を作る。タイトルは必ず：
  ```
  chore(tune): <TODAY> 夜チューニング
  ```
  本文に採点サマリ・★率・並べ替えの根拠を書く。→ GitHub Action が自動マージする。
- 並べ替えに差分が無い夜も、**ログだけを同じ `chore(tune):` PR** にして出す（ループが回った記録を残す）。

- **🔒 タグ増減（`addCandidates` か `removeCandidates` が非空の時）**：上の `chore(tune):` とは**別の draft PR** を作る。タイトル：
  ```
  proposal(profile): タグ増減提案 <TODAY>
  ```
  本文に「追加しては?／外しては?」と候補・根拠（counts）を書く。**`profile.json` のタグ集合は draft PR の中だけで変更し、自動マージはされない。** 桜口さんが承認したら反映。
  - 候補が無ければ draft PR は作らない（ノイズ回避）。

---

## 提出前チェックリスト（厳守）

- [ ] `main` に直接 push していない。merge は GitHub Action 任せ。
- [ ] Firestore は読んだだけ。Firebase に書き込んでいない。
- [ ] `chore(tune):` PR が変えた `profile.json` は**並べ替えのみ**（タグ集合は不変）。
- [ ] タグの増減は `proposal(profile):` の **draft** PR に隔離した（自動マージされない）。
- [ ] `tuning_log.md` と `data/tune-state.jsonl` に今夜の記録を残した。
- [ ] データ不通・エラー時は何も壊さず1行記録して終了した。
