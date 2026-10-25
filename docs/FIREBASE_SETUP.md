# Firebase 設定手順書（神旅帳 v1.1）

対象: 初めて Firebase を設定する担当者
所要時間: 約 30〜45 分
前提: Google アカウント、Node.js 20 以上、このリポジトリのソース一式

---

## 0. 全体像

```
[ブラウザ / PWA]
   │  Firebase JS SDK（NEXT_PUBLIC_* の構成情報）
   ├─ Authentication … Google ログイン
   ├─ Cloud Firestore … users / visits / goshuin / favorites / shrines
   └─ Cloudinary … 御朱印写真・プロフィール画像（Firebase Storage は使用しません）
[Vercel] … Next.js のホスティング
```

Firebase プロジェクトは **1つ**、環境（本番 / ステージング）を分けたい場合は
プロジェクトを分けて `.env.local` と Vercel の環境変数を切り替えます。

---

## 1. Firebase プロジェクトの作成

1. https://console.firebase.google.com/ を開く
2. 「プロジェクトを追加」
   - プロジェクト名: `kamitabicho`（任意）
   - Google アナリティクス: 任意（不要ならオフ）
3. 作成後、左メニュー下部の ⚙ →「プロジェクトの設定」

### 1-1. ウェブアプリの登録

1. 「マイアプリ」→ `</>`（ウェブ）を選択
2. アプリのニックネーム: `kamitabicho-web`
3. 「Firebase Hosting を設定する」は **チェック不要**（Vercel を使うため）
4. 表示される `firebaseConfig` の値を控える

```js
const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "kamitabicho.firebaseapp.com",
  projectId: "kamitabicho",
  storageBucket: "kamitabicho.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
```

5. `.env.local` に転記（**接頭辞 `NEXT_PUBLIC_` を忘れずに**）

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kamitabicho.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kamitabicho
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kamitabicho.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

> `storageBucket` が `*.appspot.com` 形式で表示される場合もあります。表示された値をそのまま使用してください。

---

## 2. Google 認証の設定

1. 左メニュー **Authentication** → 「始める」
2. **Sign-in method** タブ → 「Google」→ 有効化
   - プロジェクトの公開名: `神旅帳`
   - サポートメール: 運用担当者のメール
3. **Settings** タブ →「承認済みドメイン」

| ドメイン | 用途 |
| --- | --- |
| `localhost` | ローカル開発（既定で登録済み） |
| `kamitabicho.vercel.app` | Vercel の本番ドメイン |
| `kamitabicho-git-main-xxx.vercel.app` | プレビュー（必要な場合） |
| 独自ドメイン | 運用する場合 |

> ここに未登録のドメインでログインすると `auth/unauthorized-domain` エラーになります。

### 2-1. ログイン方式の補足

- 実装は `signInWithPopup` を優先し、ポップアップがブロックされた場合や
  iOS の一部環境では `signInWithRedirect` に自動で切り替えます
- 認証の永続化は `browserLocalPersistence`（タブを閉じてもログイン維持）

---

## 3. Firestore の設定

1. 左メニュー **Firestore Database** → 「データベースを作成」
2. モード: **本番環境モード**（ルールはこのリポジトリのものをデプロイ）
3. ロケーション: **asia-northeast1（東京）** ← Vercel の `hnd1` と揃える
4. 作成後、「ルール」タブに `firestore.rules` の内容を貼り付けて公開
   （CLI を使う場合は次項）

### 3-1. CLI でルールとインデックスをデプロイ

```bash
npm i -g firebase-tools
firebase login
firebase use --add          # 対象プロジェクトを選択（エイリアス: default）
firebase deploy --only firestore:rules,firestore:indexes,storage
```

`.firebaserc` が無い場合は `firebase use --add` で生成されます。

### 3-2. コレクション

自動作成されるため、手動作成は不要です（初回書き込み時に生成）。

| コレクション | 用途 | 主なフィールド |
| --- | --- | --- |
| `users` | プロフィール | uid, nickname, photo_url, created_at, achievements, migration |
| `visits` | 参拝記録 | user_id, shrine_id, visit_datetime, latitude, longitude, distance_m |
| `goshuin` | 御朱印 | user_id, shrine_id, image_url, memo, created_at, visited_date |
| `favorites` | お気に入り | user_id, shrine_id, created_at（ID = `uid_shrineId`） |
| `shrines` | 神社マスタ | name, prefecture, address, latitude, longitude, main_deity, description, image_url, visit_count |

### 3-3. 複合インデックス

v1.1 は `where("user_id", "==", uid)` のみで並べ替えをクライアントで行うため、
**複合インデックスは不要**です（`firestore.indexes.json` は空定義）。
将来 `orderBy` を併用する場合はコンソールのエラーメッセージから作成してください。

### 3-4. 神社マスタの投入（100社）

1. Firebase コンソール → ⚙ →「サービスアカウント」→「新しい秘密鍵の生成」
2. ダウンロードした JSON を `serviceAccountKey.json` としてプロジェクト直下に置く
3. 実行

```bash
npm run seed
# または
node scripts/seed-shrines.mjs ./serviceAccountKey.json
```

成功すると `shrines` に 100 件入ります。アプリは `shrines` が空の場合、
同梱の `src/data/shrines.json` を表示するため、シード前でも動作します。

> `serviceAccountKey.json` は **絶対に Git にコミットしない**（`.gitignore` 済み）。

---

## 4. 画像ストレージ（Cloudinary）

**Firebase Storage は使用しません。** 御朱印写真とプロフィール画像は Cloudinary に保存し、
返却された `secure_url` のみを Firestore に保存します。

### 4-1. 必要な作業

1. https://cloudinary.com/users/register_free でアカウント作成（無料）
2. Dashboard で **Cloud name** を控える
3. Settings → Upload → **Upload presets** → Add upload preset
   - Preset name: `kamitabicho_unsigned`
   - **Signing Mode: Unsigned**（必須。Signed だとアップロード不可）
   - Allowed formats: `jpg,png,webp,heic,heif` / Max file size: `8000000`
4. `.env.local` に設定

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dxxxxxxyy
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=kamitabicho_unsigned
NEXT_PUBLIC_CLOUDINARY_FOLDER=kamitabicho
```

### 4-2. 保存パス

```
kamitabicho/goshuin/{uid}/<ランダム名>.jpg
kamitabicho/avatars/{uid}/<ランダム名>.jpg
```

### 4-3. 注意点

- **API Secret は使用しない**（unsigned preset のみ）。Secret を環境変数に置かない
- 画像は送信前に長辺 1600px（御朱印）/ 400px（プロフィール）へ縮小される
- 御朱印を削除しても Cloudinary の画像は残る（管理画面で定期整理）
- 詳細・トラブルシューティングは README「4. Cloudinary の設定」を参照

## 5. Vercel へのデプロイ

### 5-1. CLI

```bash
npm i -g vercel
vercel link                 # プロジェクトを作成/紐付け
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY          # 6項目を登録
vercel --prod
```

### 5-2. ダッシュボード

1. https://vercel.com/new → GitHub リポジトリを Import
2. Framework Preset: **Next.js**（自動検出）
3. **Environment Variables** に 6項目を登録（Production / Preview / Development）
4. Deploy

### 5-3. デプロイ後に必須の作業

1. Firebase コンソール → Authentication → Settings → 承認済みドメインに
   Vercel のドメインを追加
2. 実機で Google ログインを確認
3. `docs/VERIFICATION.md` のチェックリストを実施

### 5-4. リージョン

`vercel.json` で `hnd1`（東京）を指定しています。Firestore も `asia-northeast1` に
合わせることでレイテンシを最小化できます。

---

## 6. 環境変数一覧

| 変数 | 必須 | 例 |
| --- | :---: | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ● | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ● | `kamitabicho.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ● | `kamitabicho` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | — | **未使用**（Storage を使わないため任意） |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | ● | `dxxxxxxyy` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | ● | `kamitabicho_unsigned` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ● | `1234567890` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ● | `1:123...:web:abc` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | — | Google Maps 表示（無くても OSM で動作） |
| `NEXT_PUBLIC_ENABLE_DEMO` | — | `false` でデモボタン非表示 |
| `NEXT_PUBLIC_ENABLE_DEMO_TOOLS` | — | テスト位置ツールの表示制御 |

---

## 7. 動作確認（Firebase 接続後）

| # | 確認項目 | 期待結果 |
| --- | --- | --- |
| 1 | `/login` で Google ログイン | ホームへ遷移、`users/{uid}` が作成される |
| 2 | ページを再読み込み | ログイン状態が維持される |
| 3 | 神社詳細で参拝記録 | `visits` に1件、`shrines.visit_count` が +1 |
| 4 | 御朱印を追加 | `goshuin` に1件、`image_url` が Cloudinary の URL、Media Library に画像 |
| 5 | プロフィール画像変更 | Cloudinary `kamitabicho/avatars/{uid}/` に画像、`users.photo_url` が `https://res.cloudinary.com/...` になる |
| 6 | お気に入り | `favorites/{uid}_{shrineId}` が作成/削除される |
| 7 | 実績 | `users.achievements` に解放日時が入る |
| 8 | 別端末でログイン | 同じデータが表示される |
| 9 | デモ→Google | 初回ログイン時にデータ移行、二重移行しない |

---

## 8. トラブルシューティング

| 症状 | 原因と対処 |
| --- | --- |
| `auth/unauthorized-domain` | 承認済みドメイン未登録。Firebase コンソールで追加 |
| `auth/operation-not-allowed` | Google プロバイダが無効。Authentication で有効化 |
| `permission-denied`（Firestore） | ルール未デプロイ、またはログインしていない。`firebase deploy --only firestore:rules` |
| 画像アップロードが失敗する | Cloudinary の環境変数（クラウド名／プリセット名）を確認。プリセットが **Unsigned** か確認。値変更後は再デプロイが必要（`NEXT_PUBLIC_*` はビルド時に埋め込まれる） |
| 「プリセットが見つかりません」 | プリセット名の綴り、または別アカウントのプリセットを指定している |
| 「Unsigned になっていません」 | プリセットの Signing Mode が Signed。Unsigned で作り直す |
| 神社が表示されない | `shrines` 未投入でも同梱データで表示される。シード失敗時はサービスアカウント鍵を確認 |
| ログイン後に画面が変わらない | v1.1 で修正済み。古い Service Worker が残っている場合は「更新」を押すか、サイトデータを削除 |
| 画像が表示されない | `next.config.ts` の `images.remotePatterns` と Storage の公開設定を確認 |
| 地図が出ない | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 未設定なら OSM 表示（仕様）。Google 地図を使う場合は Maps JavaScript API を有効化 |

---

## 9. 運用上の推奨設定

- **App Check**: reCAPTCHA Enterprise を有効化し、Firestore / Storage への不正アクセスを防止（未導入）
- **予算アラート**: Google Cloud の課金アラートを設定（無料枠超過の検知）
- **バックアップ**: Firestore の定期エクスポート（`gcloud firestore export`）
- **利用規約 / プライバシーポリシー**: 位置情報・写真の取り扱いを明記して公開
