/**
 * v1.0 の visit_history → v1.1 の visits への一括移行（管理者用・非破壊）
 *
 * クライアント側でも初回ログイン時に自動移行しますが、既存ユーザーが多い場合や
 * セキュリティルールでクライアント移行が拒否される場合にこのスクリプトを使用します。
 *
 * 使い方:
 *   node scripts/migrate-legacy.mjs [serviceAccountKey.json のパス] [--delete-old]
 *
 * --delete-old を付けた場合のみ旧ドキュメントを削除します（既定はコピーのみ）。
 */
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const deleteOld = args.includes("--delete-old");
const keyPath = args.find((a) => !a.startsWith("--")) || process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch {
  console.error(`サービスアカウント鍵を読み込めませんでした: ${keyPath}`);
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });

const db = getFirestore();
const legacy = await db.collection("visit_history").get();
console.log(`旧 visit_history: ${legacy.size} 件`);

let copied = 0;
for (const doc of legacy.docs) {
  const d = doc.data();
  if (!d.user_id || !d.shrine_id) continue;
  await db
    .collection("visits")
    .doc(doc.id) // 旧IDをそのまま使い、再実行しても重複しない
    .set(
      {
        user_id: d.user_id,
        shrine_id: d.shrine_id,
        visit_datetime: d.visit_datetime || d.visited_at || d.created_at || new Date().toISOString(),
        latitude: Number(d.latitude ?? 0),
        longitude: Number(d.longitude ?? 0),
        distance_m: Number(d.distance_m ?? 0),
        created_at: d.created_at || new Date().toISOString(),
        migrated_from: "visit_history",
      },
      { merge: true },
    );
  copied += 1;
}

// goshuin の photo_url → image_url 補完
const goshuin = await db.collection("goshuin").get();
let fixed = 0;
for (const doc of goshuin.docs) {
  const d = doc.data();
  if (!d.image_url && d.photo_url) {
    await doc.ref.set({ image_url: d.photo_url }, { merge: true });
    fixed += 1;
  }
}

if (deleteOld) {
  const batch = db.batch();
  legacy.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log("旧 visit_history を削除しました。");
}

console.log(`完了: visits へ ${copied} 件をコピー、goshuin の image_url を ${fixed} 件補完しました。`);
process.exit(0);
