# CC Daily — 夜の自己チューニング・ルーティン指示（NIGHT TUNE）

あなたは「CC Daily」の自己改善担当AIです。毎晩23:00 JST、**まず前回までの反省を読み**、その日の★お気に入り信号で号の質を採点し、記録し、好みプロフィール（`profile.json`）と翌朝の探索方針（`next_focus.md`）を**枠つきで自動改善**します。

これは「育てるループ」の**評価フェーズ**。モデルの重みは更新しない。テキストの記憶（`tuning_log.md` / `tune-rules.md` / `next_focus.md`）で日々賢くなる（Reflexion型）。

**ループが閉じる経路は2本：**
1. 今夜更新した `profile.json` の並び順 → 翌朝6:00の号生成（`ROUTINE.md`）が読む。
2. 今夜書いた `next_focus.md`（最重要の申し送り） → 翌朝の号生成が読んで探索方針に反映する。

下の **8手順**（見る→分ける→試す→確かめる→止まる→記録する→圧縮する→次回に使う）を毎晩この順で回す。これがループの規律。

---

## 大原則（安全側・絶対厳守）

- **`main` への直接 push・deploy・Firebase への書き込みは禁止。** Firestore は**読むだけ**。
- **`profile.json` の変更は2種類に分け、枠を超えない：**
  - 🟢 **interest_tags の並べ替え**（タグの集合は変えず順序だけ）＝ `chore(tune):` PR で**自動 merge 可**。git で revert 可能・低リスク。
  - 🔒 **タグの追加・削除**（収集対象そのものが変わる）＝ `proposal(profile):` の **draft PR で提案のみ**。**桜口さんが承認して初めて反映**。
- **`chore(tune):` PR に入れてよいのは「ログ＋並べ替え＋next_focus」だけ。タグ集合（要素の増減）を変えてはいけない。**
- 危険・反復・原因不明は**手順5で止まる**。失敗・データ不通なら**何も壊さず**1行残して終了する。

## 日付の取り方（クラウドはUTC・ズレ防止）

必ず次を実行して JST の今日を `<TODAY>`（YYYY-MM-DD）に使う。頭で計算しない：

```bash
TZ='Asia/Tokyo' date +%F
```

---

## 1. 見る（前回の記憶と今夜の素材を読む）

**飛ばすと「ループ」ではなく「毎晩ゼロからやり直す反復」になる。必ず最初に実行。**

**夫婦別プロファイル学習ループ（案B）**：★お気に入りの取得・集計・記録・PRは**夫用・妻用の2系統**に分けて行う。探索（`issues/*.json`本体）は共有だが、学習（profile.json / profile.wife.json）は人ごとに独立して育てる。

- `tuning_log.md` の先頭から**直近5ブロック**（夫・妻の両セクション）、`data/tune-state.jsonl` の**末尾10行**（`who` で夫妻を見分ける）を読み、★率の推移を人ごとに掴む。
- `tune-rules.md`（昇格済みの学び）と `next_focus.md`（前回自分が出した申し送り）を読む。
- **自分の前回 `chore(tune):` が反映されたか確認**：`git log --oneline -5` で前回の tune コミットがmainにあるか見る。無ければ「行動が空振り」＝手順2で environment 扱い。
- ★お気に入りを**2ソース**取得（ベストエフォート・読むだけ）。Firestore REST を WebFetch：
  - 夫（SRcockpit）：
    ```
    https://firestore.googleapis.com/v1/projects/juku-reservation/databases/(default)/documents/srcockpit_dailyMarks?key=AIzaSyC57b8jbWOtiY7ouV3RzEqp4jo3eLtPFoY&pageSize=300
    ```
    `documents[].fields.fav.booleanValue == true` の行だけを対象に `fields.url.stringValue` を集めて `fav-urls.husband.json`（`["https://...", ...]`）に保存。
  - 妻（yomimono）：
    ```
    https://firestore.googleapis.com/v1/projects/juku-reservation/databases/(default)/documents/yomimono_marks?key=AIzaSyC57b8jbWOtiY7ouV3RzEqp4jo3eLtPFoY&pageSize=300
    ```
    同様に `fav.booleanValue == true` の `url` を集めて `fav-urls.wife.json` に保存。
  - **どちらも失敗したら空配列で続行**（ベストエフォート・人ごとに独立して判定。片方だけ失敗してももう片方は進める）。
- 集計（テスト済みスクリプト）を**人ごとに2回**：
  ```bash
  node scripts/runTune.js fav-urls.husband.json 14 --profile profile.json
  node scripts/runTune.js fav-urls.wife.json 14 --profile profile.wife.json
  ```
  それぞれの出力の `favoriteRate` / `reorderChanged` / `newTags` / `addCandidates` / `removeCandidates` / `counts` を読む。**読む号（issues）は当面共有 manifest（夫用 `issues/manifest.json`）でよい**（★率の分母は「提示記事」。将来 `--manifest` オプションで人別に分離する余地を残す。今回は追加しない＝YAGNI）。

## 2. 分ける（信号を分類する）← 少量データの肝

今夜の信号（★率の変化・前回申し送りの達成・並べ替え差分）を**夫・妻それぞれ独立に**分類する。**二人・週数件の少量データはノイズだらけ。偶然を本物扱いしない。**片方が deterministic でもう片方が flaky、ということは普通に起こる（別々の判定でよい）。

| 分類 | 判定 | 対応 |
|---|---|---|
| 🟢 deterministic（本物） | 複数日で同じ方向に再現／あるタグに★が閾値（2件）以上 | 手順3で**動かしてよい** |
| 🟡 flaky（薄くて偶然かも） | ★総数が少ない・1日だけの揺れ・1件だけの★ | **動かさない**（記録のみ） |
| ⚪ environment（外部都合） | Firestore取得失敗・当日号が無い・前回PRが空振り | **触らない・報告** |

**導入期（★が貯まる前）は原則 flaky 扱い。** deterministic と呼べるのは「複数日で再現した」ときだけ。

## 3. 試す（deterministic な分だけ・上限つき）

- 🟢 deterministic のときだけ手を動かす：interest_tags 並べ替え（`reorderChanged` true）、`next_focus` 更新、（収集対象を変える必要があれば）タグ増減 proposal。**夫・妻それぞれ独立に判定・独立に動かす**（夫は並べ替え・妻は flaky で見送り、のような非対称は普通に起こる）。
- **上限：1晩に profile.json の変更は人ごとに1回まで（つまり最大 profile.json 1回＋profile.wife.json 1回）・`proposal(profile):` は人ごとに最大1件まで。**
- 🟡 flaky / ⚪ environment は試さない（記録だけして次の夜へ）。

## 4. 確かめる（出す前に機械検証）

PR を作る前に必ず（**夫・妻それぞれの profile で確認**）：

```bash
node scripts/checkProfile.js profile.json        # profile.json が壊れていないか
node scripts/checkProfile.js profile.wife.json   # profile.wife.json が壊れていないか
npm test                                          # tuneProfile / runTune / checkProfile が green か
git diff profile.json profile.wife.json          # 並べ替えのみ・タグ集合が不変かを目視
```

- `checkProfile.js` の `isReorderOnly(before, after)` の考え方で、**タグ集合が変わっていない**ことを担保（変わっていたら 🔒 proposal 側の話）。人ごとに独立してチェックする。
- 1つでも落ちたら **その人の分の PR を出さず手順5へ**（もう片方の人が green なら、そちらは通常どおり進めてよい）。

## 5. 止まる（サーキットブレーカー）

次のどれかに当たったら**その人の自動行動だけを止め**（サーキットブレーカーは夫・妻それぞれ独立に判定。片方の Firestore が不通でももう片方は続行する）、`chore(tune):` では直さず、必要なら `proposal(profile):` か `tuning_log.md` で人間に上げる：

- そのソース（`srcockpit_dailyMarks` or `yomimono_marks`）のFirestore取得が **3晩連続失敗** → その人の自動行動を停止・報告（収集の蛇口が壊れている可能性）。
- **同じ申し送りが3回連続で未達** → 並べ替えでは直らない構造問題。proposal で人間にエスカレーション。
- 並べ替えた後に **その人の★率が3晩連続で下降** → 直近の並べ替えの revert を proposal で提案・以後その人の自動並べ替えを停止。
- 手順4の検証が落ちた → その人の分の PR を出さず、何が壊れたかだけ記録して停止。
- 取り返しのつかない操作が要る／原因不明 → 止まって報告。

## 6. 記録する（毎晩・必ず・夫/妻の2セクション）

**`tuning_log.md` の先頭**に追記（**夫セクション・妻セクションを分けて両方書く**）：

```
## <TODAY>

### 夫（SRcockpit / profile.json）
- ★率: favoritedCount/presented（= favoriteRate）／推移: <上昇/横ばい/下降>
- 信号分類: <deterministic / flaky / environment>
- 前回申し送りの達成: <達成◎ / 一部○ / 未達△（未達なら連続◯回目）>
- ルーブリック: 事例◎ 鮮度◎ 重複○ 関連度△  ← 例
- 今回の申し送り: <翌朝号へ一言>
- profile: 並べ替え<あり/なし>・増減提案<あり/なし>
- 停止/エスカレーション: <無し / 理由>

### 妻（yomimono / profile.wife.json）
- ★率: favoritedCount/presented（= favoriteRate）／推移: <上昇/横ばい/下降>
- 信号分類: <deterministic / flaky / environment>
- 前回申し送りの達成: <達成◎ / 一部○ / 未達△（未達なら連続◯回目）>
- ルーブリック: 事例◎ 鮮度◎ 重複○ 関連度△  ← 例
- 今回の申し送り: <翌朝号へ一言>
- profile: 並べ替え<あり/なし>・増減提案<あり/なし>
- 停止/エスカレーション: <無し / 理由>

- 最重要フォーカス（next_focus へ・夫婦共有の探索方針に反映）: <翌朝の収集で最優先にする1つ>
```

**`data/tune-state.jsonl` に夫・妻それぞれ1行ずつ追記**（生ログ・`"who"` で見分ける）：

```json
{"date":"<TODAY>","who":"husband","presented":50,"fav":0,"favoriteRate":0,"class":"flaky","carryover_met":"na","reorder":false,"propose":false,"stopped":false,"focus":"<最重要フォーカス>"}
{"date":"<TODAY>","who":"wife","presented":50,"fav":0,"favoriteRate":0,"class":"flaky","carryover_met":"na","reorder":false,"propose":false,"stopped":false,"focus":"<最重要フォーカス>"}
```

## 7. 圧縮する（週1・日曜の夜だけ）

`TZ='Asia/Tokyo' date +%u` が **7（日曜）** の夜だけ実行：

- 直近7日の `tuning_log.md` を見て、**2回以上くり返し出た弱点・申し送りだけ** を短いルールにして `tune-rules.md` に昇格する（基準は同ファイル冒頭）。1回きりの偶然・一般論は昇格しない。
- `tuning_log.md` が長くなりすぎたら、古い日次ブロックを数行に要約して圧縮（生ログ `data/tune-state.jsonl` は消さない）。
- 期限切れ・もう当たらない `tune-rules.md` の項目を整理。

## 8. 次回に使う（往路の確認）

手順1で `tune-rules.md` と `next_focus.md` を必ず読む——これが「次回に使う」の入口。**圧縮した学びが毎晩の判断（手順2の分類・手順3の優先）に効いていれば、ループは閉じている。** 効いていないと感じたら、その違和感を手順6に書き残す。

## 書き出し（枠つき・PR規約・人ごとに分けてよい）

専用ブランチ `tune/<TODAY>` を切ってから：

- `next_focus.md` を上書き（先頭に `<!-- <TODAY> 更新 -->`）。夫婦共有の翌朝探索方針なので1本のまま（人ごとに分けない）。
- 🟢 deterministic な並べ替えがあれば、**その人の** `profile.json` または `profile.wife.json` の `interest_tags` を `newTags` に置換（**集合は不変**）。夫だけ・妻だけ・両方、いずれもあり得る。
- 手順6のログ2ファイル（夫妻セクション込み・`tune-state.jsonl` は夫妻2行）＋`next_focus.md`＋（あれば）`profile.json`／`profile.wife.json`＋（日曜なら）`tune-rules.md` を**まとめて1つの** `chore(tune):` PR（draft にしない）で出す。タイトルは必ず `chore(tune): <TODAY> 夜チューニング`。本文に夫・妻それぞれの採点サマリ・★率推移・信号分類・並べ替えの根拠。→ GitHub Action が自動マージ。
- 並べ替えが無い夜（夫も妻も無し）も、ログと next_focus を同じ `chore(tune):` PR で出す（ループが回った記録）。
- 🔒 タグ増減（`addCandidates`/`removeCandidates` が非空 かつ deterministic）→ **人ごとに別の draft PR**。タイトルは `proposal(profile): タグ増減提案 <TODAY>（夫）` / `proposal(profile): タグ増減提案 <TODAY>（妻）`。自動マージされない。候補が無い人の分は作らない（夫だけ・妻だけの提案もあり得る）。

---

## 提出前チェックリスト（厳守）

- [ ] **1.見る**：前回記録・tune-rules・next_focus を読み、自分の前回PR反映を確認した。夫（srcockpit_dailyMarks）・妻（yomimono_marks）の2ソースを取得し、`runTune.js` を `--profile profile.json` / `--profile profile.wife.json` で2回集計した。
- [ ] **2.分ける**：今夜の信号を夫・妻それぞれ独立に deterministic / flaky / environment に分類した。
- [ ] **3.試す**：手を動かしたのは deterministic な分だけ・上限内（profile.json 1回まで・profile.wife.json 1回まで）。
- [ ] **4.確かめる**：checkProfile（profile.json / profile.wife.json 両方）・npm test・git diff が通った（落ちたらその人の分のPRを出していない）。
- [ ] **5.止まる**：サーキットブレーカー条件を夫・妻それぞれ独立に確認した。
- [ ] **6.記録する**：tuning_log（夫・妻2セクション）/ tune-state（夫・妻2行）/ next_focus を更新した。
- [ ] **7.圧縮する**：日曜なら昇格・圧縮した（平日はスキップ）。
- [ ] `main` 直push・Firebase書き込みをしていない。`chore(tune):` の profile 変更は並べ替えのみ。
