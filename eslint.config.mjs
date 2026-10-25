import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  {
    ignores: [".next/**", "node_modules/**", "public/**", "firestore/**", "docs/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 画像は data URL / Firebase Storage URL を扱うため <img> を許可している
      "@next/next/no-img-element": "off",
      // Google Maps は CDN から読み込むため公式型定義を同梱していない（@types/google.maps 未導入）
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
