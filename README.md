# 不動産DX Platform

賃貸仲介CRM・申込・契約・管理業務を一気通貫でデジタル化する不動産DXプラットフォーム（イタンジ代替）。

## 機能一覧

| フェーズ | 機能 | 状態 |
|---|---|---|
| Phase 0 | 技術スタック・DB設計・Docker環境構築 | ✅ 完了 |
| Phase 1 | CRM基盤・時間外AIチャット・代替物件提案 | ✅ 完了 |
| Phase 2 | 高精度物件提案エンジン・追客自動化・LINE統合 | ✅ 完了 |
| Phase 3 | Web申込・電子契約・内見カレンダー | ✅ 完了 |
| Phase 4 | 賃貸管理BO・物件掲載入力自動化 | ✅ 完了 |
| Phase 5 | 売買対応・来店率分析・切り返しAI | ✅ 完了 |
| Chrome拡張 | iimon物件情報取込（Chrome拡張） | ✅ 完了 |
| Chrome拡張 | SUUMO自動投稿（Chrome拡張） | ✅ 完了 |
| 残作業 | Phase2-4 FE→実API切替 | 🔄 未完了 |
| 残作業 | iimon自動投稿 Chrome拡張 | 🔄 未完了 |
| 残作業 | 本番デプロイ（Render + Vercel） | 🔄 進行中 |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Hono |
| DB | PostgreSQL 16 + pgvector + Prisma 6 |
| Auth | NextAuth.js v5（JWTベース・マルチテナント対応） |
| AI | Claude API (Anthropic) |
| リアルタイム | WebSocket (Hono WS) |
| キャッシュ | Redis (Upstash) |
| ストレージ | Cloudflare R2 |
| Container | Docker Compose |
| Deploy | Vercel (FE) + Render (BE) |

## ディレクトリ構造

```
realestate-dx/
├── frontend/           # Next.js 15 アプリ
├── backend/            # Hono API サーバー
│   └── prisma/         # DB スキーマ・マイグレーション
├── chrome-extension/   # iimon 物件取込 Chrome拡張
├── extension/          # SUUMO 自動投稿 Chrome拡張
├── db/                 # DB 初期化スクリプト
├── docs/               # 設計書・アーキテクチャ資料
├── docker-compose.yml  # ローカル開発用コンテナ構成
├── render.yaml         # Render デプロイ設定
├── .env                # 環境変数（ルート）
└── .env.example        # 環境変数テンプレート
```

## ローカル開発環境セットアップ

### 前提条件

- Docker Desktop
- Node.js 20+
- npm / pnpm

### 手順

```bash
# 1. リポジトリ取得
git clone <repo-url>
cd realestate-dx

# 2. 環境変数を設定
cp .env.example .env
# .env を編集（下記「環境変数」セクション参照）

# 3. コンテナ起動（DB）
docker compose up -d db

# 4. バックエンド起動
cd backend
cp ../.env.example .env   # backend/.env も必要
npm install
npx prisma migrate dev    # 初回のみ
npm run dev

# 5. フロントエンド起動（別ターミナル）
cd frontend
npm install
npm run dev
```

### アクセス先

| サービス | URL |
|---|---|
| フロントエンド | http://localhost:3000 |
| バックエンド API | http://localhost:3001 |
| DB (PostgreSQL) | localhost:5433 |
| Prisma Studio | `cd backend && npx prisma studio` |

### よく使うコマンド

```bash
# 全サービスをコンテナで起動
docker compose up

# ログ確認
docker compose logs -f backend

# DB マイグレーション追加
cd backend && npx prisma migrate dev --name <migration-name>

# シードデータ投入
cd backend && npx prisma db seed
```

## 環境変数

`.env.example` をコピーして `.env` を作成し、以下を設定してください。

| 変数名 | 説明 | 例 |
|---|---|---|
| `POSTGRES_USER` | DB ユーザー名 | `realestate` |
| `POSTGRES_PASSWORD` | DB パスワード | `realestate_dev` |
| `POSTGRES_DB` | DB 名 | `realestate_dx` |
| `DB_PORT` | DB ポート | `5433` |
| `DATABASE_URL` | Prisma 接続文字列 | `postgresql://...` |
| `BACKEND_PORT` | バックエンドポート | `3001` |
| `JWT_SECRET` | JWT 署名キー | ランダム文字列 |
| `NEXT_PUBLIC_API_URL` | バックエンド URL | `http://localhost:3001` |
| `IIMON_EMAIL` | iimon ログイン email | - |
| `IIMON_PASSWORD` | iimon ログインパスワード | - |
| `SUUMO_EMAIL` | SUUMO 管理画面 email | - |
| `SUUMO_PASSWORD` | SUUMO 管理画面パスワード | - |
| `REPLICATE_API_TOKEN` | バーチャルステージング API | - |

`backend/.env` にも以下が必要です：

```env
DATABASE_URL=postgresql://realestate:realestate_dev@localhost:5433/realestate_dx
NODE_ENV=development
PORT=3001
```

## Chrome 拡張機能

### iimon 物件取込（`chrome-extension/`）

iimon（いいもん）の物件情報を本システムに取り込む拡張機能。

**インストール方法**:
1. Chrome → `chrome://extensions/` を開く
2. 「デベロッパーモード」ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `chrome-extension/` を選択

### SUUMO 自動投稿（`extension/`）

本システムの物件情報を SUUMO 管理画面に自動入力する拡張機能。

**インストール方法**: 上記と同様、`extension/` フォルダを選択。

## デプロイ

### フロントエンド（Vercel）

- Vercel プロジェクトに `frontend/` を接続
- 環境変数: `NEXT_PUBLIC_API_URL`（Render の URL）を設定

### バックエンド（Render）

- `render.yaml` が設定済み
- Render ダッシュボードで以下の環境変数を手動設定：
  - `DATABASE_URL`（Neon または外部 PostgreSQL の接続文字列）
  - `IIMON_API_KEY`
  - `SUUMO_API_KEY`
  - `REPLICATE_API_TOKEN`
- `JWT_SECRET` は Render が自動生成

### DB（本番）

本番 DB は Neon（PostgreSQL as a Service）を推奨。  
Neon の接続文字列を `DATABASE_URL` に設定し、初回デプロイ後にマイグレーションを実行：

```bash
DATABASE_URL=<neon-url> npx prisma migrate deploy
```

## 設計資料

`docs/` に以下のドキュメントがあります：

| ファイル | 内容 |
|---|---|
| `architecture.md` | システム全体アーキテクチャ |
| `db-schema.md` | DB スキーマ設計 |
| `tech-stack.md` | 技術選定の経緯と比較 |
| `auth-design.md` | 認証・マルチテナント設計 |
