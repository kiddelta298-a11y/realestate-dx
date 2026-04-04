"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import {
  fetchViewings,
  createViewing,
  updateViewingStatus,
  updateViewing,
  fetchProperties,
  fetchCustomers,
} from "@/lib/api";
import type { Viewing, ViewingStatus, Property, Customer } from "@/types";
import { viewingStatusLabel } from "@/types";

const statusColors: Record<ViewingStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 9); // 9:00 ~ 19:00
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ViewMode = "week" | "month";

type BookingForm = {
  propertyId: string;
  customerId: string;
  assignedUserId: string;
  date: string;
  startHour: string;
  endHour: string;
  notes: string;
};

const emptyBooking: BookingForm = {
  propertyId: "",
  customerId: "",
  assignedUserId: "",
  date: "",
  startHour: "10",
  endHour: "11",
  notes: "",
};

const STAFF = [
  { id: "u1", name: "山田" },
  { id: "u2", name: "佐藤" },
  { id: "u3", name: "田口" },
];

export default function ViewingsPage() {
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBooking);
  const [saving, setSaving] = useState(false);
  const [staffFilter, setStaffFilter] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [vRes, pRes, cRes] = await Promise.all([
        fetchViewings(),
        fetchProperties({ limit: 100 }).catch(() => ({ data: [] })),
        fetchCustomers({ limit: 100 }).catch(() => ({ data: [] })),
      ]);
      setViewings(vRes.data);
      setProperties(pRes.data);
      setCustomers(cRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Week view data
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Month view data
  const monthStart = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return d;
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const start = new Date(monthStart);
    start.setDate(start.getDate() - start.getDay()); // Sunday before month start
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(addDays(start, i));
    }
    return days;
  }, [monthStart]);

  function viewingsOnDate(date: Date): Viewing[] {
    const dateStr = isoDate(date);
    return viewings.filter((v) => {
      const vDate = v.scheduledAt.slice(0, 10);
      if (vDate !== dateStr) return false;
      if (staffFilter && v.assignedUserId !== staffFilter) return false;
      return true;
    });
  }

  function openBooking(date?: Date) {
    setBookingForm({
      ...emptyBooking,
      date: date ? isoDate(date) : "",
    });
    setBookingOpen(true);
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingForm.propertyId || !bookingForm.customerId || !bookingForm.date) return;
    setSaving(true);
    try {
      const start = `${bookingForm.date}T${bookingForm.startHour.padStart(2, "0")}:00:00+09:00`;
      const end = `${bookingForm.date}T${bookingForm.endHour.padStart(2, "0")}:00:00+09:00`;
      await createViewing({
        propertyId: bookingForm.propertyId,
        customerId: bookingForm.customerId,
        assignedUserId: bookingForm.assignedUserId || undefined,
        scheduledAt: start,
        endAt: end,
        notes: bookingForm.notes || undefined,
      });
      setBookingOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "予約に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("この内見予約をキャンセルしますか？")) return;
    try {
      await updateViewingStatus(id, "cancelled");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "キャンセルに失敗しました");
    }
  }

  async function handleComplete(id: string) {
    try {
      await updateViewingStatus(id, "completed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  function navigatePrev() {
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
    }
  }

  function navigateNext() {
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
        <button onClick={load} className="mt-2 text-sm text-red-600 underline">再試行</button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="内見予約"
        description="内見スケジュール管理"
        actions={
          <button
            onClick={() => openBooking()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + 新規予約
          </button>
        }
      />

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            &lt;
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            今日
          </button>
          <button
            onClick={navigateNext}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            &gt;
          </button>
          <span className="text-sm font-medium text-gray-700 ml-2">
            {viewMode === "week"
              ? `${weekDays[0].getFullYear()}年${weekDays[0].getMonth() + 1}月${weekDays[0].getDate()}日 〜 ${weekDays[6].getMonth() + 1}月${weekDays[6].getDate()}日`
              : `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">全担当者</option>
            {STAFF.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-sm ${viewMode === "week" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              週
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm ${viewMode === "month" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              月
            </button>
          </div>
        </div>
      </div>

      {/* Week View */}
      {viewMode === "week" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="px-2 py-2 text-xs text-gray-500 bg-gray-50" />
            {weekDays.map((d, i) => {
              const isToday = isoDate(d) === isoDate(new Date());
              return (
                <div
                  key={i}
                  className={`px-2 py-2 text-center text-xs font-medium border-l border-gray-200 ${isToday ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"}`}
                >
                  {formatDate(d)}
                </div>
              );
            })}
          </div>
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100 min-h-[3rem]">
              <div className="px-2 py-1 text-xs text-gray-400 bg-gray-50 text-right pr-3">
                {hour}:00
              </div>
              {weekDays.map((d, di) => {
                const dayViewings = viewingsOnDate(d).filter((v) => {
                  const h = new Date(v.scheduledAt).getHours();
                  return h === hour;
                });
                return (
                  <div
                    key={di}
                    className="border-l border-gray-100 px-1 py-0.5 cursor-pointer hover:bg-gray-50"
                    onClick={() => openBooking(d)}
                  >
                    {dayViewings.map((v) => (
                      <div
                        key={v.id}
                        className={`text-xs rounded px-1.5 py-0.5 mb-0.5 truncate ${v.status === "cancelled" ? "bg-gray-100 text-gray-400 line-through" : v.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                        title={`${v.customer?.name ?? "顧客"} - ${v.property?.name ?? "物件"} (${v.assignedUser?.name ?? "未割当"})`}
                      >
                        {v.customer?.name ?? "顧客"} / {v.property?.name ?? "物件"}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Month View */}
      {viewMode === "month" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {WEEKDAYS.map((w, i) => (
              <div
                key={i}
                className={`px-2 py-2 text-center text-xs font-medium bg-gray-50 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"}`}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((d, i) => {
              const isCurrentMonth = d.getMonth() === currentDate.getMonth();
              const isToday = isoDate(d) === isoDate(new Date());
              const dayViewings = viewingsOnDate(d);
              return (
                <div
                  key={i}
                  className={`border-b border-r border-gray-100 min-h-[5rem] p-1 cursor-pointer hover:bg-gray-50 ${!isCurrentMonth ? "bg-gray-50" : ""}`}
                  onClick={() => openBooking(d)}
                >
                  <div className={`text-xs mb-1 ${isToday ? "bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center" : isCurrentMonth ? "text-gray-700" : "text-gray-400"}`}>
                    {d.getDate()}
                  </div>
                  {dayViewings.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      className={`text-xs rounded px-1 py-0.5 mb-0.5 truncate ${v.status === "cancelled" ? "bg-gray-100 text-gray-400" : v.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                    >
                      {new Date(v.scheduledAt).getHours()}:00 {v.customer?.name ?? ""}
                    </div>
                  ))}
                  {dayViewings.length > 3 && (
                    <div className="text-xs text-gray-400">+{dayViewings.length - 3}件</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Viewings List */}
      <div className="mt-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">直近の内見予約</h3>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">日時</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">顧客</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">物件</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">担当</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600">ステータス</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {viewings
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 text-xs">
                      {new Date(v.scheduledAt).toLocaleString("ja-JP", {
                        month: "numeric", day: "numeric", weekday: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      〜
                      {new Date(v.endAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-gray-900 font-medium">
                      {v.customer?.name ?? v.customerId}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {v.property?.name ?? v.propertyId}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {v.assignedUser?.name ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[v.status]}`}>
                        {viewingStatusLabel[v.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {v.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => handleComplete(v.id)}
                              className="text-green-600 hover:text-green-800 text-xs font-medium"
                            >
                              完了
                            </button>
                            <button
                              onClick={() => handleCancel(v.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium"
                            >
                              キャンセル
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Modal */}
      {bookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">内見予約</h2>
            <form onSubmit={handleBook} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  物件 <span className="text-red-500">*</span>
                </label>
                <select
                  value={bookingForm.propertyId}
                  onChange={(e) => setBookingForm({ ...bookingForm, propertyId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">物件を選択</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  顧客 <span className="text-red-500">*</span>
                </label>
                <select
                  value={bookingForm.customerId}
                  onChange={(e) => setBookingForm({ ...bookingForm, customerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">顧客を選択</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                <select
                  value={bookingForm.assignedUserId}
                  onChange={(e) => setBookingForm({ ...bookingForm, assignedUserId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">未割当</option>
                  {STAFF.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日付 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={bookingForm.date}
                  onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
                  <select
                    value={bookingForm.startHour}
                    onChange={(e) => setBookingForm({ ...bookingForm, startHour: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={String(h)}>{h}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
                  <select
                    value={bookingForm.endHour}
                    onChange={(e) => setBookingForm({ ...bookingForm, endHour: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={String(h)}>{h}:00</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                <textarea
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setBookingOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={saving}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {saving ? "予約中..." : "予約する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
