/* 神旅帳 v1.1 Service Worker
 *
 * 方針:
 *  - アプリシェル（アイコン・manifest・オフラインページ）のみプリキャッシュ
 *  - 画面遷移はネットワーク優先（コンテンツの陳腐化を防ぐ）＋ オフライン時は
 *    最後に表示できたページ → /offline.html の順にフォールバック
 *  - /_next/static はキャッシュ優先（ハッシュ付きファイル名なので安全）
 *  - Firestore / Auth / Storage などクロスオリジンの通信は一切キャッシュしない
 *  - バージョンを上げると古いキャッシュを自動削除する
 */
const VERSION = "1.1.0";
const STATIC_CACHE = `kamitabicho-static-v${VERSION}`;
const PAGE_CACHE = `kamitabicho-pages-v${VERSION}`;
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kamitabicho-") && key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // 同一オリジンのみ対象（Firebase への通信はキャッシュしない）
  if (url.origin !== self.location.origin) return;
  // 認証系・API はキャッシュしない
  if (url.pathname.startsWith("/api/")) return;

  // Next.js のハッシュ付き静的アセット: キャッシュ優先
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // 画面遷移: ネットワーク優先 → キャッシュ → オフラインページ
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline.html");
          return offline || new Response("オフラインです", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }),
    );
    return;
  }

  // 画像・フォントなど: キャッシュ優先＋バックグラウンド更新
  if (["image", "font", "style", "script"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      }),
    );
  }
});
