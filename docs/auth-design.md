# 不動産DXプラットフォーム 認証設計書

## 概要

マルチテナント（会社単位データ分離）の認証・認可システム。
担当者向けの管理画面認証と、顧客向けのチャット認証の2系統を設計する。

## 認証アーキテクチャ

```
[担当者ブラウザ] → [Next.js Middleware] → テナント判定
                        ↓
                  [NextAuth.js v5]
                        ↓
                  [JWT + Session]
                        ↓
                  [Hono API] → RLS (company_id) → [PostgreSQL]
```

## テナント識別方式

**方式**: サブドメイン + カスタムドメイン

| パターン | 例 | 用途 |
|---|---|---|
| サブドメイン | `abc-fudosan.app.realestate-dx.com` | 標準 |
| カスタムドメイン | `crm.abc-fudosan.co.jp` | Premium プラン |

### テナント解決フロー

```
1. リクエスト受信
2. Next.js Middleware でホスト名を取得
3. サブドメインまたはカスタムドメインからテナントslugを解決
4. companies テーブルから company_id を取得（キャッシュ: Redis, TTL 5min）
5. company_id をリクエストコンテキストに注入
```

## 担当者認証 (管理画面)

### 認証フロー

```
1. /login にアクセス
2. メール + パスワードで認証 (Credentials Provider)
3. NextAuth.js が JWT を発行
   - payload: { sub: user_id, company_id, role, name }
4. JWT を httpOnly cookie に保存
5. API リクエスト時に Authorization ヘッダーに JWT を付与
6. Hono ミドルウェアで JWT を検証
7. SET app.current_company_id でRLSを有効化
```

### JWT ペイロード

```typescript
interface JWTPayload {
  sub: string;          // user.id (UUID)
  company_id: string;   // company.id (UUID)
  role: 'admin' | 'manager' | 'agent';
  name: string;
  iat: number;
  exp: number;          // 24時間
}
```

### パスワード管理

- ハッシュ: **bcrypt** (cost factor 12)
- 最小長: 8文字
- パスワードリセット: メールベースのワンタイムトークン (有効期限 1時間)

### セッション管理

| 項目 | 値 |
|---|---|
| 方式 | JWT (Stateless) |
| 保存先 | httpOnly, Secure, SameSite=Lax cookie |
| 有効期限 | アクセストークン: 24時間 |
| リフレッシュ | Sliding window (アクティブなら自動延長) |
| 同時セッション | 制限なし（デバイス横断） |

## 顧客認証 (チャット)

### Web チャット

```
1. 顧客がWebチャットウィジェットにアクセス
2. 初回: メール or 電話番号で簡易登録
3. セッショントークン発行 (JWT, 7日間有効)
4. 以降はトークンベースで自動認証
```

### LINE 連携 (Phase2)

```
1. LINE Messaging API Webhook でメッセージ受信
2. line_user_id で customers テーブルを検索
3. 未登録なら自動作成
4. 対応するchat_sessionにルーティング
```

## 認可 (RBAC)

### ロール定義

| ロール | 説明 | 権限 |
|---|---|---|
| admin | 管理者 | 全操作 + テナント設定 + ユーザー管理 |
| manager | マネージャー | 全顧客・全物件 + レポート閲覧 |
| agent | 担当者 | 自分の担当顧客 + 全物件閲覧 |

### API エンドポイント別権限

| エンドポイント | admin | manager | agent |
|---|---|---|---|
| GET /users | ○ | ○ | × |
| POST /users | ○ | × | × |
| GET /customers | 全件 | 全件 | 担当のみ |
| GET /properties | ○ | ○ | ○ |
| POST /properties | ○ | ○ | × |
| GET /applications | 全件 | 全件 | 担当のみ |
| PATCH /company/settings | ○ | × | × |

### Hono ミドルウェア実装方針

```typescript
// テナント分離ミドルウェア
const tenantMiddleware = createMiddleware(async (c, next) => {
  const jwt = c.get('jwtPayload');
  // Prisma の $executeRaw で RLS の company_id をセット
  await prisma.$executeRawUnsafe(
    `SET app.current_company_id = '${jwt.company_id}'`
  );
  c.set('companyId', jwt.company_id);
  await next();
});

// ロールベース認可ミドルウェア
const requireRole = (...roles: Role[]) =>
  createMiddleware(async (c, next) => {
    const jwt = c.get('jwtPayload');
    if (!roles.includes(jwt.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
```

## RLS (Row Level Security) 設計

### ポリシー定義

```sql
-- 全テナント共通のRLSポリシーテンプレート
-- 各テーブルに適用

-- SELECT: 自テナントのみ
CREATE POLICY tenant_select ON {table}
  FOR SELECT USING (company_id = current_setting('app.current_company_id')::uuid);

-- INSERT: 自テナントのみ
CREATE POLICY tenant_insert ON {table}
  FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id')::uuid);

-- UPDATE: 自テナントのみ
CREATE POLICY tenant_update ON {table}
  FOR UPDATE USING (company_id = current_setting('app.current_company_id')::uuid);

-- DELETE: 自テナントのみ
CREATE POLICY tenant_delete ON {table}
  FOR DELETE USING (company_id = current_setting('app.current_company_id')::uuid);
```

### DBユーザー構成

| ユーザー | 用途 | RLS |
|---|---|---|
| `app_user` | アプリケーション用 | 有効 |
| `migration_user` | マイグレーション用 | 無効 (BYPASSRLS) |
| `readonly_user` | 分析用 | 有効 |

## AIチャット認証フロー

```
[顧客] → [WebSocket接続]
              ↓
         [JWT検証 (session token)]
              ↓
         [company_id + customer_id 確認]
              ↓
         [営業時間判定]
              ↓
    ┌─── 営業時間内 ──→ [担当者に通知 + AI下書き]
    └─── 営業時間外 ──→ [AI自動対応モード]
                              ↓
                         [物件提案・質問応答]
                              ↓
                         [翌営業日に担当者へサマリ通知]
```

## セキュリティ対策

| 脅威 | 対策 |
|---|---|
| テナント間データ漏洩 | RLS + アプリ層ダブルチェック |
| JWT 盗難 | httpOnly cookie, Secure, SameSite=Lax |
| CSRF | SameSite cookie + CSRFトークン |
| ブルートフォース | ログイン試行回数制限 (Redis, 5回/15分) |
| SQLインジェクション | Prisma (パラメータ化クエリ) |
| XSS | CSP ヘッダー, Next.js のデフォルトエスケープ |
| 権限昇格 | サーバーサイドロールチェック (JWTのrole) |
