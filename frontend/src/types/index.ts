// === API Response Types (Backend互換) ===

// 物件
export type PropertyType = "apartment" | "mansion" | "house" | "office";
export type PropertyStatus = "available" | "reserved" | "contracted" | "unavailable";

export type Property = {
  id: string;
  companyId: string;
  name: string;
  propertyType: PropertyType;
  address: string;
  nearestStation: string | null;
  walkMinutes: number | null;
  rent: number;
  managementFee: number;
  deposit: number;
  keyMoney: number;
  roomLayout: string | null;
  floorArea: number | null;
  floor: number | null;
  totalFloors: number | null;
  builtYear: number | null;
  availableFrom: string | null;
  features: string[];
  description: string | null;
  status: PropertyStatus;
  createdAt: string;
  updatedAt: string;
  images?: PropertyImage[];
};

export type PropertyImage = {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
};

// 顧客
export type CustomerSource = "web" | "suumo" | "homes" | "line" | "walk_in";
export type CustomerApiStatus = "active" | "contracted" | "lost";

export type Customer = {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  lineUserId: string | null;
  source: CustomerSource;
  status: CustomerApiStatus;
  notes: string | null;
  assignedUserId: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser?: { id: string; name: string } | null;
  preferences?: unknown;
};

// タスク
export type TaskPriority = "high" | "medium" | "low";
export type TaskApiStatus = "pending" | "in_progress" | "done" | "cancelled";
export type TaskType = "follow_up" | "viewing" | "contract" | "other";

export type Task = {
  id: string;
  companyId: string;
  assignedUserId: string | null;
  customerId: string | null;
  title: string;
  description: string | null;
  taskType: TaskType;
  priority: TaskPriority;
  status: TaskApiStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser?: { id: string; name: string } | null;
};

// タスクアラート
export type TaskAlerts = {
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
  totalAlerts: number;
};

// ページネーション
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: Pagination;
};

// === 表示用ヘルパー ===

export const propertyTypeLabel: Record<PropertyType, string> = {
  apartment: "アパート",
  mansion: "マンション",
  house: "戸建",
  office: "テナント",
};

export const propertyStatusLabel: Record<PropertyStatus, string> = {
  available: "空室",
  reserved: "予約済",
  contracted: "契約済",
  unavailable: "非公開",
};

export const customerSourceLabel: Record<CustomerSource, string> = {
  web: "自社サイト",
  suumo: "SUUMO",
  homes: "HOME'S",
  line: "LINE",
  walk_in: "来店",
};

export const customerStatusLabel: Record<CustomerApiStatus, string> = {
  active: "対応中",
  contracted: "契約済",
  lost: "失注",
};

export const taskTypeLabel: Record<TaskType, string> = {
  follow_up: "フォロー",
  viewing: "内見",
  contract: "契約",
  other: "その他",
};

export const taskStatusLabel: Record<TaskApiStatus, string> = {
  pending: "未着手",
  in_progress: "進行中",
  done: "完了",
  cancelled: "キャンセル",
};

export const priorityLabel: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

// === Phase 2: 追客自動化 ===

export type TriggerEvent = "inquiry" | "visit" | "application";
export type StepChannel = "email" | "line" | "task";
export type ExecutionStatus = "pending" | "sent" | "failed" | "cancelled";

export type FollowupSequence = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  triggerEvent: TriggerEvent;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  steps: FollowupStep[];
};

export type FollowupStep = {
  id: string;
  sequenceId: string;
  stepOrder: number;
  delayDays: number;
  channel: StepChannel;
  templateBody: string;
  subject: string | null;
  createdAt: string;
};

export type FollowupExecution = {
  id: string;
  companyId: string;
  sequenceId: string;
  stepId: string | null;
  customerId: string;
  status: ExecutionStatus;
  scheduledAt: string;
  executedAt: string | null;
  channel: string;
  messageBody: string | null;
  errorMessage: string | null;
  createdAt: string;
  customer?: { id: string; name: string };
  sequence?: { id: string; name: string };
  step?: FollowupStep | null;
};

export const triggerEventLabel: Record<TriggerEvent, string> = {
  inquiry: "反響時",
  visit: "来店時",
  application: "申込時",
};

export const stepChannelLabel: Record<StepChannel, string> = {
  email: "メール",
  line: "LINE",
  task: "タスク作成",
};

export const executionStatusLabel: Record<ExecutionStatus, string> = {
  pending: "保留中",
  sent: "送信済",
  failed: "失敗",
  cancelled: "キャンセル",
};

// === Phase 2: LINE連携 ===

export type LineAccount = {
  id: string;
  companyId: string;
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  webhookActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// === Phase 2: 物件提案 ===

export type PropertyRecommendation = {
  property: Property;
  matchScore: number;
  matchReasons: string[];
};

// === Phase 3: Web申込 ===

export type ApplicationStatus = "draft" | "submitted" | "screening" | "approved" | "rejected" | "cancelled";

export type Application = {
  id: string;
  companyId: string;
  customerId: string;
  propertyId: string;
  status: ApplicationStatus;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  employer: string | null;
  annualIncome: number | null;
  desiredMoveIn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  property?: { id: string; name: string; address: string; rent: number };
};

export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  draft: "下書き",
  submitted: "提出済",
  screening: "審査中",
  approved: "承認",
  rejected: "却下",
  cancelled: "取消",
};

// === Phase 3: 電子契約 ===

export type ContractStatus = "draft" | "pending_signature" | "signed" | "completed" | "cancelled";

export type Contract = {
  id: string;
  companyId: string;
  applicationId: string;
  propertyId: string;
  customerId: string;
  status: ContractStatus;
  documentUrl: string | null;
  signedAt: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  keyMoney: number;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  property?: { id: string; name: string; address: string };
};

export const contractStatusLabel: Record<ContractStatus, string> = {
  draft: "作成中",
  pending_signature: "署名待ち",
  signed: "署名済",
  completed: "完了",
  cancelled: "取消",
};

// === Phase 3: 内見予約 ===

export type ViewingStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type Viewing = {
  id: string;
  companyId: string;
  propertyId: string;
  customerId: string;
  assignedUserId: string | null;
  scheduledAt: string;
  endAt: string;
  status: ViewingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  property?: { id: string; name: string; address: string };
  assignedUser?: { id: string; name: string } | null;
};

export const viewingStatusLabel: Record<ViewingStatus, string> = {
  scheduled: "予約済",
  completed: "完了",
  cancelled: "キャンセル",
  no_show: "無断欠席",
};

// === Phase 4: 入居者管理 ===

export type Tenant = {
  id: string;
  companyId: string;
  customerId: string;
  propertyId: string;
  contractId: string;
  name: string;
  email: string | null;
  phone: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  moveInDate: string;
  moveOutDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  property?: { id: string; name: string; address: string; rent: number };
};

// === Phase 4: 家賃管理 ===

export type InvoiceStatus = "unpaid" | "paid" | "overdue" | "partial";

export type RentInvoice = {
  id: string;
  companyId: string;
  tenantId: string;
  propertyId: string;
  billingMonth: string;
  amount: number;
  paidAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string };
  property?: { id: string; name: string };
};

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  unpaid: "未払い",
  paid: "支払済",
  overdue: "滞納",
  partial: "一部入金",
};

// === Phase 4: 契約更新 ===

export type RenewalStatus = "upcoming" | "notified" | "renewed" | "terminated";

export type Renewal = {
  id: string;
  companyId: string;
  contractId: string;
  tenantId: string;
  propertyId: string;
  currentEndDate: string;
  newEndDate: string | null;
  status: RenewalStatus;
  renewalFee: number | null;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string };
  property?: { id: string; name: string };
};

export const renewalStatusLabel: Record<RenewalStatus, string> = {
  upcoming: "更新予定",
  notified: "通知済",
  renewed: "更新完了",
  terminated: "解約",
};

// === Phase 4: 退去管理 ===

export type VacationStatus = "requested" | "inspection_scheduled" | "inspected" | "deposit_settled" | "completed";

export type Vacation = {
  id: string;
  companyId: string;
  tenantId: string;
  propertyId: string;
  requestedMoveOut: string;
  actualMoveOut: string | null;
  status: VacationStatus;
  inspectionDate: string | null;
  depositReturn: number | null;
  deductions: number | null;
  checklist: { item: string; checked: boolean }[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string };
  property?: { id: string; name: string };
};

export const vacationStatusLabel: Record<VacationStatus, string> = {
  requested: "退去申請",
  inspection_scheduled: "立会予定",
  inspected: "立会完了",
  deposit_settled: "精算済",
  completed: "退去完了",
};

// === Phase 4: 物件掲載入力自動化 ===

export type ExtractedProperty = {
  name: string | null;
  propertyType: string | null;
  address: string | null;
  rent: number | null;
  managementFee: number | null;
  deposit: number | null;
  keyMoney: number | null;
  roomLayout: string | null;
  floorArea: number | null;
  nearestStation: string | null;
  walkMinutes: number | null;
  builtYear: number | null;
  features: string[];
  description: string | null;
};

// === Phase 5: 売買対応 ===

// バックエンド DB の実際の enum 値に合わせる
export type SalePropertyStatus = "for_sale" | "negotiating" | "sold" | "withdrawn";
export type SaleCaseStatus = "inquiry" | "viewing" | "negotiating" | "contracted" | "cancelled";

export type SaleProperty = {
  id: string;
  companyId: string;
  name: string;
  address: string;
  propertyType: PropertyType;
  price: number;
  landArea: number | null;
  buildingArea: number | null;
  builtYear: number | null;
  roomLayout: string | null;
  status: SalePropertyStatus;
  description: string | null;
  assignedUserId: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser?: { id: string; name: string } | null;
};

export type SaleCase = {
  id: string;
  companyId: string;
  salePropertyId: string;
  customerId: string;
  assignedUserId: string | null;
  status: SaleCaseStatus;
  offerPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  saleProperty?: { id: string; name: string; price: number };
  customer?: { id: string; name: string };
  assignedUser?: { id: string; name: string } | null;
};

export const salePropertyStatusLabel: Record<SalePropertyStatus, string> = {
  for_sale: "販売中",
  negotiating: "商談中",
  sold: "売却済",
  withdrawn: "取下げ",
};

export const saleCaseStatusLabel: Record<SaleCaseStatus, string> = {
  inquiry: "問合せ",
  viewing: "内見",
  negotiating: "商談中",
  contracted: "契約済",
  cancelled: "失注",
};

// === Phase 5: 来店分析 ===

export type VisitPurpose = "inquiry" | "viewing" | "contract" | "consultation" | "other";
export type VisitChannel = "walk_in" | "appointment" | "referral";
export type VisitResult = "interested" | "application" | "contracted" | "not_interested" | "follow_up";

export type Visit = {
  id: string;
  companyId: string;
  customerId: string;
  assignedUserId: string | null;
  visitDate: string;
  visitTime: string | null;
  purpose: VisitPurpose;
  channel: VisitChannel;
  result: VisitResult | null;
  propertyIds: string[];
  duration: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  assignedUser?: { id: string; name: string } | null;
};

export const visitPurposeLabel: Record<VisitPurpose, string> = {
  inquiry: "相談・問合せ",
  viewing: "内見",
  contract: "契約手続き",
  consultation: "相談",
  other: "その他",
};

export const visitChannelLabel: Record<VisitChannel, string> = {
  walk_in: "飛込み",
  appointment: "予約来店",
  referral: "紹介",
};

export const visitResultLabel: Record<VisitResult, string> = {
  interested: "興味あり",
  application: "申込へ",
  contracted: "契約済",
  not_interested: "興味なし",
  follow_up: "要フォロー",
};

export type AnalyticsSummary = {
  period: string;
  inquiryCount: number;
  visitCount: number;
  applicationCount: number;
  contractCount: number;
  visitRate: number;
  applicationRate: number;
  contractRate: number;
  byStaff: { userId: string; name: string; visits: number; contracts: number }[];
  aiSuggestions: string[];
};

// === Phase 5: 切り返しAI ===

export type ComebackStyle = "formal" | "casual" | "passionate";

export type ComebackResponse = {
  objection: string;
  style: ComebackStyle;
  suggestions: { text: string; reasoning: string }[];
};

export const comebackStyleLabel: Record<ComebackStyle, string> = {
  formal: "フォーマル",
  casual: "カジュアル",
  passionate: "熱意型",
};
