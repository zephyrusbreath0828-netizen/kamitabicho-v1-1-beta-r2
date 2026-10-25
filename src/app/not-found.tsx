import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-washi-line font-mincho text-xl text-kin">
        無
      </div>
      <h1 className="font-mincho text-[1.2rem] font-semibold">ページが見つかりません</h1>
      <p className="text-[0.84rem] text-sumi-mute">お探しの画面は移動または削除された可能性があります。</p>
      <Link href="/" className="btn btn-primary mt-2">
        ホームへ戻る
      </Link>
    </div>
  );
}
