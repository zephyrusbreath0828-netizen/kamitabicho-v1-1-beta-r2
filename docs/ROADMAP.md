# 今後の拡張提案（v1.2 / v1.3 / v2.0）

v1.1 は「テストユーザーへ公開できるベータ版」です。以下は **既存データとの互換性を保ったまま**
追加できる拡張案です。データモデルはすべて「追加フィールドは optional」の原則で設計しています。

---

## 設計方針（拡張の前提）

1. **破壊的変更をしない** — 既存の `users` / `visits` / `goshuin` / `favorites` のフィールドは変更しない
2. **派生値は計算で出す** — 実績・達成率・ランキングは保存値ではなく、可能な限り集計で導出
3. **`schema_version` で判別** — マイグレーションが必要な変更はバージョンで識別
4. **マスタは差し替え可能** — `shrines` は Firestore の上書きマージで拡張（同梱データを壊さない）
5. **課金・通知は後付け** — Cloud Functions / FCM を追加してもクライアントの構造を変えない

---

## v1.2 — 祭神図鑑・神様カード収集（+1〜2か月）

### 目的
「参拝する動機」を強化する。御祭神を収集対象にすることで、神社巡りの楽しみを増やす。

### データ追加

```
deities/{deityId}
  name, kana, title, description, family, image_url,
  shrines: string[]        // 関連する神社ID
  tags: string[]           // 縁結び・厄除け・商売繁盛 など

users/{uid}
  deity_cards: map         // { deityId: 獲得日時 }
```

### 実装内容
- 神社詳細に「ご祭神カード」を表示（タップで図鑑へ）
- 参拝記録時に、その神社の御祭神カードを自動付与（`users.deity_cards`）
- 図鑑画面 `/deities`（未獲得はシルエット表示、コンプリート率）
- カード画像は Storage に配置（`deities/{deityId}.webp`）
- 実績追加: 「祭神カード 10種」「同一祭神の神社 3社」

### 互換性
既存の `visits` から「訪問済み神社 → 祭神」を再計算できるため、**過去分も自動で埋まります**。

---

## v1.3 — 巡拝印システム・ランキング（+2〜3か月）

### 目的
継続率の向上。巡拝印（スタンプ）とランキングで「続けたくなる」仕組みを作る。

### データ追加

```
stamps/{stampId}
  name, region, condition (神社数 / 都道府県 / 季節), threshold, image_url

users/{uid}
  stamps: map              // { stampId: 達成日時 }
  public_profile: boolean  // ランキング表示の可否（既定 false）

rankings/{period}          // period = "2026-10" など（Cloud Functions で集計）
  updated_at, entries: [{ uid, nickname, photo_url, shrines, goshuin }]
```

### 実装内容
- 巡拝印: 「東海道五十三次」「出雲路」「九州七福神」などの地域コース
- ランキング: 月間の参拝数 / 御朱印数 / 制覇数（**オプトイン制**、ニックネームのみ公開）
- Cloud Functions（`asia-northeast1`）で日次集計 → `rankings` に書き込み
- 実績の解放を Functions 側でも検証（チート対策）

### 互換性
`users.stamps` は追加フィールド。`public_profile` の既定値 `false` により、
既存ユーザーが意図せず公開されることはありません。

---

## v2.0 — AI レコメンド・巡礼ルート生成・全国コンプリート（+6か月〜）

### 目的
「次の一社」を提案し、巡礼を計画できるようにする。全国制覇の達成感を可視化する。

### データ追加

```
routes/{routeId}
  user_id, title, days, spots: [{ shrine_id, order, stay_minutes }],
  distance_km, created_at, source ("ai" | "manual")

users/{uid}
  preferences: { interests: string[], max_hours: number, transport: string }
  completed_prefectures: string[]   // 集計キャッシュ（visits から再計算可能）
```

### 実装内容
- **AI 神社レコメンド**: 参拝履歴・ご祭神・地域・季節から次の神社を提案
  （Vercel Functions から LLM API を呼び、`visits` の要約のみ送信。個人情報は送らない）
- **巡礼ルート生成**: 現在地と滞在可能時間から 2〜5社のルートを生成。
  Google Maps Directions API で移動時間を算出し、地図に描画
- **全国コンプリート**: 47都道府県の制覇状況を日本地図で可視化（SVG）
- ルートの保存・共有（`routes` コレクション、共有URLは読み取り専用トークン）
- 通知: 御朱印の記念日リマインド、近隣参拝時のサジェスト（FCM）

### 互換性
`routes` は新規コレクション、`preferences` は追加フィールド。
`completed_prefectures` はキャッシュであり、`visits` からいつでも再生成できます。

---

## 横断的な改善（優先度順）

| 優先 | 施策 | 理由 |
| --- | --- | --- |
| 高 | Cloud Functions で `visit_count` を集計 | 現状はクライアント加算のベストエフォート |
| 高 | App Check（reCAPTCHA Enterprise）導入 | 不正な書き込み・ scraping 対策 |
| 高 | 利用規約 / プライバシーポリシー / 問い合わせ導線 | ベータ公開の必須要件 |
| 中 | 管理画面（神社マスタ編集・通報対応） | 電話番号・URL の整備に必要 |
| 中 | E2E テスト（Playwright）の CI 組み込み | デモログイン等の回帰防止 |
| 中 | Cloudinary の変換パラメータ活用（`f_auto,q_auto`）と孤立画像の定期削除 | 転送量削減・無料枠の保護 |
| 低 | 多言語化（英語・繁体字） | インバウンド需要 |
| 低 | ウィジェット（今日の一社） | 再訪率の向上 |

---

## データ移行の考え方（将来）

- 追加フィールドはすべて optional のため、**既存ユーザーの一括移行は不要**
- 計算で導出できる値（達成率・実績・制覇数）は保存せず、読み取り時に算出
- 保存が必要な値（スタンプ・カード）は「初回アクセス時に遡って付与」する方式を採用
  （`visits` が真実のソースであるため、後からでも復元可能）
