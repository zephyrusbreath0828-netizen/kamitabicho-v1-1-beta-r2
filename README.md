# 神旅帳（Kamitabicho）v1.1 — 全国の神社巡礼アプリ

全国 **47都道府県・100社** の神社をめぐり、GPS 参拝記録・御朱印・参拝実績を一冊にまとめる PWA です。
v1.1 は **テストユーザーへ公開できるベータ版** として、Google 認証・Firestore・Cloudinary・PWA・データ移行を実装しています。

- 技術構成: **Next.js 15（App Router） / React 19 / TypeScript / Tailwind CSS v4 / Firebase v12**
- データ: **Cloud Firestore**（ユーザー・参拝記録・御朱印メタ情報）
- 画像: **Cloudinary**（御朱印写真・プロフィール画像）※ **Firebase Storage は使用しません**
- ホスティング: **Vercel**（`hnd1` = 東京リージョン）
- PWA: `manifest.webmanifest` + Service Worker + オフラインページ（インストール可能）
- デモモード: Firebase 未設定でも全機能を端末内（localStorage）で試せます

---

## 1. クイックスタート（Firebase なしで確認）

```bash
npm install
cp .env.local.example .env.local   # 値は空のままでOK（デモモードで起動）
npm run dev                        # http://localhost:3000
```

1. 「デモモードで試す（登録不要）」を押す
2. ホーム画面へ自動遷移します（v1.1 で修正済み）
3. 神社詳細 → 「動作確認用：この神社の位置を現在地にする」→「参拝記録を登録」で
   GPS チェックインを実機なしで確認できます

> デモモードでは画像を Cloudinary に送らず、端末内（data URL）に保存します。
> Cloudinary の設定確認は、Firebase 接続後に Google ログインして行ってください。
> 本番ビルドの確認は `npm run build && npm run start`。

---

## 2. 環境変数

`.env.local.example` をコピーして設定します。

### 必須

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API キー |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | プロジェクトID |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 送信者ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | アプリID |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary のクラウド名 |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | 署名なし（Unsigned）アップロードプリセット名 |

### 任意

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | — | **未使用**。Firebase の構成情報に含まれる場合のみ貼り付け |
| `NEXT_PUBLIC_CLOUDINARY_FOLDER` | `kamitabicho` | 画像の保存フォルダ接頭辞 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | — | 未設定なら OpenStreetMap の簡易地図で動作 |
| `NEXT_PUBLIC_ENABLE_DEMO` | `true` | `false` でデモボタンを非表示 |
| `NEXT_PUBLIC_ENABLE_DEMO_TOOLS` | 自動 | テスト位置設定ツールの表示制御 |

Firebase の3項目（APIキー・プロジェクトID・アプリID）が揃うと Firebase モードで起動します。
揃っていない場合は自動的にデモモードになります。
Cloudinary の2項目が未設定の場合、画像アップロードは実行時にエラーメッセージを表示します（アプリ自体は起動します）。

---

## 3. Firebase の設定

詳細は **[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)** を参照してください。要約:

1. Firebase プロジェクト作成 → ウェブアプリ追加 → 構成情報を `.env.local` に貼り付け
2. **Authentication** → Google を有効化 → 承認済みドメインに `localhost` と Vercel ドメインを追加
3. **Firestore** → データベース作成（`asia-northeast1`）→ `firestore.rules` をデプロイ
4. 神社マスタ投入: `npm run seed`（サービスアカウント鍵が必要）

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # プロジェクトを選択
firebase deploy --only firestore:rules,firestore:indexes
npm run seed                  # 100社を投入（初回のみ）
```

> **Cloud Storage は作成・設定不要です。** 画像はすべて Cloudinary に保存します（次章）。

---

## 4. Cloudinary の設定（画像アップロード）

御朱印写真とプロフィール画像は **Cloudinary の署名なしアップロード**で保存し、
**返却された `secure_url` だけを Firestore に保存**します。
API Secret はブラウザに置かないため、`unsigned` プリセットを使用します。

### 4-1. アカウントとクラウド名

1. https://cloudinary.com/users/register_free で無料登録（クレジットカード不要）
2. ログイン後 **Dashboard** を開く
3. **Cloud name**（例 `dxxxxxxyy`）を控える

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dxxxxxxyy
```

### 4-2. 署名なしアップロードプリセットの作成

1. 左メニュー **Settings（歯車）** → **Upload** タブ
2. 下へスクロールし **Upload presets** → **Add upload preset**
3. 以下を設定して保存

| 項目 | 値 | 理由 |
| --- | --- | --- |
| **Preset name** | `kamitabicho_unsigned` | 環境変数に入れる名前 |
| **Signing Mode** | **Unsigned** ← 必須 | ブラウザから直接アップロードするため |
| **Folder** | `kamitabicho`（任意） | 保存先の接頭辞。アプリからも `folder` を送信 |
| **Unique filename** | On（既定） | URL の衝突を防ぐ |
| **Use filename or externally provided filename** | Off | 元ファイル名を公開しない |
| **Overwrite** | Off | 既存画像を壊さない |
| **Allowed formats** | `jpg,png,webp,heic,heif` | 受け付ける形式を限定 |
| **Max file size** | `8000000`（8MB） | アプリ側の上限と一致させる |
| **Quality / format** | `auto` | 自動で最適化（`f_auto,q_auto`） |
| **Access control / Delivery type** | `upload`（public） | 表示用URLをそのまま `<img>` で使うため |

> **`Signing Mode` が `Signed` のままだとアップロードは必ず失敗します。**
> その場合アプリは「プリセットが Unsigned になっていません」というエラーを表示します。

4. 作成したら、プリセット名を環境変数へ

```bash
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=kamitabicho_unsigned
```

### 4-3. 保存パス（自動で決まります）

```
kamitabicho/goshuin/{uid}/<ランダム名>.jpg   御朱印写真
kamitabicho/avatars/{uid}/<ランダム名>.jpg   プロフィール画像
```

`uid` をフォルダに含めることで、どのユーザーの画像かを Cloudinary 側でも判別できます。
`NEXT_PUBLIC_CLOUDINARY_FOLDER` を変えると先頭の `kamitabicho` 部分が変わります。

### 4-4. アップロード前の自動処理（アプリ側）

| 種類 | 長辺 | JPEG品質 | 目安 |
| --- | --- | --- | --- |
| 御朱印 | 1600px | 0.85 | 300〜600KB |
| プロフィール | 400px | 0.82 | 20〜60KB |

スマートフォンの写真（5〜8MB）をそのまま送らず、Canvas で縮小してから送信します。
これによりアップロード時間・転送量・Cloudinary のクレジット消費を抑えます。

### 4-5. 環境変数の反映

```bash
# ローカル
# .env.local を編集後、開発サーバーを再起動（NEXT_PUBLIC_* はビルド時に埋め込まれる）

# Vercel
vercel env add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
vercel env add NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
vercel env add NEXT_PUBLIC_CLOUDINARY_FOLDER
vercel --prod
```

> `NEXT_PUBLIC_*` は **ビルド時に確定**します。値を変えたら必ず再デプロイしてください。

### 4-6. 動作確認

1. Google ログイン → 御朱印帳 → 「御朱印を追加する」
2. 写真を選び「御朱印帳に保存する」
3. Cloudinary の **Media Library** に `kamitabicho/goshuin/<uid>/` ができていること
4. Firestore の `goshuin` ドキュメントの `image_url` が
   `https://res.cloudinary.com/...` になっていること（**URLのみ保存**）

### 4-7. アップロード失敗時の表示

失敗すると画面に日本語のエラーメッセージを表示し、**Firestore には何も書き込みません**。

| 状況 | 表示されるメッセージ |
| --- | --- |
| 環境変数が未設定 | 画像アップロードの設定が完了していません。管理者にご連絡ください |
| プリセット名が誤り | アップロードプリセットが見つかりません |
| プリセットが Signed | プリセットが「Unsigned」になっていません |
| 8MB超過・形式不正 | 画像サイズが大きすぎます／対応していない画像形式です |
| 権限エラー（401/403） | 画像をアップロードする権限がありません |
| レート制限（429） | アップロードが集中しています。時間をおいてお試しください |
| サーバーエラー（5xx） | 画像サーバーでエラーが発生しました |
| 通信断・タイムアウト | 通信環境をご確認のうえ、もう一度お試しください |

### 4-8. 運用上の注意

- **無料枠**: 月 25 credits（およそ 25,000 回の画像変換 + 25GB の帯域が目安）。ベータ規模では十分
- **画像の削除**: クライアントからは削除できません。御朱印を削除しても Cloudinary 側の画像は残ります
  （孤立画像は Media Library で定期的に整理してください。将来は管理ジョブで自動削除）
- **公開範囲**: `upload` タイプは URL を知っていれば閲覧可能です。URL は推測困難なランダム名になりますが、
  厳密な非公開が必要な場合は Signed URL 配信（`type: authenticated`）への切り替えを検討してください
- **API Secret は使用しません**。`.env.local` にも書かないでください

---

## 5. Vercel へのデプロイ

```bash
npm i -g vercel
vercel link
# 環境変数を登録（Production / Preview / Development すべて）
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
# … Firebase 5項目 + Cloudinary 2項目を登録 …
vercel --prod
```

ダッシュボードから行う場合は **Settings → Environment Variables** に上表の値を登録し、
GitHub リポジトリを接続して `main` ブランチをデプロイしてください。

デプロイ後にやること:

1. Firebase コンソール → Authentication → Settings → **承認済みドメイン** に
   `xxxx.vercel.app`（および独自ドメイン）を追加
2. 実機で Google ログイン → 参拝記録 → 御朱印（Cloudinary へ保存）→ PWA インストールを確認
3. `docs/VERIFICATION.md` のチェックリストを実施

---

## 6. ディレクトリ構成

```
.
├── public/
│   ├── icons/                  PWA アイコン（192 / 512 / maskable / apple-touch）
│   ├── images/                 神社画像（共通素材6種）
│   ├── sample/                 デモ用の御朱印画像
│   ├── manifest.webmanifest    PWA マニフェスト
│   ├── sw.js                   Service Worker（v1.1）
│   └── offline.html            オフラインページ
├── src/
│   ├── app/                    画面（App Router）
│   │   ├── login/              ログイン
│   │   ├── page.tsx            ホーム（最近の参拝 / お気に入り / 近くの神社）
│   │   ├── shrines/            神社一覧・詳細
│   │   ├── goshuin/            御朱印帳・新規登録
│   │   ├── mypage/             マイページ（達成率・実績・履歴）
│   │   ├── achievements/       参拝実績
│   │   ├── favorites/          お気に入り
│   │   └── profile/            プロフィール設定
│   ├── components/             UI コンポーネント
│   ├── data/shrines.json       神社マスタ（100社）
│   └── lib/
│       ├── app-context.tsx     認証・データ・実績の状態管理
│       ├── backend.ts          バックエンド選択（Firebase / デモ）
│       ├── backend-firebase.ts Firestore 実装（Auth / 移行）
│       ├── backend-demo.ts     デモ実装（localStorage）
│       ├── cloudinary.ts       Cloudinary アップロード・エラー変換
│       ├── achievements.ts     実績の純粋関数
│       ├── legacy.ts           v1.0 データの読み取り・移行フラグ
│       ├── geo.ts              300m 判定（ヘヴァサイン公式）
│       └── types.ts            ドメイン型
├── scripts/
│   ├── seed-shrines.mjs        神社マスタ投入
│   └── migrate-legacy.mjs      旧 visit_history の一括移行（管理者用）
├── docs/
│   ├── FIREBASE_SETUP.md       Firebase 設定手順書
│   ├── BUGFIXES.md             不具合修正内容一覧
│   ├── VERIFICATION.md         品質確認手順・結果
│   └── ROADMAP.md              今後の拡張提案（v1.2 / v1.3 / v2.0）
├── firestore.rules
├── firestore.indexes.json
└── next.config.ts              セキュリティヘッダー / PWA ヘッダー / 画像ドメイン
```

> `storage.rules` は **ありません**（Firebase Storage 未使用）。

---

## 7. データモデル

### users/{uid}

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `uid` | string | Firebase Auth の UID |
| `nickname` | string | 表示名（最大24文字） |
| `photo_url` | string \| null | **Cloudinary の URL** / Google の photoURL |
| `created_at` | string | ISO 8601 |
| `updated_at` | string | ISO 8601 |
| `achievements` | map | `{ 実績ID: 達成日時 }` |
| `migration` | map | 移行履歴（二重移行防止） |
| `schema_version` | number | 現在 `2` |

### visits/{visitId}

`user_id` / `shrine_id` / `visit_datetime` / `latitude` / `longitude` / `distance_m` / `created_at`
（`distance_m <= 300` をセキュリティルールでも強制）

### goshuin/{goshuinId}

`user_id` / `shrine_id` / **`image_url`（Cloudinary の URL のみ）** / `memo`（300文字）/ `created_at` / `visited_date`

> **画像データそのものは Firestore に保存しません。** 保存するのは Cloudinary が返した URL だけです。

### favorites/{uid_shrineId}

`user_id` / `shrine_id` / `created_at`（ドキュメントIDが `uid_shrineId` のため重複登録不可）

### shrines/{shrineId}

`name` / `prefecture` / `address` / `latitude` / `longitude` / `main_deity` / `description` /
`image_url` / `visit_count` / `phone` / `url`

> **神社マスタの拡充**: `phone` / `url` は初期状態では未設定です。
> `npm run seed` は merge 書き込みのため、Firestore 側で追記しても再シードで上書きされません。

---

## 8. v1.0 からのデータ移行

初回 Google ログイン時に **自動** で実行されます（冪等・二重移行なし）。

| 移行元 | 移行先 | 内容 |
| --- | --- | --- |
| localStorage `kamitabicho:demo:v1` / `v2` | Firestore | 参拝履歴・御朱印・ニックネーム |
| Firestore `visit_history`（v1.0） | `visits` | 参拝履歴（コピーのみ／旧データは残す） |
| `goshuin.photo_url`（v1.0） | `goshuin.image_url` | フィールド名の補完 |
| 御朱印の data URL（デモ写真） | **Cloudinary** | アップロードして URL に置換（失敗時は data URL のまま保存） |

- 二重移行防止: `users/{uid}.migration.local_storage_at` と localStorage の
  `kamitabicho:migration:v1` の **二段構え**
- 既存ユーザーが多い場合は管理者用スクリプトも利用可能:
  `node scripts/migrate-legacy.mjs ./serviceAccountKey.json`

---

## 9. 主な機能

| 機能 | 画面 | 備考 |
| --- | --- | --- |
| Google ログイン / ログアウト / 自動ログイン維持 | `/login`, `/profile` | ポップアップ→失敗時リダイレクト |
| デモモード | `/login` | 端末内保存・ワンタップ開始 |
| 神社検索（名前・都道府県・ご祭神） | `/shrines` | 参拝済み・お気に入り絞り込み |
| 神社詳細（所在地/電話/URL/ご祭神/由緒/地図） | `/shrines/[id]` | Google Maps / OSM 両対応 |
| GPS 参拝記録（300m 判定） | `/shrines/[id]` | 朱印アニメーション |
| 御朱印帳（写真・授与日・メモ） | `/goshuin`, `/goshuin/new` | **Cloudinary 保存**・拡大表示・削除 |
| マイページ（参拝回数・御朱印数・達成率） | `/mypage` | ドーナツグラフ |
| 参拝実績（9種） | `/achievements` | 自動解放・保存 |
| お気に入り神社 | `/favorites` | ホームにも表示 |
| 最近参拝した神社 | `/` | 横スクロールカード |
| PWA（インストール / オフライン） | 全体 | `sw.js` + `offline.html` |

---

## 10. セキュリティ

- Firestore ルールは「本人のデータのみ読み書き」を原則とし、未定義パスは全拒否
- 位置情報の 300m 判定はルール側でも `distance_m <= 300` を強制
- 画像はアップロード前にクライアントで検証（8MB以下・画像形式のみ）。Cloudinary 側でも
  Allowed formats / Max file size で二重に制限する
- Cloudinary の **API Secret は使用しない**（unsigned preset のみ）。Secret を環境変数に置かない
- オープンリダイレクト対策（`next` パラメータは同一オリジンのパスのみ許可）
- 本番運用では **App Check（reCAPTCHA Enterprise）** の導入を推奨（未導入）

---

## 11. 既知の制約（ベータ版）

- 神社マスタの `phone` / `url` は未入力（誤情報を避けるため。Firestore で追記可能）
- 参拝数の集計（`shrines.visit_count`）はクライアント加算のベストエフォート
- 御朱印を削除しても Cloudinary の画像は残る（孤立画像の自動削除は未実装）
- Cloudinary の無料枠を超えると画像が配信されなくなる（`4-8. 運用上の注意`）
- 管理者画面・通報機能は未実装
- 位置情報の精度が低い端末では 300m 判定が不安定になることがある（許容範囲の表示あり）

---

## 12. ドキュメント

- [Firebase 設定手順書](docs/FIREBASE_SETUP.md)
- [不具合修正内容一覧](docs/BUGFIXES.md)
- [品質確認（テスト結果）](docs/VERIFICATION.md)
- [今後の拡張提案](docs/ROADMAP.md)

## ライセンス

MIT（`LICENSE`）
