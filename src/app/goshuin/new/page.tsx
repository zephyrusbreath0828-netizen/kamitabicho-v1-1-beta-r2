"use client";

/** 御朱印の新規登録：写真・神社・授与日・メモ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/lib/app-context";
import { toUserMessage } from "@/lib/errors";
import { toDateInputValue } from "@/lib/format";
import { validateImage } from "@/lib/photo";

export default function NewGoshuinPage() {
  const { shrines, shrineById, registerGoshuin, visits } = useApp();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [shrineId, setShrineId] = useState("");
  const [visitedDate, setVisitedDate] = useState(toDateInputValue());
  const [memo, setMemo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ?shrine= で神社を指定して遷移してくる
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("shrine");
    if (id) setShrineId(id);
  }, []);

  // 最近参拝した神社を先頭に並べる
  const orderedShrines = useMemo(() => {
    const recent = Array.from(new Set(visits.map((v) => v.shrine_id)));
    const recentSet = new Set(recent);
    return [...shrines].sort((a, b) => {
      const ra = recentSet.has(a.id) ? 0 : 1;
      const rb = recentSet.has(b.id) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return 0;
    });
  }, [shrines, visits]);

  const onPick = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    const message = validateImage(f);
    if (message) {
      setError(message);
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!shrineId) {
      setError("神社を選択してください。");
      return;
    }
    if (!file) {
      setError("御朱印の写真を選択してください。");
      return;
    }
    setBusy(true);
    try {
      await registerGoshuin({ shrine_id: shrineId, visited_date: visitedDate, memo, file });
      router.push("/goshuin");
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="御朱印を記録" subtitle="いただいた御朱印を写真で残します" backHref="/goshuin" eyebrow="NEW GOSHUIN" />

      <form onSubmit={submit} className="space-y-4 px-4 py-4">
        <section className="wa-card p-4">
          <label className="text-[0.8rem] font-semibold" htmlFor="photo">
            御朱印の写真 <span className="text-shu">*</span>
          </label>
          <div className="mt-2 flex gap-3">
            <div className="goshuin-frame h-[124px] w-[94px] shrink-0">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="選択した御朱印" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[0.7rem] text-sumi-mute">未選択</div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileRef}
                id="photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                写真を選ぶ
              </button>
              <p className="text-[0.7rem] leading-snug text-sumi-mute">
                8MBまでの JPEG / PNG / WebP。撮影した写真は自動で縮小して保存します。
              </p>
              {file && (
                <button type="button" className="text-[0.72rem] text-sumi-mute underline" onClick={() => onPick(null)}>
                  選択を解除
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="wa-card space-y-3 p-4">
          <div>
            <label className="text-[0.8rem] font-semibold" htmlFor="shrine">
              神社 <span className="text-shu">*</span>
            </label>
            <select id="shrine" className="field mt-1" value={shrineId} onChange={(e) => setShrineId(e.target.value)}>
              <option value="">選択してください</option>
              {orderedShrines.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prefecture}｜{s.name}
                </option>
              ))}
            </select>
            {shrineId && (
              <p className="mt-1 text-[0.72rem] text-sumi-mute">
                {shrineById(shrineId)?.address}
              </p>
            )}
          </div>

          <div>
            <label className="text-[0.8rem] font-semibold" htmlFor="date">
              授与日
            </label>
            <input
              id="date"
              type="date"
              className="field mt-1"
              value={visitedDate}
              onChange={(e) => setVisitedDate(e.target.value)}
              max={toDateInputValue()}
            />
          </div>

          <div>
            <label className="text-[0.8rem] font-semibold" htmlFor="memo">
              メモ（任意）
            </label>
            <textarea
              id="memo"
              className="field mt-1"
              rows={3}
              maxLength={300}
              placeholder="例：早朝参拝。御朱印は授与所でいただきました。"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <p className="mt-1 text-right text-[0.68rem] text-sumi-mute">{memo.length}/300</p>
          </div>
        </section>

        {error && (
          <p className="rounded-xl border border-shu/30 bg-[#fdf1ef] px-3 py-2 text-[0.84rem] text-shu-deep">{error}</p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "保存しています…" : "御朱印帳に保存する"}
        </button>
        <p className="pb-2 text-center text-[0.7rem] text-sumi-mute">
          写真は本人だけが閲覧できます（Firebase Storage / デモは端末内）。
        </p>
      </form>
    </div>
  );
}
