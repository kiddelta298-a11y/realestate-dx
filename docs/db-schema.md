# 不動産DXプラットフォーム DBスキーマ設計書

## ER図（テキスト）

```
Company (会社テナント)
  ||--o{ User         : "has many"
  ||--o{ Property     : "has many"
  ||--o{ Customer     : "has many"
  ||--o{ Application  : "has many"
  ||--o{ Task         : "has many"

User (担当者)
  ||--o{ Customer     : "担当"
  ||--o{ Task         : "assigned"
  ||--o{ ChatSession  : "参加"
  ||--o{ Application  : "担当"

Customer (顧客)
  ||--o{ ChatSession  : "has many"
  ||--o{ Application  : "has many"
  ||--o{ CustomerPreference : "has one"
  ||--o{ PropertyProposal   : "has many"

Property (物件)
  ||--o{ Application       : "has many"
  ||--o{ PropertyProposal  : "proposed in"
  ||--o{ PropertyImage     : "has many"

ChatSession (チャットセッション)
  ||--o{ ChatMessage : "has many"

Application (申込)
  ||--o{ ApplicationStatusHistory : "has many"
```

## マルチテナント戦略

**方式**: 共有DB + RLS (Row Level Security)

全テーブルに `company_id` カラムを持たせ、PostgreSQL の RLS ポリシーでアクセス制御。

```sql
-- RLS有効化（全テーブル共通パターン）
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON properties
  USING (company_id = current_setting('app.current_company_id')::uuid);
```

Prisma からは `SET app.current_company_id` をトランザクション開始時にセット。

## テーブル定義

### companies (会社テナント)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | テナントID |
| name | VARCHAR(255) | NOT NULL | 会社名 |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URLスラグ（サブドメイン用） |
| plan | VARCHAR(50) | NOT NULL, DEFAULT 'trial' | 契約プラン (trial/standard/premium) |
| settings | JSONB | DEFAULT '{}' | テナント固有設定（営業時間、AI応答トーン等） |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新日時 |

### users (担当者)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | 担当者ID |
| company_id | UUID | FK → companies.id, NOT NULL | 所属会社 |
| email | VARCHAR(255) | NOT NULL | メールアドレス |
| name | VARCHAR(100) | NOT NULL | 氏名 |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'agent' | 役割 (admin/manager/agent) |
| avatar_url | TEXT | | プロフィール画像URL |
| reply_style | JSONB | DEFAULT '{}' | 担当者固有の返信スタイル設定 |
| is_active | BOOLEAN | DEFAULT true | 有効フラグ |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**UNIQUE**: (company_id, email)

### customers (顧客)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | 顧客ID |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| assigned_user_id | UUID | FK → users.id | 担当者 |
| name | VARCHAR(100) | NOT NULL | 氏名 |
| email | VARCHAR(255) | | メール |
| phone | VARCHAR(20) | | 電話番号 |
| line_user_id | VARCHAR(100) | | LINE ユーザーID (Phase2) |
| source | VARCHAR(50) | DEFAULT 'web' | 流入経路 (web/suumo/homes/line/walk_in) |
| status | VARCHAR(50) | DEFAULT 'active' | ステータス (active/contracted/lost) |
| notes | TEXT | | 備考 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### customer_preferences (顧客希望条件)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| customer_id | UUID | FK → customers.id, UNIQUE, NOT NULL | 顧客 |
| budget_min | INTEGER | | 予算下限（万円） |
| budget_max | INTEGER | | 予算上限（万円） |
| area_ids | TEXT[] | | 希望エリア（市区町村コード配列） |
| station_ids | TEXT[] | | 希望駅（駅コード配列） |
| walk_minutes_max | INTEGER | | 徒歩分数上限 |
| room_layout | TEXT[] | | 間取り (1K, 1LDK, 2LDK 等) |
| floor_area_min | DECIMAL(6,2) | | 最小面積(m2) |
| move_in_date | DATE | | 入居希望日 |
| must_conditions | JSONB | DEFAULT '[]' | 必須条件 (ペット可, オートロック等) |
| nice_conditions | JSONB | DEFAULT '[]' | 希望条件 |
| ng_conditions | JSONB | DEFAULT '[]' | NG条件 |
| embedding | VECTOR(384) | | 希望条件ベクトル（物件マッチング用） |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### properties (物件)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | 物件ID |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| external_id | VARCHAR(100) | | 外部物件ID（ポータル連携用） |
| name | VARCHAR(255) | NOT NULL | 物件名 |
| property_type | VARCHAR(50) | NOT NULL | 種別 (apartment/mansion/house/office) |
| address | VARCHAR(500) | NOT NULL | 住所 |
| latitude | DECIMAL(9,6) | | 緯度 |
| longitude | DECIMAL(9,6) | | 経度 |
| nearest_station | VARCHAR(100) | | 最寄駅 |
| walk_minutes | INTEGER | | 徒歩分数 |
| rent | INTEGER | NOT NULL | 賃料（円） |
| management_fee | INTEGER | DEFAULT 0 | 管理費（円） |
| deposit | INTEGER | DEFAULT 0 | 敷金（円） |
| key_money | INTEGER | DEFAULT 0 | 礼金（円） |
| room_layout | VARCHAR(20) | | 間取り |
| floor_area | DECIMAL(6,2) | | 面積(m2) |
| floor | INTEGER | | 階数 |
| total_floors | INTEGER | | 総階数 |
| built_year | INTEGER | | 築年 |
| available_from | DATE | | 入居可能日 |
| features | JSONB | DEFAULT '[]' | 設備・特徴 (オートロック, 宅配BOX等) |
| description | TEXT | | 物件説明 |
| status | VARCHAR(50) | DEFAULT 'available' | 状態 (available/reserved/contracted/unavailable) |
| embedding | VECTOR(384) | | 物件特徴ベクトル（提案マッチング用） |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**INDEX**: (company_id, status), (company_id, rent), (company_id, nearest_station)
**GiST INDEX**: embedding (ベクトル検索用)

### property_images (物件画像)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| property_id | UUID | FK → properties.id, NOT NULL | 物件 |
| url | TEXT | NOT NULL | 画像URL (R2) |
| caption | VARCHAR(100) | | キャプション (外観/間取り/室内等) |
| sort_order | INTEGER | DEFAULT 0 | 表示順 |

### applications (申込)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | 申込ID |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| customer_id | UUID | FK → customers.id, NOT NULL | 顧客 |
| property_id | UUID | FK → properties.id, NOT NULL | 物件 |
| assigned_user_id | UUID | FK → users.id | 担当者 |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'pending' | 状態 (pending/screening/approved/rejected/cancelled) |
| desired_move_in | DATE | | 入居希望日 |
| notes | TEXT | | 備考 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### application_status_history (申込ステータス履歴)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| application_id | UUID | FK → applications.id, NOT NULL | 申込 |
| from_status | VARCHAR(50) | | 変更前 |
| to_status | VARCHAR(50) | NOT NULL | 変更後 |
| changed_by | UUID | FK → users.id | 変更者 |
| reason | TEXT | | 理由 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### property_proposals (物件提案)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| customer_id | UUID | FK → customers.id, NOT NULL | 顧客 |
| property_id | UUID | FK → properties.id, NOT NULL | 物件 |
| proposed_by | VARCHAR(50) | NOT NULL | 提案者 (ai/user) |
| match_score | DECIMAL(5,4) | | マッチスコア (0.0000〜1.0000) |
| match_reasons | JSONB | DEFAULT '[]' | マッチ理由 |
| is_alternative | BOOLEAN | DEFAULT false | 申込済み物件の代替提案か |
| replaced_property_id | UUID | FK → properties.id | 代替元物件 |
| customer_reaction | VARCHAR(50) | | 反応 (interested/rejected/no_response) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### tasks (タスク)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| assigned_user_id | UUID | FK → users.id | 担当者 |
| customer_id | UUID | FK → customers.id | 関連顧客 |
| title | VARCHAR(255) | NOT NULL | タスク名 |
| description | TEXT | | 詳細 |
| task_type | VARCHAR(50) | NOT NULL | 種別 (follow_up/viewing/contract/other) |
| priority | VARCHAR(20) | DEFAULT 'medium' | 優先度 (high/medium/low) |
| status | VARCHAR(50) | DEFAULT 'pending' | 状態 (pending/in_progress/done/cancelled) |
| due_date | DATE | | 期限 |
| completed_at | TIMESTAMPTZ | | 完了日時 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### chat_sessions (チャットセッション)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| customer_id | UUID | FK → customers.id, NOT NULL | 顧客 |
| assigned_user_id | UUID | FK → users.id | 担当者 |
| channel | VARCHAR(50) | NOT NULL, DEFAULT 'web' | チャネル (web/line) |
| is_ai_active | BOOLEAN | DEFAULT false | AI自動対応中フラグ |
| ai_handoff_reason | TEXT | | AI→人間引き継ぎ理由 |
| started_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| ended_at | TIMESTAMPTZ | | |

### chat_messages (チャットメッセージ)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | |
| company_id | UUID | FK → companies.id, NOT NULL | テナント |
| session_id | UUID | FK → chat_sessions.id, NOT NULL | セッション |
| sender_type | VARCHAR(20) | NOT NULL | 送信者種別 (customer/user/ai) |
| sender_id | UUID | | 送信者ID (user.id or null for AI) |
| content | TEXT | NOT NULL | メッセージ本文 |
| metadata | JSONB | DEFAULT '{}' | メタデータ (提案物件ID、ツール呼び出し等) |
| is_draft | BOOLEAN | DEFAULT false | AI下書き（担当者確認待ち） |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**INDEX**: (company_id, session_id, created_at)

## インデックス戦略

| テーブル | カラム | 種類 | 理由 |
|---|---|---|---|
| properties | (company_id, status) | B-tree | 物件一覧の基本フィルタ |
| properties | (company_id, rent) | B-tree | 賃料範囲検索 |
| properties | embedding | IVFFlat (pgvector) | ベクトル類似検索 |
| customers | (company_id, assigned_user_id) | B-tree | 担当者別顧客一覧 |
| customers | (company_id, status) | B-tree | ステータス別フィルタ |
| customer_preferences | embedding | IVFFlat (pgvector) | 物件マッチング |
| applications | (company_id, status) | B-tree | 申込ステータス管理 |
| applications | (company_id, property_id) | B-tree | 物件別申込確認 |
| chat_messages | (company_id, session_id, created_at) | B-tree | チャット履歴取得 |
| tasks | (company_id, assigned_user_id, status) | B-tree | 担当者タスク一覧 |
| tasks | (company_id, due_date) | B-tree | 期限管理 |

## pgvector 拡張

物件提案エンジンのため `pgvector` 拡張を使用:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- `customer_preferences.embedding`: 顧客希望条件をベクトル化
- `properties.embedding`: 物件特徴をベクトル化
- コサイン類似度でマッチングスコアを算出

## マイグレーション方針

- Prisma Migrate で管理
- RLS ポリシーは `prisma/migrations/` 内の raw SQL で定義
- seed データは `prisma/seed.ts` で管理
