# 不動産DX Platform — 開発引き継ぎドキュメント

最終更新: 2026-05-02

このドキュメントは README.md の補足として、**開発途中の現状・既知の問題・運用上の注意点**を引き継ぎのためにまとめたものです。  
基本的なセットアップ手順や技術スタックは [`README.md`](./README.md) を参照してください。

---

## 1. プロジェクト概要

賃貸仲介CRM・申込・契約・管理業務を一気通貫でデジタル化する不動産DXプラットフォーム（イタンジ代替）。  
以下の3コンポーネントで構成されます：

| コンポーネント | スタック | 役割 |
|---|---|---|
| `frontend/` | Next.js 15 (App Router) + Tailwind + shadcn/ui | 業務UI（CRM、申込、契約、管理BO） |
| `backend/` | Hono + Prisma 6 + PostgreSQL 16 + pgvector | API、AIチャット、物件提案エンジン |
| `chrome-extension/` | Manifest V3 (Vanilla JS) | iimon「物出し早いもん」物件取込 |
| `extension/` | Manifest V3 (Vanilla JS) | SUUMO 管理画面への自動投稿 |

---

## 2. 現状サマリー（移管時点）

### 完了している機能
- Phase 0〜5 の主要機能は実装済み（README.md「機能一覧」参照）
- ローカル開発環境（docker compose）は動作する
- Render（Backend Docker）と Vercel（Frontend）の本番デプロイは構成済み
  - Frontend: https://realestate-dx-frontend-app.vercel.app
  - Backend: https://realestate-dx-backend.onrender.com
- iimon 物件取込 Chrome 拡張は動作する

### 未完了 / 進行中
- [ ] **Phase 2-4 のフロントエンドが一部 mock のまま** — 実 API への差し替えが必要
- [ ] **iimon 自動投稿 Chrome 拡張** — 取込側は完成、自動投稿側は未着手
- [ ] **本番デプロイの仕上げ** — Frontend は動作、Backend は環境変数の本番値詰めが必要
- [ ] **テストコード** — Unit / E2E ともにほぼ未整備（手動QAで確認している状態）
- [ ] **ロギング / 監視** — Sentry等の組込みなし

### 既知の課題
- `frontend/src/middleware.ts` に未コミットの修正あり（移管前に内容確認のうえ commit 推奨）
- `frontend/tsconfig.tsbuildinfo` はビルド生成物だが `.gitignore` に未登録（追加推奨）
- 本番デプロイの試行錯誤の経緯：
  - 旧 Vercel プロジェクト `realestate-dx` は `experimentalServices` 設定で壊れていたため `vercel.json` を削除
  - 新規 `realestate-dx-frontend-app` プロジェクトを `frontend/` 直下から再デプロイする運用に切替
  - Backend は当初 Native runtime で失敗 → Docker runtime に切替で安定

---

## 3. ディレクトリ構造（補足）

```
realestate-dx/
├── frontend/             # Next.js 15 アプリ（Vercel デプロイ）
│   ├── src/
│   │   ├── app/          # App Router ルート
│   │   ├── components/   # UI コンポーネント
│   │   └── middleware.ts # 認証ミドルウェア（要確認の未コミット修正あり）
│   └── package.json
│
├── backend/              # Hono API サーバー（Render デプロイ）
│   ├── src/
│   ├── prisma/
│   │   ├── schema.prisma # DB スキーマ
│   │   └── migrations/   # マイグレーション履歴
│   └── Dockerfile
│
├── chrome-extension/     # iimon 物件取込（完成）
├── extension/            # SUUMO 自動投稿（完成）
├── db/                   # DB 初期化スクリプト
├── docs/                 # 設計書（architecture / db-schema / auth-design / tech-stack）
├── docker-compose.yml    # ローカル DB + 全サービス
├── render.yaml           # Render デプロイ設定
└── .env.example          # 環境変数テンプレート
```

---

## 4. 環境変数・シークレット

`README.md` の「環境変数」セクションに項目一覧があります。**実際の値は別途 1Password / 暗号化チャネルで共有します**。

引き継ぎ時に共有するファイル一覧：

| ファイル | 用途 |
|---|---|
| `.env` | ルート用（docker compose 用） |
| `backend/.env` | Backend ローカル起動用 |
| `frontend/.env.local` | Frontend ローカル起動用 |
| Render 環境変数（Backend本番） | Render ダッシュボードに登録済み（要メンバー招待） |
| Vercel 環境変数（Frontend本番） | Vercel ダッシュボードに登録済み（要チーム招待） |

⚠️ `.env` 系は Git にコミットしないでください（`.gitignore` 設定済み）。

---

## 5. 外部サービス・アカウント

| サービス | 用途 | 引き継ぎ方法 |
|---|---|---|
| GitHub | ソースコード | リポジトリの Collaborator 招待 |
| Vercel | Frontend ホスティング | チーム招待 or プロジェクト Transfer |
| Render | Backend ホスティング | チーム招待（API キーは `/tmp/deploy-overnight/tokens.env` に記録） |
| Neon (or Render PostgreSQL) | 本番 DB | 接続文字列を 1Password で共有 |
| Cloudflare R2 | ファイルストレージ | アクセスキーを 1Password で共有 |
| Upstash Redis | キャッシュ | 接続文字列を 1Password で共有 |
| Anthropic Claude API | AI チャット・提案エンジン | API キー共有 or 別途発行 |
| Replicate | バーチャルステージング | API トークン共有 |
| iimon（業者アカウント） | 物件取込 | ログイン情報を 1Password で共有（業者契約の名義は別途確認） |
| SUUMO（業者管理画面） | 自動投稿 | 同上 |

---

## 6. ローカル起動の確認手順

```bash
# 1. リポジトリ取得（招待後）
git clone https://github.com/kiddelta298-a11y/realestate-dx.git
cd realestate-dx

# 2. 環境変数ファイルを配置（別チャネルで受領した .env を配置）
#    .env / backend/.env / frontend/.env.local

# 3. DB を Docker で起動
docker compose up -d db

# 4. Backend 起動
cd backend
npm install
npx prisma migrate dev    # 初回のみ
npm run dev               # → http://localhost:3001

# 5. Frontend 起動（別ターミナル）
cd frontend
npm install
npm run dev               # → http://localhost:3000
```

動作確認：
- http://localhost:3000 でログイン画面表示
- バックエンド `GET /health` が 200 を返す（`curl http://localhost:3001/health`）
- Prisma Studio で DB 内容確認 → `cd backend && npx prisma studio`

---

## 7. デプロイ運用メモ

### Frontend（Vercel）
- プロジェクト名: `realestate-dx-frontend-app`
- ルート: `frontend/`
- Production Branch: `main`
- 環境変数: `NEXT_PUBLIC_API_URL` 等を Vercel ダッシュボードに登録済み

### Backend（Render）
- プロジェクト名: `realestate-dx-backend`
- ランタイム: Docker（`backend/Dockerfile`）
- Branch: `main`
- 環境変数（Render ダッシュボードで設定）:
  - `DATABASE_URL`（本番 PostgreSQL）
  - `JWT_SECRET`（自動生成）
  - `IIMON_API_KEY` / `SUUMO_API_KEY` / `REPLICATE_API_TOKEN` 等

### DB マイグレーション
本番反映：
```bash
DATABASE_URL=<本番URL> npx prisma migrate deploy
```
**注意**: 本番に対する `migrate dev` は禁止（差分マイグレーションが意図せず生成される）。

---

## 8. Chrome 拡張機能

`README.md` の「Chrome 拡張機能」参照。**社内 Chrome Web Store には未公開**で、`chrome://extensions/` から非パッケージ読込で運用しています。

将来的に Web Store 公開する場合：
- 開発者アカウント（5ドル）
- プライバシーポリシーURL
- スクリーンショット
が必要。

---

## 9. ドキュメント一覧（`docs/`）

| ファイル | 内容 |
|---|---|
| `architecture.md` | 全体アーキテクチャ（FE/BE/DB/外部サービスの関係図） |
| `db-schema.md` | DB スキーマ設計（テーブル構造・リレーション） |
| `auth-design.md` | 認証・マルチテナント設計（NextAuth.js 構成） |
| `tech-stack.md` | 技術選定の経緯と他候補との比較 |
| `google-apps-script.js` | （補助スクリプト・必要に応じて確認） |

---

## 10. 引き継ぎ後の優先タスク（推奨順）

1. ローカル環境を立ち上げて全体動作を確認
2. `docs/architecture.md` と `db-schema.md` を読んで全体像を把握
3. 未コミットの `frontend/src/middleware.ts` の内容確認・取り扱い決定
4. Phase 2-4 の FE → 実 API 切替（mock 残箇所を `frontend/src/` で grep）
5. iimon 自動投稿 Chrome 拡張の着手
6. テスト整備（最低限、認証・申込フローの E2E）
7. 監視（Sentry 等）の組込み

---

## 11. 連絡先

引き継ぎ後の不明点は元担当（ryota.suzuki@himawari-hldgs.com）まで。
