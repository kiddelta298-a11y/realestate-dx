// NOTE: このファイルはAPI連携移行により未使用です。
// 全ページがAPI経由でデータ取得するため、モックデータは参照されません。
// 型定義がAPI互換に変更されたため、型アノテーションを除去しています。

export const properties = [
  { id: "p1", name: "グランメゾン渋谷", address: "渋谷区渋谷2-1-1", rent: 150000, area: 45, rooms: "1LDK", buildingType: "マンション", isVacant: true, nearestStation: "渋谷", walkMinutes: 5, createdAt: "2026-01-15" },
  { id: "p2", name: "サンライズ新宿", address: "新宿区西新宿3-2-5", rent: 120000, area: 35, rooms: "1K", buildingType: "マンション", isVacant: false, nearestStation: "新宿", walkMinutes: 8, createdAt: "2026-01-20" },
  { id: "p3", name: "コーポ目黒", address: "目黒区目黒1-3-2", rent: 85000, area: 28, rooms: "1K", buildingType: "アパート", isVacant: true, nearestStation: "目黒", walkMinutes: 3, createdAt: "2026-02-01" },
  { id: "p4", name: "ヴィラ世田谷", address: "世田谷区三軒茶屋1-5-10", rent: 200000, area: 65, rooms: "2LDK", buildingType: "マンション", isVacant: true, nearestStation: "三軒茶屋", walkMinutes: 7, createdAt: "2026-02-10" },
  { id: "p5", name: "メゾン品川", address: "品川区大崎3-8-1", rent: 95000, area: 30, rooms: "1DK", buildingType: "アパート", isVacant: false, nearestStation: "大崎", walkMinutes: 4, createdAt: "2026-02-15" },
  { id: "p6", name: "テナントビル六本木", address: "港区六本木4-2-3", rent: 350000, area: 80, rooms: "店舗", buildingType: "テナント", isVacant: true, nearestStation: "六本木", walkMinutes: 2, createdAt: "2026-03-01" },
];

export const customers = [
  { id: "c1", name: "田中太郎", email: "tanaka@example.com", phone: "090-1234-5678", status: "来店", source: "SUUMO", assignedTo: "山田", lastContactAt: "2026-03-28", createdAt: "2026-03-01" },
  { id: "c2", name: "鈴木花子", email: "suzuki@example.com", phone: "080-2345-6789", status: "反響", source: "自社サイト", assignedTo: "佐藤", lastContactAt: "2026-03-30", createdAt: "2026-03-15" },
  { id: "c3", name: "佐藤次郎", email: "sato@example.com", phone: "070-3456-7890", status: "申込", source: "HOME'S", assignedTo: "山田", lastContactAt: "2026-03-29", createdAt: "2026-02-20" },
  { id: "c4", name: "高橋美咲", email: "takahashi@example.com", phone: "090-4567-8901", status: "契約", source: "紹介", assignedTo: "田口", lastContactAt: "2026-03-25", createdAt: "2026-01-10" },
  { id: "c5", name: "伊藤健一", email: "ito@example.com", phone: "080-5678-9012", status: "失注", source: "SUUMO", assignedTo: "佐藤", lastContactAt: "2026-03-20", createdAt: "2026-02-05" },
  { id: "c6", name: "渡辺陽子", email: "watanabe@example.com", phone: "070-6789-0123", status: "反響", source: "at home", assignedTo: "山田", lastContactAt: "2026-03-31", createdAt: "2026-03-28" },
];

export const tasks = [
  { id: "t1", title: "田中様 内見アレンジ", description: "グランメゾン渋谷の内見日程を調整", assignedTo: "山田", priority: "high", status: "pending", dueDate: "2026-04-02", customerId: "c1", propertyId: "p1" },
  { id: "t2", title: "鈴木様 初回連絡", description: "反響対応：希望条件のヒアリング", assignedTo: "佐藤", priority: "high", status: "overdue", dueDate: "2026-03-31", customerId: "c2" },
  { id: "t3", title: "佐藤様 申込書類確認", description: "審査書類の不備チェック", assignedTo: "山田", priority: "medium", status: "in_progress", dueDate: "2026-04-03", customerId: "c3" },
  { id: "t4", title: "物件写真撮影", description: "コーポ目黒の写真撮り直し", assignedTo: "田口", priority: "low", status: "pending", dueDate: "2026-04-05", propertyId: "p3" },
  { id: "t5", title: "渡辺様 反響フォロー", description: "at home経由の問い合わせに返信", assignedTo: "山田", priority: "high", status: "pending", dueDate: "2026-04-01", customerId: "c6" },
];

export const kpiData = [
  { month: "2025-10", inquiries: 45, visits: 18, applications: 8, contracts: 5 },
  { month: "2025-11", inquiries: 52, visits: 22, applications: 10, contracts: 7 },
  { month: "2025-12", inquiries: 38, visits: 15, applications: 6, contracts: 4 },
  { month: "2026-01", inquiries: 60, visits: 28, applications: 12, contracts: 8 },
  { month: "2026-02", inquiries: 55, visits: 25, applications: 11, contracts: 7 },
  { month: "2026-03", inquiries: 68, visits: 32, applications: 15, contracts: 10 },
];
