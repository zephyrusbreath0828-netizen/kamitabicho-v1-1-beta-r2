"use client";

/** プロフィール設定：ニックネーム・画像・ログイン方式・ログアウト */
import Link from "next/link";
import { useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/lib/app-context";
import { toUserMessage } from "@/lib/errors";
import { isFirebaseConfigured } from "@/lib/firebase";
import { formatDate } from "@/lib/format";
import { validateImage } from "@/lib/photo";

const MAX_NICKNAME = 24;

export default function ProfilePage() {
  const { user, profile, mode, backend, updateProfile, uploadImage, signOut, signInWithGoogle, migration } = useApp();
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [busy, setBusy] = useState<"save" | "photo" | "logout" | "google" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("ニックネームを入力してください。");
      return;
    }
    if (trimmed.length > MAX_NICKNAME) {
      setError(`ニックネームは${MAX_NICKNAME}文字以内で入力してください。`);
      return;
    }
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      await updateProfile({ nickname: trimmed });
      setMessage("プロフィールを更新しました。");
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const pickPhoto = async (file: File | null) => {
    if (!file) return;
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy("photo");
    setError(null);
    try {
      const url = await uploadImage("avatar", file);
      await updateProfile({ photo_url: url });
      setMessage("プロフィール画像を更新しました。");
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const doLogout = async () => {
    if (!window.confirm("ログアウトしますか？")) return;
    setBusy("logout");
    try {
      await signOut();
    } finally {
      setBusy(null);
    }
  };

  const doGoogle = async () => {
    setBusy("google");
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="プロフィール設定" backHref="/mypage" eyebrow="PROFILE" />

      <div className="space-y-4 px-4 py-4">
        <section className="wa-card flex items-center gap-4 p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-washi-line bg-washi-deep text-xl">
            {profile?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{(profile?.nickname ?? "参").slice(0, 1)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void pickPhoto(e.target.files?.[0] ?? null)}
            />
            <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {busy === "photo" ? "更新中…" : "画像を変更"}
            </button>
            <p className="mt-1 text-[0.7rem] leading-snug text-sumi-mute">
              JPEG / PNG・8MBまで。Firebase Storage の本人フォルダに保存されます。
            </p>
          </div>
        </section>

        <form onSubmit={save} className="wa-card space-y-3 p-4">
          <div>
            <label className="text-[0.8rem] font-semibold" htmlFor="nickname">
              ニックネーム
            </label>
            <input
              id="nickname"
              className="field mt-1"
              value={nickname}
              maxLength={MAX_NICKNAME}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例：参拝 花子"
            />
            <p className="mt-1 text-right text-[0.68rem] text-sumi-mute">
              {nickname.length}/{MAX_NICKNAME}
            </p>
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy !== null}>
            {busy === "save" ? "保存しています…" : "保存する"}
          </button>
          {message && <p className="text-[0.8rem] text-mori">✓ {message}</p>}
          {error && <p className="text-[0.8rem] text-shu-deep">{error}</p>}
        </form>

        <section className="wa-card divide-y divide-washi-line">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[0.82rem] text-sumi-mute">ログイン方式</p>
            <p className="text-[0.86rem] font-semibold">{mode === "demo" ? "デモモード（端末内）" : "Google アカウント"}</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[0.82rem] text-sumi-mute">メールアドレス</p>
            <p className="max-w-[60%] truncate text-[0.84rem]">{user?.email ?? "—"}</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[0.82rem] text-sumi-mute">ユーザーID</p>
            <p className="max-w-[60%] truncate font-mono text-[0.7rem] text-sumi-soft">{user?.uid}</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[0.82rem] text-sumi-mute">登録日</p>
            <p className="text-[0.84rem]">{profile?.created_at ? formatDate(profile.created_at) : "—"}</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[0.82rem] text-sumi-mute">データの保存先</p>
            <p className="text-[0.84rem]">{mode === "demo" ? "この端末（localStorage）" : "Cloud Firestore"}</p>
          </div>
          {migration?.performed && (
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[0.82rem] text-sumi-mute">データ移行</p>
              <p className="text-[0.8rem] text-mori">
                参拝{migration.visits}件・御朱印{migration.goshuin}件を引き継ぎ済み
              </p>
            </div>
          )}
        </section>

        {mode === "demo" && isFirebaseConfigured && (
          <section className="wa-card p-4">
            <p className="text-[0.86rem] font-semibold">Google アカウントに切り替える</p>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-sumi-mute">
              デモモードで記録した参拝・御朱印は、初回ログイン時に自動で引き継がれます（二重移行はしません）。
            </p>
            <button className="btn btn-primary mt-2 w-full" onClick={() => void doGoogle()} disabled={busy !== null}>
              {busy === "google" ? "接続しています…" : "Google でログインして引き継ぐ"}
            </button>
          </section>
        )}

        <section className="wa-card p-4">
          <p className="text-[0.8rem] font-semibold">アプリ情報</p>
          <dl className="mt-2 space-y-1 text-[0.76rem] text-sumi-soft">
            <div className="flex justify-between">
              <dt className="text-sumi-mute">バージョン</dt>
              <dd>1.1.0（ベータ）</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sumi-mute">接続状態</dt>
              <dd className="max-w-[70%] text-right">{backend.describe()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sumi-mute">神社マスタ</dt>
              <dd>{backend.shrineSource === "firestore" ? "Firestore" : "同梱データ"}</dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Link href="/achievements" className="btn btn-outline btn-sm flex-1">
              実績を見る
            </Link>
            <Link href="/favorites" className="btn btn-outline btn-sm flex-1">
              お気に入り
            </Link>
          </div>
        </section>

        <button className="btn btn-outline w-full border-shu/30 text-shu" onClick={() => void doLogout()} disabled={busy !== null}>
          {busy === "logout" ? "処理しています…" : "ログアウト"}
        </button>

        <p className="pb-2 text-center text-[0.68rem] leading-relaxed text-sumi-mute">
          位置情報は参拝記録の登録判定にのみ使用します。
          <br />
          データの削除をご希望の場合は、お問い合わせください。
        </p>
      </div>
    </div>
  );
}
