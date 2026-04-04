"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchContracts, signContract, updateContractStatus } from "@/lib/api";
import type { Contract, ContractStatus } from "@/types";
import { contractStatusLabel } from "@/types";

const statusColors: Record<ContractStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_signature: "bg-yellow-100 text-yellow-700",
  signed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signDone, setSignDone] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchContracts();
      setContracts(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openSign(contract: Contract) {
    setSigningId(contract.id);
    setAgreed(false);
    setSignDone(false);
  }

  async function handleSign() {
    if (!signingId || !agreed) return;
    try {
      await signContract(signingId);
      setSignDone(true);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "署名に失敗しました");
    }
  }

  async function handleStatusChange(id: string, status: ContractStatus) {
    try {
      await updateContractStatus(id, status);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "ステータス更新に失敗しました");
    }
  }

  const signingContract = contracts.find((c) => c.id === signingId);

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
      <PageHeader title="電子契約" description="契約書一覧・電子署名管理" />

      {/* Contract List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">契約ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">顧客</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">物件</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">月額賃料</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">契約期間</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contracts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {c.customer?.name ?? c.customerId}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {c.property?.name ?? c.propertyId}
                  {c.property?.address && (
                    <span className="text-xs text-gray-500 block">{c.property.address}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {c.monthlyRent.toLocaleString()}円
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {c.startDate} 〜 {c.endDate}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[c.status]}`}>
                    {contractStatusLabel[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {c.status === "pending_signature" && (
                      <button
                        onClick={() => openSign(c)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        署名する
                      </button>
                    )}
                    {c.status === "signed" && (
                      <button
                        onClick={() => handleStatusChange(c.id, "completed")}
                        className="text-green-600 hover:text-green-800 text-xs font-medium"
                      >
                        完了にする
                      </button>
                    )}
                    {c.signedAt && (
                      <span className="text-xs text-gray-400">
                        署名: {new Date(c.signedAt).toLocaleDateString("ja-JP")}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  契約データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sign Modal */}
      {signingId && signingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            {signDone ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">&#x2705;</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">署名が完了しました</h2>
                <p className="text-gray-600 mb-4">
                  契約書は正常に署名されました。
                </p>
                <button
                  onClick={() => setSigningId(null)}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-4">電子署名</h2>

                {/* Contract Preview */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">賃貸借契約書（プレビュー）</h3>
                  <div className="text-xs text-gray-600 space-y-2">
                    <p>
                      <strong>契約者:</strong> {signingContract.customer?.name}
                    </p>
                    <p>
                      <strong>物件:</strong> {signingContract.property?.name}（{signingContract.property?.address}）
                    </p>
                    <p>
                      <strong>契約期間:</strong> {signingContract.startDate} 〜 {signingContract.endDate}
                    </p>
                    <p>
                      <strong>月額賃料:</strong> {signingContract.monthlyRent.toLocaleString()}円
                    </p>
                    <p>
                      <strong>敷金:</strong> {signingContract.deposit.toLocaleString()}円 /
                      <strong> 礼金:</strong> {signingContract.keyMoney.toLocaleString()}円
                    </p>
                    <hr className="border-gray-300 my-2" />
                    <p>
                      第1条（目的）貸主は、上記物件を借主に賃貸し、借主はこれを賃借する。
                    </p>
                    <p>
                      第2条（賃料）借主は、毎月末日までに翌月分の賃料を貸主に支払うものとする。
                    </p>
                    <p>
                      第3条（契約期間）本契約の期間は上記のとおりとし、期間満了の6ヶ月前までに
                      当事者の一方から更新しない旨の通知がない限り、同一条件で更新されるものとする。
                    </p>
                    <p>
                      第4条（禁止事項）借主は、貸主の書面による承諾なく、物件の改築・増築・転貸を行ってはならない。
                    </p>
                  </div>
                </div>

                {/* Signature Area */}
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">署名欄</p>
                  <div className="bg-white border-2 border-dashed border-gray-300 rounded h-20 flex items-center justify-center text-gray-400 text-sm">
                    {signingContract.customer?.name}（電子署名）
                  </div>
                </div>

                {/* Agreement */}
                <label className="flex items-start gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    上記契約内容を確認し、すべての条項に同意します。電子署名を行うことで
                    法的拘束力のある契約が成立することを理解しています。
                  </span>
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSigningId(null)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSign}
                    disabled={!agreed}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    署名を送信
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
