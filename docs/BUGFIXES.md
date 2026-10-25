# 不具合修正内容一覧（v1.0 MVP → v1.1 ベータ）

対象読者: 開発担当者 / レビュー担当者
調査方法: v1.0 のソースコード静的解析 + 実機・ブラウザでの再現確認 + 本バージョンでの再テスト

---

## 総括

| # | 区分 | 不具合 | 重要度 | 状態 |
| --- | --- | --- | --- | --- |
| 1 | 認証 | デモモードで「試す」を押しても画面遷移しない | 致命的 | 修正済み |
| 2 | 認証 | ログイン画面とシェルで遷移処理が競合（二重 `router.replace`） | 高 | 修正済み |
| 3 | 認証 | `?autologin=1` の判定が残り、スプラッシュから復帰しない経路 | 高 | 修正済み |
| 4 | 認証 | localStorage 容量超過でログイン処理ごと失敗 | 高 | 修正済み |
| 5 | 認証 | Google ログイン未実装（デモのみ） | 致命的 | 実装済み |
| 6 | 認証 | 自動ログイン維持が未設定（セッション永続化なし） | 中 | 実装済み |
| 7 | データ | 保存先が localStorage のみ | 致命的 | Firestore / Storage 実装済み |
| 8 | データ | v1.0 データの移行手段がない | 高 | 実装済み（冪等） |
| 9 | PWA | manifest / icons / Service Worker の不整合 | 高 | 修正済み |
| 10 | PWA | 古い Service Worker が残り更新が反映されない | 中 | 修正済み |
| 11 | 画面 | 神社詳細に所在地・電話・URL・由緒・地図が不足 | 中 | 実装済み |
| 12 | 画面 | お気に入り・最近参拝・実績・達成率が未実装 | 中 | 実装済み |
| 13 | 品質 | TypeScript エラー / ビルド未検証 | 高 | 解決済み（`docs/VERIFICATION.md`） |

---

## 1. デモモードで画面遷移しない（最重要）

### 症状
「デモモードで試す（登録不要）」を押してもログイン画面のまま。ボタンが「準備しています…」で止まる、
または何も起きない。

### 原因（コード解析による特定）

v1.0 のデモログインは次の順序で処理していました。

```ts
// src/lib/backend-demo.ts（v1.0）
async signInAsDemo() {
  this.store.session = user;
  this.store.profiles[id] = profile;
  this.persist();   // ← localStorage 全体を1キーに保存（写真の data URL を含む）
  this.emit();      // ← 保存に成功した時だけ購読者へ通知
  return user;
}
```

1. **容量超過で例外**：御朱印写真を data URL で保存するため localStorage（約5MB）を
   超えやすく、`persist()` が例外を投げると `emit()` に到達しません。
   画面の `user` 状態が更新されず、遷移もエラー表示も起きません。
2. **二重遷移の競合**：`LoginPage` と `AppShell` の両方が `router.replace` を呼んでおり、
   さらに `AppShell` は `?autologin=1` の間スプラッシュを表示し続ける分岐を持っていました。
   遷移タイミングによっては「ログイン画面に留まる」「スプラッシュのまま」になります。
3. **状態確定前の遷移**：`await signInAsDemo()` の直後に `router.replace()` を呼ぶため、
   React の状態反映前にガード条件（`!user`）が評価され、`/login` へ戻されるケースがありました。

### 修正内容

| 対策 | 実装 |
| --- | --- |
| セッションとデータの分離 | `kamitabicho:demo:session:v2` にセッションのみ保存。データ容量の影響を受けない |
| 通知を保存より先に | `emit()` → `persist()` の順に変更。保存失敗でもログインは成立 |
| 保存失敗を握りつぶさない | 容量超過時は `lastWarning` に日本語メッセージを保持し、御朱印保存時のみ利用者へ通知 |
| 遷移の一元化 | `AppShell` 内の AuthGate だけが `router.replace` を実行（`LoginPage` から遷移処理を削除） |
| 二重遷移の防止 | `redirected` ref で同じ遷移先への再実行を抑止 |
| フォールバック | 2.5秒経っても `/login` にいる場合のみ `window.location.replace`（クライアント遷移が固まった場合の保険） |
| 自動ログイン維持 | デモはセッションキー、Firebase は `browserLocalPersistence` |

### 確認方法
1. シークレットウィンドウで `/login` を開く
2. 「デモモードで試す」→ **1秒以内にホームへ遷移**すること
3. ホームで統計（0社 / 0回 / 0枚）が表示されること
4. 再読み込みしてもログイン状態が維持されること
5. 御朱印を10枚ほど追加して localStorage を肥大化させても、ログイン・遷移が成功すること

---

## 2. Google ログイン未実装

- `FirebaseBackend.signInWithGoogle()` を実装（`GoogleAuthProvider` + `signInWithPopup`）
- ポップアップブロック / iOS 非対応環境では `signInWithRedirect` へ自動フォールバック
- 初回ログイン時に `users/{uid}` を自動作成（`ensureProfile`）
- ログアウトは `signOut` 後にローカル状態を必ず破棄（別ユーザーのデータ残留を防止）

## 3. 自動ログイン維持

- `setPersistence(auth, browserLocalPersistence)` をログイン前に実行
- 起動時は `onAuthStateChanged` の初回発火を待ってから画面を描画（ちらつき防止）

## 4. Firestore / Storage 保存

| 対象 | v1.0 | v1.1 |
| --- | --- | --- |
| 参拝履歴 | localStorage | `visits`（`visit_datetime` に統一） |
| 御朱印 | localStorage | `goshuin` + Storage `goshuin/{uid}/` |
| プロフィール | localStorage | `users` + Storage `avatars/{uid}/` |
| お気に入り | なし | `favorites`（ID = `uid_shrineId`） |
| 実績 | なし | `users.achievements`（解放日時マップ） |

## 5. localStorage データ移行

- 初回 Google ログイン時に自動実行（`FirebaseBackend.migrateLocalData`）
- 移行対象: 参拝履歴・御朱印・ニックネーム
- **冪等性**: 移行先のドキュメントIDを `mig_<hash>` で決定（再実行しても重複しない）
- **二重移行防止**: `users.migration.local_storage_at` + localStorage `kamitabicho:migration:v1`
- 御朱印の data URL は Storage にアップロードして URL 化
- 失敗時はログインを妨げず、コンソール警告のみ（次回ログインで再試行）

## 6. PWA

| 項目 | v1.0 の問題 | v1.1 の対応 |
| --- | --- | --- |
| manifest | `id` なし、`display_override` なし、アイコンサイズ不整合 | 正しいサイズの PNG を再生成、`id` / `display_override` / shortcuts を追加 |
| icons | サイズ・maskable の余白が不適切 | 192 / 512 / maskable 512（20%余白）/ apple-touch 180 を生成 |
| sw.js | キャッシュ名固定で更新が反映されない、`skipWaiting` が無条件 | バージョン付きキャッシュ、`_next/static` のみキャッシュ優先、ナビゲーションはネットワーク優先、古いキャッシュ自動削除 |
| オフライン | `offline.html` のデザイン・導線が弱い | 和モダンの専用ページ（再読み込み / ホーム導線） |
| 登録 | 本番のみ登録だが更新通知なし | 更新検知バナー + 24時間ごとの `update()` |

**PWA インストール要件の確認**: HTTPS、`manifest` の `name` / `icons`（192・512）/ `start_url` / `display`、
Service Worker の登録。Vercel は HTTPS 自動付与のため、デプロイ後にインストール可能になります。

## 7. 画面・機能追加

- 神社詳細: 所在地 / 電話番号 / 公式サイト / ご祭神 / 由緒 / 地図（Google Maps・OSM 両対応）
- マイページ: ニックネーム・参拝回数・御朱印数・参拝達成率（ドーナツ表示）
- 参拝実績: 9種（初参拝 / 10社 / 30社 / 50社 / 100社 / 御朱印デビュー / 御朱印10枚 / 10都道府県 / 全国制覇）
- お気に入り神社: 一覧・ホーム表示・ワンタップ登録
- 最近参拝した神社: ホームに横スクロール表示
- UI: 和モダン×御朱印帳（和紙・朱・金）、カード統一、フェードアップ、朱印スタンプ、レスポンシブ

## 8. 互換性

| データ | 互換性 |
| --- | --- |
| v1.0 `visit_history.visited_at` | 読み取り時に `visit_datetime` へ正規化、移行時にコピー |
| v1.0 `goshuin.photo_url` | 読み取り時に `image_url` へフォールバック、移行時に補完 |
| v1.0 localStorage `kamitabicho:demo:v1` | 読み取り・移行に対応（削除しない） |
| v1.1 以降の追加フィールド | すべて optional。`schema_version` で判別可能 |


---

## 9. 仕様変更: 画像保存先を Firebase Storage → Cloudinary へ

| 項目 | 変更前 | 変更後 |
| --- | --- | --- |
| 御朱印画像 | Firebase Storage `goshuin/{uid}/` | **Cloudinary** `kamitabicho/goshuin/{uid}/` |
| プロフィール画像 | Firebase Storage `avatars/{uid}/` | **Cloudinary** `kamitabicho/avatars/{uid}/` |
| Firestore に保存する値 | Storage のダウンロードURL | **Cloudinary の `secure_url` のみ** |
| Storage ルール | `storage.rules` をデプロイ | **不要（ファイル削除済み）** |
| 認証情報 | Firebase のみ | Firebase ＋ Cloudinary（unsigned preset） |

### 実装

- `src/lib/cloudinary.ts` を新設し `uploadToCloudinary()` に集約
  - 送信前に Canvas で縮小（御朱印 1600px / プロフィール 400px）
  - タイムアウト 60 秒（`AbortController`）
  - HTTP ステータス＋エラー本文から**日本語メッセージを生成**（`mapCloudinaryError`）
- `backend-firebase.ts` の `uploadImage()` を Cloudinary 実装へ差し替え、`firebase/storage` の import を全削除
- `firebase.ts` から `getFbStorage` / `STORAGE_PATHS` / `storagePathFromUrl` を削除
- `firebase.json` の `storage` セクションと `storage.rules` を削除
- `next.config.ts` を新規作成（Cloudinary 画像ドメイン・セキュリティヘッダー・PWA ヘッダー）

### アップロード失敗時

- 画面に日本語のエラーメッセージを表示（御朱印登録・プロフィール変更の両方）
- **Firestore には書き込まない**（URL の無いレコードを作らない）
- 分類: 設定未完了 / プリセット不正 / Signed プリセット / サイズ超過 / 権限 / レート制限 /
  サーバーエラー / タイムアウト / 通信断

### 互換性

- 既存の `goshuin.image_url` が Firebase Storage の URL でもそのまま表示可能（`<img src>` 参照のみ）
- デモの data URL も表示可能。移行時に Cloudinary へアップロードを試み、失敗時は data URL のまま保存
- 削除時: Firestore のレコードは削除、Cloudinary の画像は残る（クライアントからは削除不可）
