/**
 * Firestore へ神社マスタ（100件）を投入する
 *
 * 事前準備:
 *   1. Firebase コンソール > プロジェクトの設定 > サービスアカウント
 *      「新しい秘密鍵を生成」→ serviceAccountKey.json をプロジェクト直下に保存
 *   2. npm run seed
 *
 * 使い方: node scripts/seed-shrines.mjs [serviceAccountKey.json のパス]
 *
 * 既存ドキュメントは merge で更新するため、電話番号・URL を後から追記しても
 * 他のフィールドを壊しません。
 */
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch {
  console.error(`サービスアカウント鍵を読み込めませんでした: ${keyPath}`);
  console.error("Firebase コンソールで秘密鍵を生成し、パスを引数または環境変数で指定してください。");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
}

const db = getFirestore();
const shrines = JSON.parse(readFileSync("src/data/shrines.json", "utf8"));

let written = 0;
for (let i = 0; i < shrines.length; i += 400) {
  const chunk = shrines.slice(i, i + 400);
  const batch = db.batch();
  for (const s of chunk) {
    const { id, ...rest } = s;
    batch.set(
      db.collection("shrines").doc(id),
      {
        ...rest,
        // 未設定項目は既存値を壊さないよう merge で書き込む
        phone: rest.phone ?? null,
        url: rest.url ?? null,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
    written += 1;
  }
  await batch.commit();
  console.log(`  ... ${written} / ${shrines.length} 件を書き込み`);
}

console.log(`完了: shrines コレクションに ${written} 件を投入しました。`);
process.exit(0);
