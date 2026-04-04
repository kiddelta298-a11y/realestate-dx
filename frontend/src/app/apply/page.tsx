"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchProperties, createApplication } from "@/lib/api";
import type { Property } from "@/types";

type ApplicationForm = {
  propertyId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  employer: string;
  annualIncome: string;
  desiredMoveIn: string;
  notes: string;
};

const emptyForm: ApplicationForm = {
  propertyId: "",
  applicantName: "",
  applicantEmail: "",
  applicantPhone: "",
  employer: "",
  annualIncome: "",
  desiredMoveIn: "",
  notes: "",
};

export default function ApplyPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProperties = useCallback(async () => {
    try {
      const res = await fetchProperties({ status: "available", limit: 100 });
      setProperties(res.data);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyId || !form.applicantName || !form.applicantEmail || !form.applicantPhone) {
      setError("必須項目を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createApplication({
        propertyId: form.propertyId,
        applicantName: form.applicantName,
        applicantEmail: form.applicantEmail,
        applicantPhone: form.applicantPhone,
        employer: form.employer || undefined,
        annualIncome: form.annualIncome ? Number(form.annualIncome) : undefined,
        desiredMoveIn: form.desiredMoveIn || undefined,
        notes: form.notes || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "申込に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <PageHeader title="Web申込" description="物件への入居申込" />
        <div className="bg-white rounded-lg shadow p-8 max-w-lg mx-auto text-center">
          <div className="text-5xl mb-4">&#x2705;</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">申込を受け付けました</h2>
          <p className="text-gray-600 mb-4">
            審査結果は3〜5営業日以内にメールでご連絡いたします。
          </p>
          <p className="text-sm text-gray-500 mb-6">
            申込者: {form.applicantName}<br />
            メール: {form.applicantEmail}
          </p>
          <button
            onClick={() => { setSubmitted(false); setForm(emptyForm); }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            別の物件に申込む
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Web申込" description="物件への入居申込フォーム" />

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">物件選択</h3>
        <div className="mb-6">
          <select
            value={form.propertyId}
            onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">物件を選択してください</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {p.address} ({p.rent.toLocaleString()}円/月)
              </option>
            ))}
          </select>
        </div>

        <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">申込者情報</h3>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.applicantName}
              onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.applicantEmail}
                onChange={(e) => setForm({ ...form, applicantEmail: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                電話番号 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.applicantPhone}
                onChange={(e) => setForm({ ...form, applicantPhone: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">勤務先</label>
              <input
                type="text"
                value={form.employer}
                onChange={(e) => setForm({ ...form, employer: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年収 (万円)</label>
              <input
                type="number"
                value={form.annualIncome}
                onChange={(e) => setForm({ ...form, annualIncome: e.target.value })}
                placeholder="500"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">希望入居日</label>
            <input
              type="date"
              value={form.desiredMoveIn}
              onChange={(e) => setForm({ ...form, desiredMoveIn: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ペット飼育希望、保証人情報など"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "送信中..." : "申込を送信"}
          </button>
        </div>
      </form>
    </div>
  );
}
