"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchProperties, fetchCustomers, createApplication } from "@/lib/api";
import type { Property, Customer } from "@/types";

type ApplicationForm = {
  propertyId: string;
  customerId: string;
  desiredMoveIn: string;
  notes: string;
};

const emptyForm: ApplicationForm = {
  propertyId: "",
  customerId: "",
  desiredMoveIn: "",
  notes: "",
};

export default function ApplyPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState<{ customerName: string; propertyName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetchProperties({ status: "available", limit: 100 }),
        fetchCustomers({ limit: 100 }),
      ]);
      setProperties(pRes.data);
      setCustomers(cRes.data);
    } catch {
      setProperties([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyId || !form.customerId) {
      setError("顧客と物件を選択してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createApplication({
        customerId: form.customerId,
        propertyId: form.propertyId,
        desiredMoveIn: form.desiredMoveIn || undefined,
        notes: form.notes || undefined,
      });
      const customer = customers.find((c) => c.id === form.customerId);
      const property = properties.find((p) => p.id === form.propertyId);
      setSubmittedInfo({
        customerName: customer?.name ?? form.customerId,
        propertyName: property?.name ?? form.propertyId,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "申込に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && submittedInfo) {
    return (
      <div>
        <PageHeader title="Web申込" description="物件への入居申込" />
        <div className="bg-white rounded-lg shadow p-8 max-w-lg mx-auto text-center">
          <div className="text-5xl mb-4">&#x2705;</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">申込を受け付けました</h2>
          <p className="text-gray-600 mb-4">
            審査結果は3〜5営業日以内にご連絡いたします。
          </p>
          <p className="text-sm text-gray-500 mb-6">
            申込者: {submittedInfo.customerName}<br />
            物件: {submittedInfo.propertyName}
          </p>
          <button
            onClick={() => { setSubmitted(false); setSubmittedInfo(null); setForm(emptyForm); }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            別の申込を作成
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
      <PageHeader title="Web申込" description="入居申込の作成" />

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              顧客 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">顧客を選択してください</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.email ? ` (${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              物件 <span className="text-red-500">*</span>
            </label>
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

        <div className="flex justify-end mt-6">
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
