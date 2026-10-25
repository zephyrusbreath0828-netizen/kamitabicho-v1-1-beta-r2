# 品質確認レポート（神旅帳 v1.1 / Cloudinary 版）

実施日: 2026-10-25 21:06 (JST)
対象: 本番ビルド（`next build` + `next start`）／画像保存先を Cloudinary へ変更した版

---

## 1. 判定

| 項目 | 結果 |
| --- | --- |
| TypeScript 型チェック（`tsc --noEmit`） | **エラー 0** |
| 本番ビルド（`npm run build`） | **成功**（12ルート生成） |
| 画面の受入テスト（E2E / Chromium） | **16 / 16 PASS** |
| Cloudinary アップロード処理のテスト | **15 / 15 PASS** |
| Firebase Storage 依存の残存 | **0件**（`firebase/storage` の import・`storage.rules` を削除） |
| 総合判定 | **ベータ公開可**（実 Cloudinary アカウントでの送信確認は設定後に必要） |

---

## 2. 画面の受入テスト（E2E）

| # | 確認項目 | 結果 | 詳細 |
| --- | --- | --- | --- |
| 1 | 未ログイン時に /login へリダイレクト | ✅ PASS | http://127.0.0.1:3000/login?next=%2F |
| 2 | デモモード押下後にホームへ自動遷移 | ✅ PASS | 227ms / url=http://127.0.0.1:3000/ |
| 3 | ホーム画面が描画される | ✅ PASS | 神旅帳 |
| 4 | デモセッションが保存される | ✅ PASS | session key ok |
| 5 | 再読み込み後もログイン維持 | ✅ PASS | http://127.0.0.1:3000/ |
| 6 | 神社一覧が表示される | ✅ PASS | — |
| 7 | 神社詳細に基本情報が表示される | ✅ PASS | http://127.0.0.1:3000/shrines/shr-001 |
| 8 | GPS参拝記録（300m以内）が成功 | ✅ PASS | — |
| 9 | マイページに達成率が表示される | ✅ PASS | — |
| 10 | 御朱印帳が表示される | ✅ PASS | — |
| 11 | 実績画面が表示される | ✅ PASS | — |
| 12 | manifest が有効 | ✅ PASS | {"ok":true,"name":"神旅帳 - 全国の神社巡礼アプリ","icons":4,"display":"standalone"} |
| 13 | Service Worker が登録される | ✅ PASS | active |
| 14 | offline.html が配信される | ✅ PASS | 200 |
| 15 | ログアウトで /login に戻る | ✅ PASS | http://127.0.0.1:3000/login?next=%2Fprofile |
| 16 | JS 実行時エラーなし | ✅ PASS | — |

---

## 3. Cloudinary アップロード処理のテスト

`src/lib/cloudinary.ts` を単体でコンパイルし、`fetch` を差し替えて
**エラー分類・送信内容・戻り値**を検証しました。

| # | 確認項目 | 結果 | 詳細 |
| --- | --- | --- | --- |
| 1 | 設定未完了を検知する | ✅ PASS | — |
| 2 | 設定未完了時にエラーを返す | ✅ PASS | cloudinary/not-configured |
| 3 | 環境変数から設定を読み込む | ✅ PASS | — |
| 4 | プリセット不正（400）を判別 | ✅ PASS | cloudinary/invalid-preset |
| 5 | Signed プリセットを判別 | ✅ PASS | cloudinary/preset-signed |
| 6 | 権限エラー（401）を判別 | ✅ PASS | cloudinary/unauthorized |
| 7 | サイズ超過（413）を判別 | ✅ PASS | cloudinary/too-large |
| 8 | レート制限（429）を判別 | ✅ PASS | cloudinary/rate-limited |
| 9 | サーバーエラー（500）を判別 | ✅ PASS | cloudinary/server-error |
| 10 | 通信断を判別 | ✅ PASS | cloudinary/network |
| 11 | 非画像ファイルを拒否 | ✅ PASS | cloudinary/invalid-file |
| 12 | 成功時に secure_url を返す | ✅ PASS | https://res.cloudinary.com/demo/image/upload/v1/kami |
| 13 | フォルダに uid を含める | ✅ PASS | kamitabicho/goshuin/uid-test |
| 14 | upload_preset を送信する | ✅ PASS | kamitabicho_unsigned |
| 15 | public_id を URL から抽出できる | ✅ PASS | — |

> 特に重要な検証:
> - 失敗時に **例外（日本語メッセージ）** が返り、画面表示に回せること
> - 成功時に **`secure_url` のみ**を返し、Firestore には URL だけを保存する設計であること
> - `folder` に `kamitabicho/goshuin/{uid}` が入り、所有者を Cloudinary 側でも判別できること

---

## 4. ビルド / PWA / ヘッダー

| 項目 | 結果 |
| --- | --- |
| 静的生成 | 12 ページ成功 |
| `sw.js` の `Cache-Control` | `no-cache, no-store, must-revalidate`（実測） |
| `Service-Worker-Allowed` | `/`（実測） |
| `X-Content-Type-Options` | `nosniff`（実測） |
| manifest / sw.js / offline.html / icon-192 | すべて 200（実測） |
| Service Worker 登録 | `active`（ブラウザ実測） |
| ChunkLoadError 復帰ガード | 実装済み（デプロイ直後の白画面を1回の再読込で回復） |

> `next.config.ts` を新規作成し、Cloudinary（`res.cloudinary.com`）の画像ドメイン許可と
> セキュリティヘッダーを有効化しました。以前は設定ファイルが無く、ヘッダーが未適用でした。

---

## 5. 未検証項目（重要）

以下は **実アカウントの認証情報がこの環境に無いため未実施**です。デプロイ後に必ず確認してください。

| 項目 | 理由 | 確認方法 |
| --- | --- | --- |
| Cloudinary への実アップロード | 実アカウント・プリセットが未作成 | README「4-6. 動作確認」 |
| Cloudinary の URL が Firestore に入ること | 同上 | `goshuin.image_url` が `https://res.cloudinary.com/...` |
| 8MB 近い写真の実送信 | 同上 | 実機の写真で御朱印登録（縮小後のサイズも確認） |
| Google ログイン（実認証） | Firebase プロジェクト未作成 | `docs/FIREBASE_SETUP.md` の手順後 |
| Firestore への保存・移行 | 同上 | デモで数件 → Google ログイン → 件数一致 |
| 実機での PWA インストール | ヘッドレス環境では不可 | Android Chrome / iOS Safari |
| 実 GPS での 300m 判定 | 実機の位置情報が必要 | 神社周辺で参拝記録 |
| Cloudinary 無料枠の消費量 | 実運用のみ | ダッシュボードの Usage |

---

## 6. デプロイ後の手動チェックリスト

1. `/login` → Google ログイン → ホームへ遷移、`users/{uid}` 作成
2. 御朱印を追加 → Cloudinary Media Library の `kamitabicho/goshuin/{uid}/` に画像、
   Firestore の `image_url` が Cloudinary の URL（**画像データは Firestore に無い**）
3. プロフィール画像変更 → `kamitabicho/avatars/{uid}/` に画像、`users.photo_url` 更新
4. Cloudinary のプリセットを一時的に Signed に変更 → 登録時に
   「Unsigned になっていません」が表示され、Firestore にレコードが増えないこと
5. 環境変数を空にして再デプロイ → 画像アップロード時に「設定が完了していません」が表示されること
6. 参拝記録・実績・お気に入りが従来どおり動作すること
7. PWA インストール → オフライン起動 → 御朱印帳が閲覧できること

---

## 7. テスト上の割り切り / 注記

- Cloudinary の処理テストは `fetch` をスタブして実施（実通信なし）。実際の HTTP 応答形式は
  Cloudinary の公開仕様（`error.message` / `secure_url`）に準拠
- 位置情報はヘッドレスブラウザで取得できないため、検証用の「テスト位置」機能を使用
- 画像の縮小（Canvas）はブラウザ API のため、Node 上のテストでは元ファイルをそのまま送信する経路を検証
  （縮小自体はブラウザ実行時に `fileToDataUrl` が担当）
