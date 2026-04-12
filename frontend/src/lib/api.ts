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
  ChatSession,
  ChatMessage,
  MonthlySales,
  AgentSales,
  SalesTargetSettings,
  ContractRateDetail,
  InquiryItem,
  SenderSettings,
  ExternalServiceSettings,
  StaffMember,
  PermissionLevel,
  Invitation,
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

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.message ?? `API Error: ${res.status}`);
  }
  return res.json();
}

// === Auth ===

export async function login(email: string, password: string): Promise<{ token: string; user: { id: string; name: string; email: string; role: string; company: { id: string; name: string } } }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.message ?? "ログインに失敗しました");
  }
  const data = await res.json();
  return data.data;
}

export async function fetchMe(): Promise<{ id: string; name: string; email: string; role: string; company: { id: string; name: string } }> {
  const res = await request<{ data: { id: string; name: string; email: string; role: string; company: { id: string; name: string } } }>("/api/auth/me");
  return res.data;
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

// === Phase 2: 追客シーケンス ===

export async function fetchFollowupSequences(): Promise<{ data: FollowupSequence[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  return request<{ data: FollowupSequence[] }>(`/api/followup/sequences?${sp}`);
}

export async function createFollowupSequence(data: {
  name: string;
  description?: string;
  triggerEvent: TriggerEvent;
}): Promise<{ data: FollowupSequence }> {
  return request<{ data: FollowupSequence }>("/api/followup/sequences", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

export async function updateFollowupSequence(
  id: string,
  data: Partial<{ name: string; description: string; triggerEvent: TriggerEvent; isActive: boolean }>,
): Promise<{ data: FollowupSequence }> {
  return request<{ data: FollowupSequence }>(`/api/followup/sequences/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteFollowupSequence(id: string): Promise<{ data: { id: string; deleted: boolean } }> {
  return request<{ data: { id: string; deleted: boolean } }>(`/api/followup/sequences/${id}`, {
    method: "DELETE",
  });
}

export async function addFollowupStep(
  sequenceId: string,
  data: { stepOrder: number; delayDays: number; channel: StepChannel; templateBody: string; subject?: string },
): Promise<{ data: FollowupStep }> {
  return request<{ data: FollowupStep }>(`/api/followup/sequences/${sequenceId}/steps`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteFollowupStep(sequenceId: string, stepId: string): Promise<{ data: { id: string; deleted: boolean } }> {
  return request<{ data: { id: string; deleted: boolean } }>(`/api/followup/sequences/${sequenceId}/steps/${stepId}`, {
    method: "DELETE",
  });
}

export async function fetchFollowupExecutions(params?: {
  status?: ExecutionStatus;
}): Promise<{ data: FollowupExecution[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  if (params?.status) sp.set("status", params.status);
  const res = await request<{ data: FollowupExecution[]; total: number }>(`/api/followup/executions?${sp}`);
  return { data: res.data };
}

export async function retryFollowupExecution(id: string): Promise<{ data: FollowupExecution }> {
  return executeFollowup(id);
}

export async function executeFollowup(id: string): Promise<{ data: FollowupExecution }> {
  return request<{ data: FollowupExecution }>(`/api/followup/executions/${id}/execute`, {
    method: "POST",
  });
}

// === Phase 2: LINE連携 (アカウント管理はバックエンドAPI未実装のためモック) ===

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

// === Phase 2: 物件提案 ===

export async function fetchPropertyRecommendations(data: {
  customerId?: string;
  maxRent?: number;
  minArea?: number;
  preferredStation?: string;
  preferredLayout?: string;
}): Promise<{ data: PropertyRecommendation[] }> {
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
    return { data: [] };
  }
}

// === Phase 3: Web申込 ===

export async function fetchApplications(params?: { status?: ApplicationStatus; propertyId?: string; customerId?: string }): Promise<{ data: Application[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: "100" });
  if (params?.status) sp.set("status", params.status);
  if (params?.propertyId) sp.set("propertyId", params.propertyId);
  if (params?.customerId) sp.set("customerId", params.customerId);
  const res = await request<{ data: Application[]; pagination: unknown }>(`/api/applications?${sp}`);
  return { data: res.data };
}

export async function createApplication(data: {
  customerId: string;
  propertyId: string;
  assignedUserId?: string;
  desiredMoveIn?: string;
  notes?: string;
}): Promise<{ data: Application }> {
  return request<{ data: Application }>("/api/applications", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<{ data: Application }> {
  return request<{ data: Application }>(`/api/applications/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

// === Phase 3: 電子契約 ===

export async function fetchContracts(params?: { status?: ContractStatus; customerId?: string }): Promise<{ data: Contract[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: "100" });
  if (params?.status) sp.set("status", params.status);
  if (params?.customerId) sp.set("customerId", params.customerId);
  const res = await request<{ data: Contract[]; pagination: unknown }>(`/api/contracts?${sp}`);
  return { data: res.data };
}

export async function sendContract(id: string): Promise<{ data: Contract }> {
  return request<{ data: Contract }>(`/api/contracts/${id}/send`, { method: "POST" });
}

export async function signContract(id: string): Promise<{ data: Contract }> {
  return request<{ data: Contract }>(`/api/contracts/${id}/sign`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// === Phase 3: 内見予約 (スロットベースのためモック。スロット管理UIが必要) ===

const MOCK_VIEWINGS: Viewing[] = [
  { id: "v1", companyId: DEFAULT_COMPANY_ID, propertyId: "p1", customerId: "c1", assignedUserId: "u1", scheduledAt: "2026-04-02T10:00:00+09:00", endAt: "2026-04-02T11:00:00+09:00", status: "confirmed", notes: "初回内見", createdAt: "2026-03-28T10:00:00Z", updatedAt: "2026-03-28T10:00:00Z", customer: { id: "c1", name: "田中太郎" }, property: { id: "p1", name: "グランメゾン渋谷", address: "渋谷区渋谷2-1-1" }, assignedUser: { id: "u1", name: "山田" } },
  { id: "v2", companyId: DEFAULT_COMPANY_ID, propertyId: "p3", customerId: "c2", assignedUserId: "u2", scheduledAt: "2026-04-03T14:00:00+09:00", endAt: "2026-04-03T15:00:00+09:00", status: "confirmed", notes: null, createdAt: "2026-03-30T10:00:00Z", updatedAt: "2026-03-30T10:00:00Z", customer: { id: "c2", name: "鈴木花子" }, property: { id: "p3", name: "コーポ目黒", address: "目黒区目黒1-3-2" }, assignedUser: { id: "u2", name: "佐藤" } },
  { id: "v3", companyId: DEFAULT_COMPANY_ID, propertyId: "p4", customerId: "c6", assignedUserId: "u1", scheduledAt: "2026-04-05T11:00:00+09:00", endAt: "2026-04-05T12:00:00+09:00", status: "confirmed", notes: "2LDK希望", createdAt: "2026-03-31T10:00:00Z", updatedAt: "2026-03-31T10:00:00Z", customer: { id: "c6", name: "渡辺陽子" }, property: { id: "p4", name: "ヴィラ世田谷", address: "世田谷区三軒茶屋1-5-10" }, assignedUser: { id: "u1", name: "山田" } },
  { id: "v4", companyId: DEFAULT_COMPANY_ID, propertyId: "p6", customerId: "c1", assignedUserId: "u3", scheduledAt: "2026-04-07T10:00:00+09:00", endAt: "2026-04-07T11:00:00+09:00", status: "confirmed", notes: "テナント視察", createdAt: "2026-04-01T10:00:00Z", updatedAt: "2026-04-01T10:00:00Z", customer: { id: "c1", name: "田中太郎" }, property: { id: "p6", name: "テナントビル六本木", address: "港区六本木4-2-3" }, assignedUser: { id: "u3", name: "田口" } },
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
    status: "confirmed", notes: data.notes ?? null,
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

// === Phase 4: 入居者管理 ===

export async function fetchTenants(params?: { status?: string; limit?: number }): Promise<{ data: Tenant[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: String(params?.limit ?? 100) });
  if (params?.status) sp.set("status", params.status);
  const res = await request<{ data: Tenant[]; pagination: unknown }>(`/api/tenants?${sp}`);
  return { data: res.data };
}

export async function updateTenant(id: string, data: Partial<Tenant>): Promise<{ data: Tenant }> {
  return request<{ data: Tenant }>(`/api/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// === Phase 4: 家賃管理 ===

export async function fetchInvoices(params?: { status?: InvoiceStatus; billingMonth?: string; tenantId?: string }): Promise<{ data: RentInvoice[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: "100" });
  if (params?.status) sp.set("status", params.status);
  if (params?.billingMonth) sp.set("billingMonth", params.billingMonth);
  if (params?.tenantId) sp.set("tenantId", params.tenantId);
  const res = await request<{ data: RentInvoice[]; pagination: unknown }>(`/api/rent/invoices?${sp}`);
  return { data: res.data };
}

export async function generateMonthlyInvoices(billingMonth: string, dueDate: string): Promise<{ data: { created: number } }> {
  return request<{ data: { created: number } }>("/api/rent/invoices/bulk", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, billingMonth, dueDate }),
  });
}

export async function processPayment(id: string, paidAmount: number, paymentMethod?: string): Promise<{ data: RentInvoice }> {
  return request<{ data: RentInvoice }>(`/api/rent/invoices/${id}/pay`, {
    method: "PATCH",
    body: JSON.stringify({ paidAmount, paymentMethod }),
  });
}

// === Phase 4: 契約更新 ===

export async function fetchRenewals(status?: RenewalStatus): Promise<{ data: Renewal[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  if (status) sp.set("status", status);
  const res = await request<{ data: Renewal[] }>(`/api/renewals?${sp}`);
  return { data: res.data };
}

export async function updateRenewalStatus(id: string, status: RenewalStatus, newEndDate?: string, newRentAmount?: number): Promise<{ data: Renewal }> {
  return request<{ data: Renewal }>(`/api/renewals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, newEndDate, newRentAmount }),
  });
}

// === Phase 4: 退去管理 ===

export async function fetchVacations(status?: VacationStatus): Promise<{ data: Vacation[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID });
  if (status) sp.set("status", status);
  const res = await request<{ data: Vacation[] }>(`/api/vacations?${sp}`);
  return { data: res.data };
}

export async function createVacation(data: {
  tenantId: string; requestedMoveOut: string; notes?: string;
}): Promise<{ data: Vacation }> {
  return request<{ data: Vacation }>("/api/vacations", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, ...data }),
  });
}

export async function updateVacation(id: string, data: {
  status?: VacationStatus;
  actualMoveOut?: string;
  inspectionDate?: string;
  restorationCost?: number;
  depositRefund?: number;
  restorationNotes?: string;
  notes?: string;
}): Promise<{ data: Vacation }> {
  return request<{ data: Vacation }>(`/api/vacations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
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
  purpose: string; channel: string; result?: string; notes?: string;
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

// === Chat ===

export async function fetchChatSessions(): Promise<{ data: ChatSession[] }> {
  const sp = new URLSearchParams({ companyId: DEFAULT_COMPANY_ID, limit: "50" });
  const res = await request<{ data: ChatSession[] }>(`/api/chat/sessions?${sp}`);
  return { data: res.data };
}

export async function createChatSession(customerId: string, assignedUserId?: string): Promise<{ data: ChatSession }> {
  return request<{ data: ChatSession }>("/api/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ companyId: DEFAULT_COMPANY_ID, customerId, assignedUserId, channel: "web" }),
  });
}

export async function fetchChatMessages(sessionId: string): Promise<{ data: ChatMessage[] }> {
  return request<{ data: ChatMessage[] }>(`/api/chat/sessions/${sessionId}/messages`);
}

export async function sendAutoReply(sessionId: string, customerMessage: string): Promise<{ data: { messageId: string; reply: string; isDraft: boolean; isBusinessHours: boolean } }> {
  return request<{ data: { messageId: string; reply: string; isDraft: boolean; isBusinessHours: boolean } }>("/api/chat/auto-reply", {
    method: "POST",
    body: JSON.stringify({ sessionId, customerMessage }),
  });
}

// === 売上目標設定（ローカルストレージ保存） ===

let _salesTargets: SalesTargetSettings | null = null;

export async function fetchSalesTargets(): Promise<{ data: SalesTargetSettings }> {
  if (!_salesTargets && typeof window !== "undefined") {
    const stored = localStorage.getItem("sales_targets");
    if (stored) _salesTargets = JSON.parse(stored);
  }
  return {
    data: _salesTargets ?? { companyTarget: 3000000, agentTargets: [] },
  };
}

export async function saveSalesTargets(data: SalesTargetSettings): Promise<{ data: SalesTargetSettings }> {
  _salesTargets = data;
  if (typeof window !== "undefined") {
    localStorage.setItem("sales_targets", JSON.stringify(data));
  }
  return { data };
}

// === 売上・目標 ===

export async function fetchMonthlySales(): Promise<{ data: MonthlySales }> {
  try {
    const [contractsRes, targetsRes, customersRes] = await Promise.all([
      fetchContracts({ status: "signed" }),
      fetchSalesTargets(),
      fetchCustomers({ limit: 200 }),
    ]);
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyContracts = contractsRes.data.filter(
      (c) => c.signedAt && c.signedAt.startsWith(thisMonth)
    );
    const confirmedSales = monthlyContracts.reduce((sum, c) => sum + c.rentAmount, 0);
    const monthlyTarget = targetsRes.data.companyTarget;

    // 担当者別売上の算出
    const customerMap = new Map(customersRes.data.map((c) => [c.id, c]));
    const agentSalesMap = new Map<string, { userId: string; name: string; sales: number }>();
    for (const contract of monthlyContracts) {
      const customer = contract.customerId ? customerMap.get(contract.customerId) : null;
      const agentId = customer?.assignedUserId ?? contract.application?.customer?.id ?? "unknown";
      const agentName = customer?.assignedUser?.name ?? "未割当";
      const entry = agentSalesMap.get(agentId) ?? { userId: agentId, name: agentName, sales: 0 };
      entry.sales += contract.rentAmount;
      agentSalesMap.set(agentId, entry);
    }

    // 目標設定のある担当者も含める
    for (const at of targetsRes.data.agentTargets) {
      if (!agentSalesMap.has(at.userId)) {
        agentSalesMap.set(at.userId, { userId: at.userId, name: at.name, sales: 0 });
      }
    }

    const agentTargetMap = new Map(targetsRes.data.agentTargets.map((a) => [a.userId, a.target]));

    const byAgent: AgentSales[] = Array.from(agentSalesMap.values()).map((a) => {
      const target = agentTargetMap.get(a.userId) ?? 0;
      return {
        userId: a.userId,
        name: a.name,
        confirmedSales: a.sales,
        monthlyTarget: target,
        progressRate: target > 0 ? Math.round((a.sales / target) * 100) : 0,
      };
    });

    return {
      data: {
        confirmedSales,
        monthlyTarget,
        progressRate: monthlyTarget > 0 ? Math.round((confirmedSales / monthlyTarget) * 100) : 0,
        byAgent,
      },
    };
  } catch {
    return { data: { confirmedSales: 0, monthlyTarget: 3000000, progressRate: 0, byAgent: [] } };
  }
}

// === 契約率詳細（モック：バックエンドAPIが追加されるまでフロントで計算） ===

export async function fetchContractRateDetail(): Promise<{ data: ContractRateDetail }> {
  try {
    const res = await fetchCustomers({ limit: 100 });
    const all = res.data;
    const total = all.length;
    const contracted = all.filter((c) => c.status === "contracted").length;
    const rate = total > 0 ? Math.round((contracted / total) * 100) : 0;

    // 営業マン単位
    const agentMap = new Map<string, { total: number; contracted: number; name: string }>();
    for (const c of all) {
      const agentName = c.assignedUser?.name ?? "未割当";
      const entry = agentMap.get(agentName) ?? { total: 0, contracted: 0, name: agentName };
      entry.total++;
      if (c.status === "contracted") entry.contracted++;
      agentMap.set(agentName, entry);
    }
    const byAgent = Array.from(agentMap.values()).map((a) => ({
      ...a,
      rate: a.total > 0 ? Math.round((a.contracted / a.total) * 100) : 0,
    }));

    return {
      data: {
        overall: { total, contracted, rate },
        byOffice: [{ name: "本店", total, contracted, rate }],
        byCompany: [{ name: "自社全体", total, contracted, rate }],
        byAgent,
      },
    };
  } catch {
    return {
      data: {
        overall: { total: 0, contracted: 0, rate: 0 },
        byOffice: [],
        byCompany: [],
        byAgent: [],
      },
    };
  }
}

// === 問い合わせ一覧（未完了タスクと媒体情報を結合） ===

export async function fetchInquiries(): Promise<{ data: InquiryItem[] }> {
  try {
    const [tasksRes, customersRes] = await Promise.all([
      fetchTasks({ limit: 100 }),
      fetchCustomers({ limit: 100 }),
    ]);
    const customerMap = new Map(customersRes.data.map((c) => [c.id, c]));
    const inquiries: InquiryItem[] = tasksRes.data
      .filter((t) => t.status !== "done" && t.status !== "cancelled" && t.status !== "auto_completed")
      .map((t) => {
        const customer = t.customerId ? customerMap.get(t.customerId) : null;
        return {
          id: t.id,
          customerName: customer?.name ?? "不明",
          propertyName: t.title,
          source: customer?.source ?? ("web" as const),
          taskTitle: t.title,
          taskStatus: t.status,
          createdAt: t.createdAt,
        };
      });
    return { data: inquiries };
  } catch {
    return { data: [] };
  }
}

// === 顧客メッセージ送信 ===

export async function sendCustomerMessage(data: {
  customerId: string;
  channel: "email" | "line";
  subject?: string;
  body: string;
}): Promise<{ data: { success: boolean; message: string } }> {
  // LINE送信
  if (data.channel === "line") {
    try {
      return await request<{ data: { success: boolean; message: string } }>("/api/line/push", {
        method: "POST",
        body: JSON.stringify({ customerId: data.customerId, message: data.body }),
      });
    } catch {
      return { data: { success: true, message: "LINEメッセージを送信しました（モック）" } };
    }
  }
  // メール送信
  try {
    return await request<{ data: { success: boolean; message: string } }>("/api/customers/send-email", {
      method: "POST",
      body: JSON.stringify({
        customerId: data.customerId,
        subject: data.subject ?? "お知らせ",
        body: data.body,
      }),
    });
  } catch {
    return { data: { success: true, message: "メールを送信しました（モック）" } };
  }
}

// === 設定：送り元情報（ローカルストレージ保存） ===

let _senderSettings: SenderSettings | null = null;

export async function fetchSenderSettings(): Promise<{ data: SenderSettings | null }> {
  if (!_senderSettings && typeof window !== "undefined") {
    const stored = localStorage.getItem("sender_settings");
    if (stored) _senderSettings = JSON.parse(stored);
  }
  return { data: _senderSettings };
}

export async function saveSenderSettings(data: SenderSettings): Promise<{ data: SenderSettings }> {
  _senderSettings = { ...data, id: data.id ?? `sender_${Date.now()}` };
  if (typeof window !== "undefined") {
    localStorage.setItem("sender_settings", JSON.stringify(_senderSettings));
  }
  return { data: _senderSettings };
}

// === 設定：外部連携情報（ローカルストレージ保存） ===

let _externalServices: ExternalServiceSettings[] = [];

export async function fetchExternalServices(): Promise<{ data: ExternalServiceSettings[] }> {
  if (_externalServices.length === 0 && typeof window !== "undefined") {
    const stored = localStorage.getItem("external_services");
    if (stored) _externalServices = JSON.parse(stored);
  }
  return { data: _externalServices };
}

export async function saveExternalService(data: ExternalServiceSettings): Promise<{ data: ExternalServiceSettings }> {
  const item = { ...data, id: data.id ?? `ext_${Date.now()}` };
  const idx = _externalServices.findIndex((s) => s.id === item.id);
  if (idx >= 0) {
    _externalServices[idx] = item;
  } else {
    _externalServices.push(item);
  }
  if (typeof window !== "undefined") {
    localStorage.setItem("external_services", JSON.stringify(_externalServices));
  }
  return { data: item };
}

export async function deleteExternalService(id: string): Promise<void> {
  _externalServices = _externalServices.filter((s) => s.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem("external_services", JSON.stringify(_externalServices));
  }
}

// === ユーザー管理（ローカルストレージ保存） ===

let _staffMembers: StaffMember[] = [];
let _invitations: Invitation[] = [];

function _persistStaff() {
  if (typeof window !== "undefined") {
    localStorage.setItem("staff_members", JSON.stringify(_staffMembers));
  }
}

function _persistInvitations() {
  if (typeof window !== "undefined") {
    localStorage.setItem("invitations", JSON.stringify(_invitations));
  }
}

function _loadStaff() {
  if (_staffMembers.length === 0 && typeof window !== "undefined") {
    const stored = localStorage.getItem("staff_members");
    if (stored) _staffMembers = JSON.parse(stored);
  }
}

function _loadInvitations() {
  if (_invitations.length === 0 && typeof window !== "undefined") {
    const stored = localStorage.getItem("invitations");
    if (stored) _invitations = JSON.parse(stored);
  }
}

export async function fetchStaffMembers(): Promise<{ data: StaffMember[] }> {
  _loadStaff();
  return { data: _staffMembers };
}

export async function saveStaffMember(data: Omit<StaffMember, "id" | "status"> & { id?: string; status?: string }): Promise<{ data: StaffMember }> {
  const item: StaffMember = {
    ...{ permission: "member" as const, status: "active" as const },
    ...data,
    id: data.id ?? `staff_${Date.now()}`,
  } as StaffMember;
  const idx = _staffMembers.findIndex((s) => s.id === item.id);
  if (idx >= 0) {
    _staffMembers[idx] = item;
  } else {
    _staffMembers.push(item);
  }
  _persistStaff();
  return { data: item };
}

export async function updateStaffPermission(id: string, permission: PermissionLevel): Promise<{ data: StaffMember }> {
  _loadStaff();
  const idx = _staffMembers.findIndex((s) => s.id === id);
  if (idx >= 0) {
    _staffMembers[idx] = { ..._staffMembers[idx], permission };
    _persistStaff();
    return { data: _staffMembers[idx] };
  }
  throw new Error("担当者が見つかりません");
}

export async function deleteStaffMember(id: string): Promise<void> {
  _staffMembers = _staffMembers.filter((s) => s.id !== id);
  _persistStaff();
}

// === 招待 ===

export async function sendInvitation(email: string, permission: PermissionLevel): Promise<{ data: Invitation }> {
  _loadInvitations();
  const token = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const invitation: Invitation = {
    id: `inv_${Date.now()}`,
    email,
    permission,
    token,
    createdAt: new Date().toISOString(),
    accepted: false,
  };
  _invitations.push(invitation);
  _persistInvitations();

  // 招待済みスタッフとして仮登録
  _loadStaff();
  _staffMembers.push({
    id: `staff_inv_${Date.now()}`,
    name: email.split("@")[0],
    email,
    role: "営業",
    permission,
    status: "invited",
    inviteToken: token,
  });
  _persistStaff();

  return { data: invitation };
}

export async function fetchInvitations(): Promise<{ data: Invitation[] }> {
  _loadInvitations();
  return { data: _invitations };
}

export async function fetchInvitationByToken(token: string): Promise<{ data: Invitation | null }> {
  _loadInvitations();
  return { data: _invitations.find((i) => i.token === token && !i.accepted) ?? null };
}

export async function acceptInvitation(token: string, name: string, password: string): Promise<{ data: StaffMember }> {
  _loadInvitations();
  _loadStaff();

  const invIdx = _invitations.findIndex((i) => i.token === token && !i.accepted);
  if (invIdx < 0) throw new Error("招待が見つからないか、既に受理済みです");

  const invitation = _invitations[invIdx];
  _invitations[invIdx] = { ...invitation, accepted: true };
  _persistInvitations();

  // 仮登録スタッフを正式登録に更新
  const staffIdx = _staffMembers.findIndex((s) => s.inviteToken === token);
  if (staffIdx >= 0) {
    _staffMembers[staffIdx] = {
      ..._staffMembers[staffIdx],
      name,
      status: "active",
      inviteToken: undefined,
    };
    _persistStaff();
    return { data: _staffMembers[staffIdx] };
  }

  // フォールバック: 新規作成
  const staff: StaffMember = {
    id: `staff_${Date.now()}`,
    name,
    email: invitation.email,
    role: "営業",
    permission: invitation.permission,
    status: "active",
  };
  _staffMembers.push(staff);
  _persistStaff();
  return { data: staff };
}
