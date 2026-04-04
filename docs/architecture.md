# 不動産DXプラットフォーム アーキテクチャ設計書

## システム全体像

```
                    ┌─────────────────────────────┐
                    │       CDN (Vercel Edge)      │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │   Next.js 15 (App Router)    │
                    │   - テナント判定 Middleware   │
                    │   - SSR / RSC                │
                    │   - WebSocket プロキシ        │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │      Hono API Server         │
                    │   - REST API (/api/v1/*)     │
                    │   - WebSocket (チャット)      │
                    │   - 認証ミドルウェア          │
                    │   - RLS セッション管理        │
                    └──┬──────────┬────────────┬──┘
                       │          │            │
              ┌────────▼──┐  ┌───▼────┐  ┌───▼──────┐
              │ PostgreSQL │  │ Redis  │  │ Claude   │
              │ + pgvector │  │(Upstash│  │ API      │
              │ + RLS      │  │)       │  │(Anthropic│
              └────────────┘  └────────┘  └──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  AI Engine          │
                                    │  - 物件提案          │
                                    │  - チャット応答       │
                                    │  - 返信下書き生成     │
                                    └─────────────────────┘
```

## モノレポ構成

```
realestate-dx/
├── apps/
│   ├── web/                    # Next.js 15
│   │   ├── app/
│   │   │   ├── (auth)/         # 認証ページ (login, register)
│   │   │   ├── (dashboard)/    # 管理画面
│   │   │   │   ├── customers/  # 顧客管理
│   │   │   │   ├── properties/ # 物件管理
│   │   │   │   ├── chat/       # チャット
│   │   │   │   ├── applications/ # 申込管理
│   │   │   │   ├── tasks/      # タスク管理
│   │   │   │   └── settings/   # テナント設定
│   │   │   ├── api/            # Next.js API routes (認証のみ)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   ├── middleware.ts       # テナント判定
│   │   └── next.config.ts
│   │
│   └── api/                    # Hono API サーバー
│       ├── src/
│       │   ├── index.ts        # エントリポイント
│       │   ├── routes/
│       │   │   ├── customers.ts
│       │   │   ├── properties.ts
│       │   │   ├── applications.ts
│       │   │   ├── chat.ts     # WebSocket + REST
│       │   │   ├── tasks.ts
│       │   │   ├── proposals.ts
│       │   │   └── users.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts     # JWT検証
│       │   │   ├── tenant.ts   # RLSセッション設定
│       │   │   └── rbac.ts     # ロールベース認可
│       │   ├── services/
│       │   │   ├── ai-chat.ts
│       │   │   ├── proposal-engine.ts
│       │   │   └── notification.ts
│       │   └── ws/
│       │       └── chat-handler.ts
│       └── Dockerfile
│
├── packages/
│   ├── db/                     # Prismaスキーマ + クライアント
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── client.ts       # Prisma Client (RLS対応)
│   │       └── index.ts
│   │
│   ├── shared/                 # 共有定義
│   │   └── src/
│   │       ├── types/          # 共有型定義
│   │       ├── schemas/        # Zod バリデーションスキーマ
│   │       ├── constants/      # 定数 (ステータス、ロール等)
│   │       └── utils/          # 共有ユーティリティ
│   │
│   ├── ai/                     # AIエンジン
│   │   └── src/
│   │       ├── chat/
│   │       │   ├── agent.ts         # チャットエージェント
│   │       │   ├── tools.ts         # tool use 定義
│   │       │   └── reply-style.ts   # 担当者スタイル適用
│   │       ├── proposal/
│   │       │   ├── engine.ts        # 物件提案エンジン
│   │       │   ├── scoring.ts       # マッチスコア算出
│   │       │   └── alternative.ts   # 代替物件提案
│   │       └── embedding/
│   │           └── generator.ts     # ベクトル生成
│   │
│   └── ui/                     # UIコンポーネント
│       └── src/
│           ├── components/     # shadcn/ui ベースコンポーネント
│           └── hooks/          # 共有 React Hooks
│
├── docs/                       # 設計ドキュメント
│   ├── tech-stack.md
│   ├── db-schema.md
│   ├── auth-design.md
│   └── architecture.md         # このファイル
│
├── turbo.json
├── package.json
├── .env.example
└── docker-compose.yml          # 開発用 (PostgreSQL + Redis)
```

## AIエンジン設計

### 24時間チャット自動対応

```
[顧客メッセージ受信]
       ↓
[営業時間判定] ──営業時間内──→ [担当者に通知]
       │                           ↓
       │                    [AI下書き生成] → [担当者確認画面]
       │                           ↓
    営業時間外               [担当者が承認/編集/棄却]
       ↓
[AI自動対応モード]
       ↓
[Claude API (tool use)]
  ├── search_properties: 物件検索
  ├── get_customer_preferences: 希望条件取得
  ├── check_availability: 空き状況確認
  ├── schedule_viewing: 内見予約 (Phase3)
  └── escalate_to_human: 人間にエスカレーション
       ↓
[返信スタイル適用] ← user.reply_style (担当者のトーン)
       ↓
[顧客に送信]
```

### 高精度物件提案エンジン

```
[提案トリガー]
  ├── 顧客登録時 (初回提案)
  ├── 希望条件更新時
  ├── 新着物件登録時
  └── 申込済み物件のステータス変更時
       ↓
[顧客希望条件ベクトル取得]
       ↓
[pgvector コサイン類似検索]
  + フィルタ条件 (予算、エリア、間取り)
  + must/NG 条件のハード制約
       ↓
[スコアリング]
  - ベクトル類似度: 60%
  - 条件一致率: 25%
  - 新着ボーナス: 10%
  - 担当者推薦ブースト: 5%
       ↓
[上位N件を提案候補に]
       ↓
[Claude API でマッチ理由文を生成]
       ↓
[property_proposals に保存]
```

### 申込済み物件の即時代替提案

```
[申込ステータス → rejected/cancelled]
       ↓
[当該顧客の希望条件を取得]
       ↓
[元物件の特徴を考慮した検索]
  - 元物件と類似 BUT 異なる物件
  - status = 'available' のみ
       ↓
[代替提案を生成]
  - is_alternative = true
  - replaced_property_id = 元物件ID
       ↓
[顧客に通知 (チャット or メール)]
```

## API設計 (主要エンドポイント)

### ベースURL
`/api/v1`

### エンドポイント一覧

| メソッド | パス | 概要 | Phase |
|---|---|---|---|
| POST | /auth/login | ログイン | 0 |
| POST | /auth/refresh | トークン更新 | 0 |
| GET | /customers | 顧客一覧 | 1 |
| POST | /customers | 顧客登録 | 1 |
| GET | /customers/:id | 顧客詳細 | 1 |
| PATCH | /customers/:id | 顧客更新 | 1 |
| PUT | /customers/:id/preferences | 希望条件更新 | 1 |
| GET | /properties | 物件一覧 (検索) | 1 |
| POST | /properties | 物件登録 | 1 |
| GET | /properties/:id | 物件詳細 | 1 |
| PATCH | /properties/:id | 物件更新 | 1 |
| GET | /applications | 申込一覧 | 1 |
| POST | /applications | 申込作成 | 1 |
| PATCH | /applications/:id/status | 申込ステータス更新 | 1 |
| GET | /chat/sessions | チャットセッション一覧 | 1 |
| GET | /chat/sessions/:id/messages | メッセージ取得 | 1 |
| WS | /chat/ws | WebSocketチャット | 1 |
| GET | /proposals/:customerId | 提案一覧 | 1 |
| POST | /proposals/generate | 提案生成 (AI) | 1 |
| GET | /tasks | タスク一覧 | 1 |
| POST | /tasks | タスク作成 | 1 |
| PATCH | /tasks/:id | タスク更新 | 1 |
| GET | /users | ユーザー一覧 | 0 |
| POST | /users | ユーザー作成 | 0 |
| PATCH | /company/settings | テナント設定更新 | 0 |

### レスポンス共通形式

```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```

### エラーレスポンス

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "賃料は0以上で入力してください",
    "details": [...]
  }
}
```

## 開発環境セットアップ

```bash
# 1. リポジトリクローン
git clone <repo-url> && cd realestate-dx

# 2. 依存インストール
pnpm install

# 3. 環境変数
cp .env.example .env.local

# 4. DB起動
docker compose up -d

# 5. マイグレーション + シード
pnpm db:migrate && pnpm db:seed

# 6. 開発サーバー
pnpm dev
```

## Phase別実装計画

| Phase | 主要機能 | 関連テーブル | 担当大臣 |
|---|---|---|---|
| 0 | 設計・環境構築・認証基盤 | companies, users | arch, infra |
| 1 | CRM + AIチャット + 提案エンジン | customers, properties, chat_*, proposals, applications | fe, be, ai |
| 2 | LINE統合 + 追客自動化 | customers (line_user_id), tasks | be, ai, mob |
| 3 | Web申込 + 電子契約 + 内見 | applications拡張, 新テーブル | fe, be |
| 4 | 管理バックオフィス + 物件入力自動化 | properties拡張 | fe, be, ai |
| 5 | 売買対応 + 分析 | 新テーブル群 | 全大臣 |
