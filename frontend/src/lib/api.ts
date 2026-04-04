import type {
  Property,
  Customer,
  Task,
  TaskAlerts,
  PaginatedResponse,
  PropertyStatus,
  CustomerApiStatus,
  TaskApiStatus,
  TaskPriority,
  TaskType,
  FollowupSequence,
  FollowupStep,
  FollowupExecution,
  TriggerEvent,
  StepChannel,
  ExecutionStatus,
  LineAccount,
  PropertyRecommendation,
  Application,
  ApplicationStatus,
  Contract,
  ContractStatus,
  Viewing,
  ViewingStatus,
  Tenant,
  RentInvoice,
  InvoiceStatus,
  Renewal,
  RenewalStatus,
  Vacation,
  VacationStatus,
  ExtractedProperty,
  SaleProperty,
  SalePropertyStatus,
  SaleCase,
  SaleCaseStatus,
  Visit,
  AnalyticsSummary,
  ComebackStyle,
  ComebackResponse,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// TODO: マルチテナント対応時に動的取得に変更
const DEFAULT_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID ?? "00000000-0000-0000-0000-000000000001";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.message ?? `API Error: ${res.status}`);
  }
  return res.json();
}

// === Properties ===

type PropertyListParams = {
  status?: PropertyStatus;
  minRent?: number;
  maxRent?: number;
  nearestStation?: string;
  page?: number;
  limit?: number;
};

export async function fetchProperties(params: PropertyListParams = {}): Promise<PaginatedResponse<Property>> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  if (params.status) sp.set("status", params.status);
  if (params.minRent) sp.set("minRent", String(params.minRent));
  if (params.maxRent) sp.set("maxRent", String(params.maxRent));
  if (params.nearestStation) sp.set("nearestStation", params.nearestStation);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(Math.min(params.limit, 100)));
  return request(`/api/properties?${sp}`);
}

export async function createProperty(data: {
  name: string;
  propertyType: string;
  address: string;
  rent: number;
  nearestStation?: string;
  walkMinutes?: number;
  roomLayout?: string;
  floorArea?: number;
  status?: PropertyStatus;
}): Promise<{ data: Property }> {
  return request("/api/properties", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

export async function updateProperty(
  id: string,
  data: Partial<Omit<Property, "id" | "companyId" | "createdAt" | "updatedAt" | "images">>,
): Promise<{ data: Property }> {
  return request(`/api/properties/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProperty(id: string): Promise<{ data: { id: string; deleted: boolean } }> {
  return request(`/api/properties/${id}`, { method: "DELETE" });
}

// === Customers ===

type CustomerListParams = {
  status?: CustomerApiStatus;
  assignedUserId?: string;
  source?: string;
  page?: number;
  limit?: number;
};

export async function fetchCustomers(params: CustomerListParams = {}): Promise<PaginatedResponse<Customer>> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  if (params.status) sp.set("status", params.status);
  if (params.assignedUserId) sp.set("assignedUserId", params.assignedUserId);
  if (params.source) sp.set("source", params.source);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(Math.min(params.limit, 100)));
  return request(`/api/customers?${sp}`);
}

export async function createCustomer(data: {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  assignedUserId?: string;
}): Promise<{ data: Customer }> {
  return request("/api/customers", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

export async function updateCustomer(
  id: string,
  data: Partial<{ name: string; email: string; phone: string; status: CustomerApiStatus; notes: string }>,
): Promise<{ data: Customer }> {
  return request(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomer(id: string): Promise<{ data: { id: string; deleted: boolean } }> {
  return request(`/api/customers/${id}`, { method: "DELETE" });
}

// === Tasks ===

type TaskListParams = {
  assignedUserId?: string;
  status?: TaskApiStatus;
  priority?: TaskPriority;
  dueBefore?: string;
  page?: number;
  limit?: number;
};

export async function fetchTasks(params: TaskListParams = {}): Promise<PaginatedResponse<Task>> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  if (params.assignedUserId) sp.set("assignedUserId", params.assignedUserId);
  if (params.status) sp.set("status", params.status);
  if (params.priority) sp.set("priority", params.priority);
  if (params.dueBefore) sp.set("dueBefore", params.dueBefore);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  return request(`/api/tasks?${sp}`);
}

export async function createTask(data: {
  title: string;
  taskType: TaskType;
  priority?: TaskPriority;
  description?: string;
  assignedUserId?: string;
  customerId?: string;
  dueDate?: string;
}): Promise<{ data: Task }> {
  return request("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

export async function updateTask(
  id: string,
  data: Partial<{ title: string; status: TaskApiStatus; priority: TaskPriority; dueDate: string | null; assignedUserId: string }>,
): Promise<{ data: Task }> {
  return request(`/api/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<{ data: { id: string; deleted: boolean } }> {
  return request(`/api/tasks/${id}`, { method: "DELETE" });
}

export async function fetchTaskAlerts(assignedUserId?: string): Promise<{ data: TaskAlerts }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  if (assignedUserId) sp.set("assignedUserId", assignedUserId);
  return request(`/api/tasks/alerts/upcoming?${sp}`);
}

// === Phase 2: Followup Sequences (モック — バックエンドAPI未実装) ===

const MOCK_SEQUENCES: FollowupSequence[] = [
  {
    id: "seq1", companyId: DEFAULT_COMPANY_ID, name: "反響初期対応", description: "問い合わせ後の3段階フォロー", triggerEvent: "inquiry", isActive: true, createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-15T00:00:00Z",
    steps: [
      { id: "s1", sequenceId: "seq1", stepOrder: 1, delayDays: 0, channel: "email", templateBody: "お問い合わせありがとうございます。ご希望条件をお聞かせください。", subject: "お問い合わせありがとうございます", createdAt: "2026-03-01T00:00:00Z" },
      { id: "s2", sequenceId: "seq1", stepOrder: 2, delayDays: 3, channel: "line", templateBody: "先日はお問い合わせいただきありがとうございました。ご都合のよい日時に内見はいかがでしょうか？", subject: null, createdAt: "2026-03-01T00:00:00Z" },
      { id: "s3", sequenceId: "seq1", stepOrder: 3, delayDays: 7, channel: "task", templateBody: "1週間後フォロー電話", subject: null, createdAt: "2026-03-01T00:00:00Z" },
    ],
  },
  {
    id: "seq2", companyId: DEFAULT_COMPANY_ID, name: "来店後フォロー", description: "来店後の検討サポート", triggerEvent: "visit", isActive: true, createdAt: "2026-03-10T00:00:00Z", updatedAt: "2026-03-20T00:00:00Z",
    steps: [
      { id: "s4", sequenceId: "seq2", stepOrder: 1, delayDays: 1, channel: "email", templateBody: "本日はご来店ありがとうございました。気になる物件がございましたらお気軽にどうぞ。", subject: "ご来店ありがとうございました", createdAt: "2026-03-10T00:00:00Z" },
      { id: "s5", sequenceId: "seq2", stepOrder: 2, delayDays: 5, channel: "line", templateBody: "ご検討状況はいかがでしょうか？新着物件のご案内もございます。", subject: null, createdAt: "2026-03-10T00:00:00Z" },
    ],
  },
  {
    id: "seq3", companyId: DEFAULT_COMPANY_ID, name: "申込後フォロー", description: "申込後の進捗案内", triggerEvent: "application", isActive: false, createdAt: "2026-03-15T00:00:00Z", updatedAt: "2026-03-25T00:00:00Z",
    steps: [
      { id: "s6", sequenceId: "seq3", stepOrder: 1, delayDays: 0, channel: "email", templateBody: "お申し込みを受け付けました。審査結果は3-5営業日以内にご連絡いたします。", subject: "お申し込みありがとうございます", createdAt: "2026-03-15T00:00:00Z" },
    ],
  },
];

const MOCK_EXECUTIONS: FollowupExecution[] = [
  { id: "ex1", companyId: DEFAULT_COMPANY_ID, sequenceId: "seq1", stepId: "s1", customerId: "c1", status: "sent", scheduledAt: "2026-03-28T10:00:00Z", executedAt: "2026-03-28T10:01:00Z", channel: "email", messageBody: "お問い合わせありがとうございます。", errorMessage: null, createdAt: "2026-03-28T10:00:00Z", customer: { id: "c1", name: "田中太郎" }, sequence: { id: "seq1", name: "反響初期対応" } },
  { id: "ex2", companyId: DEFAULT_COMPANY_ID, sequenceId: "seq1", stepId: "s2", customerId: "c1", status: "pending", scheduledAt: "2026-03-31T10:00:00Z", executedAt: null, channel: "line", messageBody: null, errorMessage: null, createdAt: "2026-03-28T10:00:00Z", customer: { id: "c1", name: "田中太郎" }, sequence: { id: "seq1", name: "反響初期対応" } },
  { id: "ex3", companyId: DEFAULT_COMPANY_ID, sequenceId: "seq1", stepId: "s1", customerId: "c2", status: "failed", scheduledAt: "2026-03-30T10:00:00Z", executedAt: "2026-03-30T10:01:00Z", channel: "email", messageBody: "お問い合わせありがとうございます。", errorMessage: "メール配信エラー: 宛先不明", createdAt: "2026-03-30T10:00:00Z", customer: { id: "c2", name: "鈴木花子" }, sequence: { id: "seq1", name: "反響初期対応" } },
  { id: "ex4", companyId: DEFAULT_COMPANY_ID, sequenceId: "seq2", stepId: "s4", customerId: "c3", status: "sent", scheduledAt: "2026-03-30T10:00:00Z", executedAt: "2026-03-30T10:02:00Z", channel: "email", messageBody: "ご来店ありがとうございました。", errorMessage: null, createdAt: "2026-03-29T10:00:00Z", customer: { id: "c3", name: "佐藤次郎" }, sequence: { id: "seq2", name: "来店後フォロー" } },
  { id: "ex5", companyId: DEFAULT_COMPANY_ID, sequenceId: "seq2", stepId: "s5", customerId: "c3", status: "pending", scheduledAt: "2026-04-03T10:00:00Z", executedAt: null, channel: "line", messageBody: null, errorMessage: null, createdAt: "2026-03-29T10:00:00Z", customer: { id: "c3", name: "佐藤次郎" }, sequence: { id: "seq2", name: "来店後フォロー" } },
];

// 注意: 以下はモック実装。バックエンドAPI実装後に request() ベースに切り替え予定。

let _sequences = [...MOCK_SEQUENCES];
let _executions = [...MOCK_EXECUTIONS];

export async function fetchFollowupSequences(): Promise<{ data: FollowupSequence[] }> {
  return { data: _sequences };
}

export async function createFollowupSequence(data: {
  name: string;
  description?: string;
  triggerEvent: TriggerEvent;
}): Promise<{ data: FollowupSequence }> {
  const seq: FollowupSequence = {
    id: `seq${Date.now()}`, companyId: DEFAULT_COMPANY_ID,
    name: data.name, description: data.description ?? null, triggerEvent: data.triggerEvent,
    isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), steps: [],
  };
  _sequences = [..._sequences, seq];
  return { data: seq };
}

export async function updateFollowupSequence(
  id: string,
  data: Partial<{ name: string; description: string; triggerEvent: TriggerEvent; isActive: boolean }>,
): Promise<{ data: FollowupSequence }> {
  _sequences = _sequences.map((s) => (s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s));
  return { data: _sequences.find((s) => s.id === id)! };
}

export async function deleteFollowupSequence(id: string): Promise<{ data: { id: string; deleted: boolean } }> {
  _sequences = _sequences.filter((s) => s.id !== id);
  return { data: { id, deleted: true } };
}

export async function addFollowupStep(
  sequenceId: string,
  data: { stepOrder: number; delayDays: number; channel: StepChannel; templateBody: string; subject?: string },
): Promise<{ data: FollowupStep }> {
  const step: FollowupStep = {
    id: `s${Date.now()}`, sequenceId, ...data, subject: data.subject ?? null, createdAt: new Date().toISOString(),
  };
  _sequences = _sequences.map((s) =>
    s.id === sequenceId ? { ...s, steps: [...s.steps, step].sort((a, b) => a.stepOrder - b.stepOrder) } : s,
  );
  return { data: step };
}

export async function deleteFollowupStep(sequenceId: string, stepId: string): Promise<{ data: { id: string; deleted: boolean } }> {
  _sequences = _sequences.map((s) =>
    s.id === sequenceId ? { ...s, steps: s.steps.filter((st) => st.id !== stepId) } : s,
  );
  return { data: { id: stepId, deleted: true } };
}

export async function fetchFollowupExecutions(params?: {
  status?: ExecutionStatus;
}): Promise<{ data: FollowupExecution[] }> {
  let result = _executions;
  if (params?.status) result = result.filter((e) => e.status === params.status);
  return { data: result };
}

export async function retryFollowupExecution(id: string): Promise<{ data: FollowupExecution }> {
  _executions = _executions.map((e) =>
    e.id === id ? { ...e, status: "pending" as const, errorMessage: null, executedAt: null } : e,
  );
  return { data: _executions.find((e) => e.id === id)! };
}

export async function executeFollowup(id: string): Promise<{ data: FollowupExecution }> {
  _executions = _executions.map((e) =>
    e.id === id ? { ...e, status: "sent" as const, executedAt: new Date().toISOString() } : e,
  );
  return { data: _executions.find((e) => e.id === id)! };
}

// === Phase 2: LINE連携 (モック) ===

let _lineAccount: LineAccount | null = null;

export async function fetchLineAccount(): Promise<{ data: LineAccount | null }> {
  return { data: _lineAccount };
}

export async function saveLineAccount(data: {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
}): Promise<{ data: LineAccount }> {
  _lineAccount = {
    id: _lineAccount?.id ?? `line${Date.now()}`,
    companyId: DEFAULT_COMPANY_ID,
    ...data,
    webhookActive: true,
    createdAt: _lineAccount?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { data: _lineAccount };
}

export async function testLineMessage(): Promise<{ data: { success: boolean; message: string } }> {
  if (!_lineAccount) {
    return { data: { success: false, message: "LINE連携が設定されていません" } };
  }
  return { data: { success: true, message: "テストメッセージを送信しました" } };
}

// === Phase 2: 物件提案 (モック) ===

export async function fetchPropertyRecommendations(data: {
  customerId?: string;
  maxRent?: number;
  minArea?: number;
  preferredStation?: string;
  preferredLayout?: string;
}): Promise<{ data: PropertyRecommendation[] }> {
  // モック: 既存物件からランダムスコアで5件返す
  try {
    const res = await fetchProperties({ limit: 20, status: "available" });
    const scored: PropertyRecommendation[] = res.data.map((p) => {
      let score = 0.5 + Math.random() * 0.5;
      const reasons: string[] = [];
      if (data.maxRent && p.rent <= data.maxRent) { score += 0.1; reasons.push("予算内"); }
      if (data.minArea && p.floorArea && p.floorArea >= data.minArea) { score += 0.1; reasons.push("希望面積以上"); }
      if (data.preferredStation && p.nearestStation?.includes(data.preferredStation)) { score += 0.15; reasons.push("希望駅"); }
      if (data.preferredLayout && p.roomLayout === data.preferredLayout) { score += 0.1; reasons.push("希望間取り"); }
      if (reasons.length === 0) reasons.push("条件に近い物件");
      return { property: p, matchScore: Math.min(score, 1), matchReasons: reasons };
    });
    return { data: scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5) };
  } catch {
    // APIが利用不可の場合はモック物件を返す
    return { data: [] };
  }
}

// === Phase 3: Web申込 (モック) ===

const MOCK_APPLICATIONS: Application[] = [
  { id: "app1", companyId: DEFAULT_COMPANY_ID, customerId: "c1", propertyId: "p1", status: "screening", applicantName: "田中太郎", applicantEmail: "tanaka@example.com", applicantPhone: "090-1234-5678", employer: "株式会社ABC", annualIncome: 5000000, desiredMoveIn: "2026-05-01", notes: null, createdAt: "2026-03-25T10:00:00Z", updatedAt: "2026-03-28T10:00:00Z", customer: { id: "c1", name: "田中太郎" }, property: { id: "p1", name: "グランメゾン渋谷", address: "渋谷区渋谷2-1-1", rent: 150000 } },
  { id: "app2", companyId: DEFAULT_COMPANY_ID, customerId: "c3", propertyId: "p4", status: "approved", applicantName: "佐藤次郎", applicantEmail: "sato@example.com", applicantPhone: "070-3456-7890", employer: "DEF商事", annualIncome: 6500000, desiredMoveIn: "2026-04-15", notes: "保証人：父親", createdAt: "2026-03-20T10:00:00Z", updatedAt: "2026-03-30T10:00:00Z", customer: { id: "c3", name: "佐藤次郎" }, property: { id: "p4", name: "ヴィラ世田谷", address: "世田谷区三軒茶屋1-5-10", rent: 200000 } },
  { id: "app3", companyId: DEFAULT_COMPANY_ID, customerId: "c2", propertyId: "p3", status: "submitted", applicantName: "鈴木花子", applicantEmail: "suzuki@example.com", applicantPhone: "080-2345-6789", employer: "GHI株式会社", annualIncome: 4000000, desiredMoveIn: "2026-05-15", notes: null, createdAt: "2026-03-30T10:00:00Z", updatedAt: "2026-03-30T10:00:00Z", customer: { id: "c2", name: "鈴木花子" }, property: { id: "p3", name: "コーポ目黒", address: "目黒区目黒1-3-2", rent: 85000 } },
];

let _applications = [...MOCK_APPLICATIONS];

export async function fetchApplications(): Promise<{ data: Application[] }> {
  return { data: _applications };
}

export async function createApplication(data: {
  propertyId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  employer?: string;
  annualIncome?: number;
  desiredMoveIn?: string;
  notes?: string;
}): Promise<{ data: Application }> {
  const app: Application = {
    id: `app${Date.now()}`, companyId: DEFAULT_COMPANY_ID, customerId: `c_new_${Date.now()}`,
    propertyId: data.propertyId, status: "submitted",
    applicantName: data.applicantName, applicantEmail: data.applicantEmail, applicantPhone: data.applicantPhone,
    employer: data.employer ?? null, annualIncome: data.annualIncome ?? null,
    desiredMoveIn: data.desiredMoveIn ?? null, notes: data.notes ?? null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    property: { id: data.propertyId, name: "物件", address: "", rent: 0 },
  };
  _applications = [..._applications, app];
  return { data: app };
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<{ data: Application }> {
  _applications = _applications.map((a) => a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a);
  return { data: _applications.find((a) => a.id === id)! };
}

// === Phase 3: 電子契約 (モック) ===

const MOCK_CONTRACTS: Contract[] = [
  { id: "con1", companyId: DEFAULT_COMPANY_ID, applicationId: "app2", propertyId: "p4", customerId: "c3", status: "pending_signature", documentUrl: null, signedAt: null, startDate: "2026-04-15", endDate: "2028-04-14", monthlyRent: 200000, deposit: 200000, keyMoney: 200000, createdAt: "2026-03-31T10:00:00Z", updatedAt: "2026-03-31T10:00:00Z", customer: { id: "c3", name: "佐藤次郎" }, property: { id: "p4", name: "ヴィラ世田谷", address: "世田谷区三軒茶屋1-5-10" } },
  { id: "con2", companyId: DEFAULT_COMPANY_ID, applicationId: "app0", propertyId: "p2", customerId: "c4", status: "completed", documentUrl: null, signedAt: "2026-03-15T14:00:00Z", startDate: "2026-04-01", endDate: "2028-03-31", monthlyRent: 120000, deposit: 120000, keyMoney: 0, createdAt: "2026-03-10T10:00:00Z", updatedAt: "2026-03-15T14:00:00Z", customer: { id: "c4", name: "高橋美咲" }, property: { id: "p2", name: "サンライズ新宿", address: "新宿区西新宿3-2-5" } },
];

let _contracts = [...MOCK_CONTRACTS];

export async function fetchContracts(): Promise<{ data: Contract[] }> {
  return { data: _contracts };
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<{ data: Contract }> {
  _contracts = _contracts.map((c) => c.id === id ? { ...c, status, signedAt: status === "signed" ? new Date().toISOString() : c.signedAt, updatedAt: new Date().toISOString() } : c);
  return { data: _contracts.find((c) => c.id === id)! };
}

export async function signContract(id: string): Promise<{ data: Contract }> {
  _contracts = _contracts.map((c) => c.id === id ? { ...c, status: "signed" as const, signedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : c);
  return { data: _contracts.find((c) => c.id === id)! };
}

// === Phase 3: 内見予約 (モック) ===

const MOCK_VIEWINGS: Viewing[] = [
  { id: "v1", companyId: DEFAULT_COMPANY_ID, propertyId: "p1", customerId: "c1", assignedUserId: "u1", scheduledAt: "2026-04-02T10:00:00+09:00", endAt: "2026-04-02T11:00:00+09:00", status: "scheduled", notes: "初回内見", createdAt: "2026-03-28T10:00:00Z", updatedAt: "2026-03-28T10:00:00Z", customer: { id: "c1", name: "田中太郎" }, property: { id: "p1", name: "グランメゾン渋谷", address: "渋谷区渋谷2-1-1" }, assignedUser: { id: "u1", name: "山田" } },
  { id: "v2", companyId: DEFAULT_COMPANY_ID, propertyId: "p3", customerId: "c2", assignedUserId: "u2", scheduledAt: "2026-04-03T14:00:00+09:00", endAt: "2026-04-03T15:00:00+09:00", status: "scheduled", notes: null, createdAt: "2026-03-30T10:00:00Z", updatedAt: "2026-03-30T10:00:00Z", customer: { id: "c2", name: "鈴木花子" }, property: { id: "p3", name: "コーポ目黒", address: "目黒区目黒1-3-2" }, assignedUser: { id: "u2", name: "佐藤" } },
  { id: "v3", companyId: DEFAULT_COMPANY_ID, propertyId: "p4", customerId: "c6", assignedUserId: "u1", scheduledAt: "2026-04-05T11:00:00+09:00", endAt: "2026-04-05T12:00:00+09:00", status: "scheduled", notes: "2LDK希望", createdAt: "2026-03-31T10:00:00Z", updatedAt: "2026-03-31T10:00:00Z", customer: { id: "c6", name: "渡辺陽子" }, property: { id: "p4", name: "ヴィラ世田谷", address: "世田谷区三軒茶屋1-5-10" }, assignedUser: { id: "u1", name: "山田" } },
  { id: "v4", companyId: DEFAULT_COMPANY_ID, propertyId: "p6", customerId: "c1", assignedUserId: "u3", scheduledAt: "2026-04-07T10:00:00+09:00", endAt: "2026-04-07T11:00:00+09:00", status: "scheduled", notes: "テナント視察", createdAt: "2026-04-01T10:00:00Z", updatedAt: "2026-04-01T10:00:00Z", customer: { id: "c1", name: "田中太郎" }, property: { id: "p6", name: "テナントビル六本木", address: "港区六本木4-2-3" }, assignedUser: { id: "u3", name: "田口" } },
  { id: "v5", companyId: DEFAULT_COMPANY_ID, propertyId: "p1", customerId: "c3", assignedUserId: "u2", scheduledAt: "2026-03-28T10:00:00+09:00", endAt: "2026-03-28T11:00:00+09:00", status: "completed", notes: "気に入った様子", createdAt: "2026-03-25T10:00:00Z", updatedAt: "2026-03-28T11:00:00Z", customer: { id: "c3", name: "佐藤次郎" }, property: { id: "p1", name: "グランメゾン渋谷", address: "渋谷区渋谷2-1-1" }, assignedUser: { id: "u2", name: "佐藤" } },
];

let _viewings = [...MOCK_VIEWINGS];

export async function fetchViewings(): Promise<{ data: Viewing[] }> {
  return { data: _viewings };
}

export async function createViewing(data: {
  propertyId: string;
  customerId: string;
  assignedUserId?: string;
  scheduledAt: string;
  endAt: string;
  notes?: string;
}): Promise<{ data: Viewing }> {
  const v: Viewing = {
    id: `v${Date.now()}`, companyId: DEFAULT_COMPANY_ID,
    propertyId: data.propertyId, customerId: data.customerId,
    assignedUserId: data.assignedUserId ?? null,
    scheduledAt: data.scheduledAt, endAt: data.endAt,
    status: "scheduled", notes: data.notes ?? null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  _viewings = [..._viewings, v];
  return { data: v };
}

export async function updateViewingStatus(id: string, status: ViewingStatus): Promise<{ data: Viewing }> {
  _viewings = _viewings.map((v) => v.id === id ? { ...v, status, updatedAt: new Date().toISOString() } : v);
  return { data: _viewings.find((v) => v.id === id)! };
}

export async function updateViewing(id: string, data: Partial<{ scheduledAt: string; endAt: string; notes: string; assignedUserId: string }>): Promise<{ data: Viewing }> {
  _viewings = _viewings.map((v) => v.id === id ? { ...v, ...data, updatedAt: new Date().toISOString() } : v);
  return { data: _viewings.find((v) => v.id === id)! };
}

// === Phase 4: 入居者管理 (モック) ===

const MOCK_TENANTS: Tenant[] = [
  { id: "tn1", companyId: DEFAULT_COMPANY_ID, customerId: "c4", propertyId: "p2", contractId: "con2", name: "高橋美咲", email: "takahashi@example.com", phone: "090-4567-8901", emergencyContact: "高橋太郎（父）", emergencyPhone: "03-1234-5678", guarantorName: "高橋太郎", guarantorPhone: "03-1234-5678", moveInDate: "2026-04-01", moveOutDate: null, isActive: true, createdAt: "2026-03-15T10:00:00Z", updatedAt: "2026-04-01T10:00:00Z", property: { id: "p2", name: "サンライズ新宿", address: "新宿区西新宿3-2-5", rent: 120000 } },
  { id: "tn2", companyId: DEFAULT_COMPANY_ID, customerId: "c5", propertyId: "p5", contractId: "con3", name: "伊藤健一", email: "ito@example.com", phone: "080-5678-9012", emergencyContact: "伊藤花子（妻）", emergencyPhone: "080-9999-0000", guarantorName: "伊藤正男", guarantorPhone: "03-5678-9012", moveInDate: "2025-10-01", moveOutDate: null, isActive: true, createdAt: "2025-09-20T10:00:00Z", updatedAt: "2025-10-01T10:00:00Z", property: { id: "p5", name: "メゾン品川", address: "品川区大崎3-8-1", rent: 95000 } },
];

let _tenants = [...MOCK_TENANTS];

export async function fetchTenants(): Promise<{ data: Tenant[] }> {
  return { data: _tenants };
}

export async function createTenant(data: {
  name: string; email?: string; phone?: string; propertyId: string;
  emergencyContact?: string; emergencyPhone?: string;
  guarantorName?: string; guarantorPhone?: string; moveInDate: string;
}): Promise<{ data: Tenant }> {
  const t: Tenant = {
    id: `tn${Date.now()}`, companyId: DEFAULT_COMPANY_ID, customerId: `c_${Date.now()}`,
    propertyId: data.propertyId, contractId: `con_${Date.now()}`, name: data.name,
    email: data.email ?? null, phone: data.phone ?? null,
    emergencyContact: data.emergencyContact ?? null, emergencyPhone: data.emergencyPhone ?? null,
    guarantorName: data.guarantorName ?? null, guarantorPhone: data.guarantorPhone ?? null,
    moveInDate: data.moveInDate, moveOutDate: null, isActive: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  _tenants = [..._tenants, t];
  return { data: t };
}

export async function updateTenant(id: string, data: Partial<Tenant>): Promise<{ data: Tenant }> {
  _tenants = _tenants.map((t) => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t);
  return { data: _tenants.find((t) => t.id === id)! };
}

// === Phase 4: 家賃管理 (モック) ===

const MOCK_INVOICES: RentInvoice[] = [
  { id: "inv1", companyId: DEFAULT_COMPANY_ID, tenantId: "tn1", propertyId: "p2", billingMonth: "2026-04", amount: 120000, paidAmount: 0, status: "unpaid", dueDate: "2026-04-27", paidAt: null, createdAt: "2026-04-01T00:00:00Z", updatedAt: "2026-04-01T00:00:00Z", tenant: { id: "tn1", name: "高橋美咲" }, property: { id: "p2", name: "サンライズ新宿" } },
  { id: "inv2", companyId: DEFAULT_COMPANY_ID, tenantId: "tn2", propertyId: "p5", billingMonth: "2026-04", amount: 95000, paidAmount: 0, status: "unpaid", dueDate: "2026-04-27", paidAt: null, createdAt: "2026-04-01T00:00:00Z", updatedAt: "2026-04-01T00:00:00Z", tenant: { id: "tn2", name: "伊藤健一" }, property: { id: "p5", name: "メゾン品川" } },
  { id: "inv3", companyId: DEFAULT_COMPANY_ID, tenantId: "tn1", propertyId: "p2", billingMonth: "2026-03", amount: 120000, paidAmount: 120000, status: "paid", dueDate: "2026-03-27", paidAt: "2026-03-25T10:00:00Z", createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-25T10:00:00Z", tenant: { id: "tn1", name: "高橋美咲" }, property: { id: "p2", name: "サンライズ新宿" } },
  { id: "inv4", companyId: DEFAULT_COMPANY_ID, tenantId: "tn2", propertyId: "p5", billingMonth: "2026-03", amount: 95000, paidAmount: 95000, status: "paid", dueDate: "2026-03-27", paidAt: "2026-03-26T10:00:00Z", createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-26T10:00:00Z", tenant: { id: "tn2", name: "伊藤健一" }, property: { id: "p5", name: "メゾン品川" } },
  { id: "inv5", companyId: DEFAULT_COMPANY_ID, tenantId: "tn2", propertyId: "p5", billingMonth: "2026-02", amount: 95000, paidAmount: 50000, status: "partial", dueDate: "2026-02-27", paidAt: null, createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z", tenant: { id: "tn2", name: "伊藤健一" }, property: { id: "p5", name: "メゾン品川" } },
];

let _invoices = [...MOCK_INVOICES];

export async function fetchInvoices(): Promise<{ data: RentInvoice[] }> {
  return { data: _invoices };
}

export async function processPayment(id: string, amount: number): Promise<{ data: RentInvoice }> {
  _invoices = _invoices.map((inv) => {
    if (inv.id !== id) return inv;
    const newPaid = inv.paidAmount + amount;
    const newStatus: InvoiceStatus = newPaid >= inv.amount ? "paid" : "partial";
    return { ...inv, paidAmount: newPaid, status: newStatus, paidAt: newStatus === "paid" ? new Date().toISOString() : inv.paidAt, updatedAt: new Date().toISOString() };
  });
  return { data: _invoices.find((i) => i.id === id)! };
}

// === Phase 4: 契約更新 (モック) ===

const MOCK_RENEWALS: Renewal[] = [
  { id: "rn1", companyId: DEFAULT_COMPANY_ID, contractId: "con2", tenantId: "tn1", propertyId: "p2", currentEndDate: "2028-03-31", newEndDate: null, status: "upcoming", renewalFee: 120000, notifiedAt: null, createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z", tenant: { id: "tn1", name: "高橋美咲" }, property: { id: "p2", name: "サンライズ新宿" } },
  { id: "rn2", companyId: DEFAULT_COMPANY_ID, contractId: "con3", tenantId: "tn2", propertyId: "p5", currentEndDate: "2027-09-30", newEndDate: null, status: "notified", renewalFee: 95000, notifiedAt: "2026-03-15T10:00:00Z", createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-03-15T10:00:00Z", tenant: { id: "tn2", name: "伊藤健一" }, property: { id: "p5", name: "メゾン品川" } },
];

let _renewals = [...MOCK_RENEWALS];

export async function fetchRenewals(): Promise<{ data: Renewal[] }> {
  return { data: _renewals };
}

export async function updateRenewalStatus(id: string, status: RenewalStatus, newEndDate?: string): Promise<{ data: Renewal }> {
  _renewals = _renewals.map((r) => r.id === id ? { ...r, status, newEndDate: newEndDate ?? r.newEndDate, updatedAt: new Date().toISOString() } : r);
  return { data: _renewals.find((r) => r.id === id)! };
}

// === Phase 4: 退去管理 (モック) ===

const MOCK_VACATIONS: Vacation[] = [
  {
    id: "vac1", companyId: DEFAULT_COMPANY_ID, tenantId: "tn2", propertyId: "p5",
    requestedMoveOut: "2026-06-30", actualMoveOut: null, status: "requested",
    inspectionDate: null, depositReturn: null, deductions: null,
    checklist: [
      { item: "壁紙の汚損チェック", checked: false },
      { item: "床の傷チェック", checked: false },
      { item: "水回り清掃確認", checked: false },
      { item: "鍵の返却", checked: false },
      { item: "エアコン動作確認", checked: false },
    ],
    notes: "転勤のため", createdAt: "2026-03-30T10:00:00Z", updatedAt: "2026-03-30T10:00:00Z",
    tenant: { id: "tn2", name: "伊藤健一" }, property: { id: "p5", name: "メゾン品川" },
  },
];

let _vacations = [...MOCK_VACATIONS];

export async function fetchVacations(): Promise<{ data: Vacation[] }> {
  return { data: _vacations };
}

export async function createVacation(data: {
  tenantId: string; propertyId: string; requestedMoveOut: string; notes?: string;
}): Promise<{ data: Vacation }> {
  const v: Vacation = {
    id: `vac${Date.now()}`, companyId: DEFAULT_COMPANY_ID,
    tenantId: data.tenantId, propertyId: data.propertyId,
    requestedMoveOut: data.requestedMoveOut, actualMoveOut: null, status: "requested",
    inspectionDate: null, depositReturn: null, deductions: null,
    checklist: [
      { item: "壁紙の汚損チェック", checked: false }, { item: "床の傷チェック", checked: false },
      { item: "水回り清掃確認", checked: false }, { item: "鍵の返却", checked: false },
      { item: "エアコン動作確認", checked: false },
    ],
    notes: data.notes ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  _vacations = [..._vacations, v];
  return { data: v };
}

export async function updateVacation(id: string, data: Partial<Vacation>): Promise<{ data: Vacation }> {
  _vacations = _vacations.map((v) => v.id === id ? { ...v, ...data, updatedAt: new Date().toISOString() } : v);
  return { data: _vacations.find((v) => v.id === id)! };
}

// === Phase 4: 物件掲載入力自動化 (モック) ===

export async function extractPropertyFromText(text: string): Promise<{ data: ExtractedProperty }> {
  // モック: テキストからそれっぽい値を抽出
  const rentMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
  const areaMatch = text.match(/([\d.]+)\s*m[²2]/);
  const layoutMatch = text.match(/(\d[SLDK]+)/);
  const stationMatch = text.match(/([\u4e00-\u9fa5]+)駅/);
  const walkMatch = text.match(/徒歩\s*(\d+)\s*分/);
  return {
    data: {
      name: null, propertyType: "mansion", address: null,
      rent: rentMatch ? Number(rentMatch[1].replace(/,/g, "")) : null,
      managementFee: null, deposit: null, keyMoney: null,
      roomLayout: layoutMatch ? layoutMatch[1] : null,
      floorArea: areaMatch ? Number(areaMatch[1]) : null,
      nearestStation: stationMatch ? stationMatch[1] : null,
      walkMinutes: walkMatch ? Number(walkMatch[1]) : null,
      builtYear: null, features: [], description: text.slice(0, 200),
    },
  };
}

export async function extractPropertyFromUrl(url: string): Promise<{ data: ExtractedProperty }> {
  // モック: URLからダミーデータ返却
  return {
    data: {
      name: `物件（${url.slice(-10)}）`, propertyType: "mansion",
      address: "東京都渋谷区〇〇1-2-3",
      rent: 120000, managementFee: 5000, deposit: 120000, keyMoney: 120000,
      roomLayout: "1LDK", floorArea: 40.5, nearestStation: "渋谷", walkMinutes: 8,
      builtYear: 2020, features: ["オートロック", "宅配ボックス"],
      description: `URL ${url} から抽出した物件情報（モック）`,
    },
  };
}

// === Phase 5: 売買物件 ===

export async function fetchSaleProperties(): Promise<{ data: SaleProperty[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: "100" });
  const res = await request<{ data: SaleProperty[]; pagination: unknown }>(`/api/sale-properties?${sp}`);
  return { data: res.data };
}

export async function createSaleProperty(data: {
  name: string; address: string; propertyType: string; price: number;
  landArea?: number; buildingArea?: number; builtYear?: number;
  roomLayout?: string; description?: string; assignedUserId?: string;
}): Promise<{ data: SaleProperty }> {
  return request<{ data: SaleProperty }>("/api/sale-properties", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

export async function updateSaleProperty(id: string, data: Partial<SaleProperty>): Promise<{ data: SaleProperty }> {
  return request<{ data: SaleProperty }>(`/api/sale-properties/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// === Phase 5: 売買案件 ===

export async function fetchSaleCases(): Promise<{ data: SaleCase[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: "100" });
  const res = await request<{ data: SaleCase[]; pagination: unknown }>(`/api/sale-cases?${sp}`);
  return { data: res.data };
}

export async function createSaleCase(data: {
  salePropertyId: string; customerId: string; assignedUserId?: string; notes?: string;
}): Promise<{ data: SaleCase }> {
  return request<{ data: SaleCase }>("/api/sale-cases", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, caseType: "purchase", ...data }),
  });
}

export async function updateSaleCase(id: string, data: Partial<SaleCase>): Promise<{ data: SaleCase }> {
  return request<{ data: SaleCase }>(`/api/sale-cases/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// === Phase 5: 来店記録 ===

export async function fetchVisits(): Promise<{ data: Visit[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: "100" });
  const res = await request<{ data: Visit[]; pagination: unknown }>(`/api/visits?${sp}`);
  return { data: res.data };
}

export async function createVisit(data: {
  customerId: string; assignedUserId?: string; visitDate: string;
  source: string; purpose?: string; result: string; notes?: string;
}): Promise<{ data: Visit }> {
  return request<{ data: Visit }>("/api/visits", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

// === Phase 5: 来店分析サマリー ===

export async function fetchAnalyticsSummary(): Promise<{ data: AnalyticsSummary }> {
  const today = new Date();
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });

  const [statsRes, conversionRes] = await Promise.all([
    request<{ data: { totalVisits: number; conversionRate: number; contractRate: number; byPurpose: Record<string, number>; byResult: Record<string, number>; byChannel: Record<string, number> } }>(`/api/visits/stats?${sp}`),
    request<{ data: { counts: { completedViewings: number; applications: number; approvedApplications: number; contracts: number }; conversionRates: Record<string, number> } }>(`/api/analytics/conversion?${sp}`),
  ]);

  const visitCount = statsRes.data.totalVisits;
  const applicationCount = statsRes.data.byResult["application"] ?? 0;
  const contractCount = statsRes.data.byResult["contracted"] ?? 0;
  const inquiryCount = visitCount + conversionRes.data.counts.applications;

  return {
    data: {
      period,
      inquiryCount,
      visitCount,
      applicationCount,
      contractCount,
      visitRate: inquiryCount > 0 ? (visitCount / inquiryCount) * 100 : 0,
      applicationRate: visitCount > 0 ? (applicationCount / visitCount) * 100 : 0,
      contractRate: visitCount > 0 ? (contractCount / visitCount) * 100 : 0,
      byStaff: [],
      aiSuggestions: [],
    },
  };
}

// === Phase 5: 切り返しAI ===

export async function generateComeback(objection: string, style: ComebackStyle): Promise<{ data: ComebackResponse }> {
  const res = await request<{ data: { objection: string; category: string; comebacks: { text: string; approach: string; tone: string }[] } }>("/api/ai/comeback", {
    method: "POST",
    body: JSON.stringify({ objection }),
  });
  return {
    data: {
      objection: res.data.objection,
      style,
      suggestions: res.data.comebacks.map((c) => ({ text: c.text, reasoning: c.approach })),
    },
  };
}
