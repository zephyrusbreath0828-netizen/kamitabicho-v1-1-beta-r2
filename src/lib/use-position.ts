"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentPosition } from "@/lib/geo";
import {
  clearPosition,
  readStoredPosition,
  setPosition,
  subscribePosition,
  type StoredPosition,
} from "@/lib/position-store";

/**
 * 現在地を扱うフック。
 * - locate(): GPS から取得（約15秒タイムアウト）
 * - useTestPosition(): 動作確認用に神社座標などを擬似現在地として設定
 */
export function usePosition() {
  const [position, setPositionState] = useState<StoredPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribePosition(setPositionState), []);

  const locate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        source: "gps",
        label: "現在地（GPS）",
      });
      return readStoredPosition();
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { position, loading, error, locate, clear: clearPosition };
}

/** テスト用の擬似現在地（「すぐに試せる」ための補助機能） */
export function useTestPosition() {
  const setTest = useCallback(
    (latitude: number, longitude: number, label: string) => {
      setPosition({ latitude, longitude, accuracy: 5, source: "test", label });
    },
    [],
  );
  const clearTest = useCallback(() => clearPosition(), []);
  return { setTest, clearTest };
}
