# 不動産DXプラットフォーム 技術スタック決定書

## 選定結果サマリ

| レイヤー | 選定技術 | 理由 |
|---|---|---|
| フロントエンド | **Next.js 15 (App Router)** | SSR/SSG対応、React Server Components、高速な初回表示 |
| APIサーバー | **Hono** | 軽量・高速、Edge対応、型安全ミドルウェア |
| DB | **PostgreSQL 16** | マルチテナントRLS、JSONB、全文検索、実績 |
| ORM | **Prisma 6** | 型安全クエリ、マイグレーション管理、RLS対応 |
| 認証 | **NextAuth.js v5 + カスタムプロバイダー** | マルチテナント対応、JWTベース |
| AI/LLM | **Claude API (Anthropic)** | 日本語対応品質、tool use、長文コンテキスト |
| リアルタイム通信 | **WebSocket (Hono WSアダプタ)** | AIチャット双方向通信 |
| キャッシュ | **Redis (Upstash)** | セッション、レート制限、物件検索キャッシュ |
| ファイルストレージ | **Cloudflare R2** | S3互換、低コスト、画像・PDF保管 |
| デプロイ | **Vercel (FE) + Fly.io (API)** | エッジ配信、日本リージョン対応 |
| モノレポ管理 | **Turborepo** | ビルドキャッシュ、パッケージ間依存管理 |
| UIコンポーネント | **shadcn/ui + Tailwind CSS v4** | カスタマイズ性、アクセシビリティ |
| バリデーション | **Zod** | ランタイム型検証、フロント/バック共有スキーマ |
| テスト | **Vitest + Playwright** | 高速ユニットテスト + E2Eテスト |

## 比較検討

### フロントエンドフレームワーク

| 項目 | Next.js 15 | Remix | SvelteKit |
|---|---|---|---|
| 学習コスト | 中（React経験者多い） | 中 | 高（Svelte人材少ない） |
| エコシステム | ◎ 最大 | ○ 成長中 | △ 小さい |
| SSR/SSG | ◎ RSC対応 | ○ loader/action | ○ |
| 日本語情報 | ◎ 豊富 | △ 少ない | △ 少ない |
| マルチテナント | ◎ middleware対応 | ○ | ○ |
| **判定** | **採用** | 見送り | 見送り |

**選定理由**: React Server Componentsによるサーバーサイドでのデータフェッチ最適化、middleware でのテナント判定、日本語ドキュメント・人材の豊富さ。不動産業界の管理画面は複雑なフォームが多く、Reactエコシステムの恩恵が大きい。

### APIフレームワーク

| 項目 | Hono | Express | Fastify |
|---|---|---|---|
| パフォーマンス | ◎ 最速クラス | △ 低速 | ○ 高速 |
| 型安全性 | ◎ ネイティブTS | △ 要追加設定 | ○ |
| Edgeランタイム | ◎ 対応 | × 非対応 | × 非対応 |
| ミドルウェア | ◎ 豊富 | ◎ 最大 | ○ |
| バンドルサイズ | ◎ 14KB | △ 大 | △ 中 |
| **判定** | **採用** | 見送り | 見送り |

**選定理由**: マルチテナント認証ミドルウェアを型安全に実装可能。Edgeでの実行オプションがあり将来のレイテンシ最適化に有利。Zod連携によるリクエスト/レスポンスのバリデーションが容易。

### データベース

| 項目 | PostgreSQL | MySQL 8 | PlanetScale (MySQL) |
|---|---|---|---|
| RLS (Row Level Security) | ◎ ネイティブ | × 非対応 | × 非対応 |
| JSONB | ◎ | △ JSON型のみ | △ |
| 全文検索(日本語) | ○ pg_bigm | △ 要外部 | △ |
| マルチテナント | ◎ RLS最適 | △ アプリ層で実装 | △ |
| Prisma対応 | ◎ | ◎ | ◎ |
| **判定** | **採用** | 見送り | 見送り |

**選定理由**: Row Level Security (RLS) によりDB層でテナント分離を強制できる。物件データの柔軟な属性管理にJSONBが有用。pg_bigmで日本語全文検索も対応可能。

## モノレポ構成

```
realestate-dx/
├── apps/
│   ├── web/           # Next.js 15 (テナント向けWebアプリ)
│   └── api/           # Hono (REST API サーバー)
├── packages/
│   ├── db/            # Prisma スキーマ + クライアント
│   ├── shared/        # 共有型定義 + Zodスキーマ + 定数
│   ├── ai/            # AIチャット・物件提案エンジン
│   └── ui/            # shadcn/ui カスタムコンポーネント
├── turbo.json
├── package.json
└── docs/              # 設計ドキュメント
```

## 環境要件

| 項目 | 開発 | 本番 |
|---|---|---|
| Node.js | 22 LTS | 22 LTS |
| PostgreSQL | 16 (Docker) | Neon or Supabase |
| Redis | Upstash (free tier) | Upstash (Pro) |
| OS | WSL2 / macOS | Linux (Fly.io) |
