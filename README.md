# 不動産DX Platform

不動産管理・仲介プラットフォーム（イタンジ代替）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Next.js 15 (App Router) |
| Backend | Hono |
| DB | PostgreSQL 16 + Prisma |
| Container | Docker Compose |

## セットアップ

```bash
# 環境変数を設定
cp .env.example .env

# コンテナ起動
docker compose up -d

# DBマイグレーション（初回）
cd backend && npx prisma migrate dev
```

## アクセス

| サービス | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| DB | localhost:5432 |

## 開発

```bash
# 全サービス起動
docker compose up

# ログ確認
docker compose logs -f backend

# DB管理画面
cd backend && npx prisma studio
```
