"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchTasks, updateTask } from "@/lib/api";
import type { Task, TaskApiStatus } from "@/types";
import { taskStatusLabel, priorityLabel } from "@/types";

const priorityBadge: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const statusBadge: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-500",
};

const allStatuses: TaskApiStatus[] = ["pending", "in_progress", "done", "cancelled"];

function isOverdue(task: Task): boolean {
  return !!(
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "done" &&
    task.status !== "cancelled"
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTasks({ limit: 100 });
      setTasks(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const assignees = Array.from(
    new Set(tasks.map((t) => t.assignedUser?.name).filter(Boolean))
  ).sort() as string[];

  const filtered = tasks.filter((t) => {
    if (assigneeFilter && (t.assignedUser?.name ?? "") !== assigneeFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  async function handleStatusChange(taskId: string, newStatus: TaskApiStatus) {
    try {
      await updateTask(taskId, { status: newStatus });
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ステータス更新に失敗しました");
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
        <button
          onClick={loadTasks}
          className="mt-2 text-sm text-red-600 underline hover:text-red-800"
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="タスク管理"
        description="担当タスクの一覧と進捗管理"
      />

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">全担当者</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">全ステータス</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {taskStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">タイトル</th>
              <th className="px-4 py-3 font-medium">担当者</th>
              <th className="px-4 py-3 font-medium">優先度</th>
              <th className="px-4 py-3 font-medium">ステータス</th>
              <th className="px-4 py-3 font-medium">期限</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => {
              const overdue = isOverdue(task);
              return (
                <tr
                  key={task.id}
                  className={`border-b border-gray-100 ${
                    overdue ? "bg-red-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {overdue && (
                        <span className="text-red-500" title="期限超過">
                          &#9888;
                        </span>
                      )}
                      <span className="font-medium text-gray-900">
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {task.assignedUser?.name ?? "未割当"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${priorityBadge[task.priority]}`}
                    >
                      {priorityLabel[task.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        handleStatusChange(
                          task.id,
                          e.target.value as TaskApiStatus
                        )
                      }
                      className={`rounded text-xs font-medium px-2 py-1 border-0 cursor-pointer ${statusBadge[task.status]}`}
                    >
                      {allStatuses.map((s) => (
                        <option key={s} value={s}>
                          {taskStatusLabel[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {task.dueDate ?? "-"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  該当するタスクがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
