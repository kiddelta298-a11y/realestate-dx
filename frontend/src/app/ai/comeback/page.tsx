"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { generateComeback } from "@/lib/api";
import type { ComebackStyle, ComebackResponse } from "@/types";
import { comebackStyleLabel } from "@/types";

const styles: ComebackStyle[] = ["formal", "casual", "passionate"];

const quickObjections = [
  "まだ検討中です",
  "他社で決めました",
  "予算が合いません",
  "もう少し考えます",
  "今は引っ越す予定がありません",
];

export default function ComebackPage() {
  const [objection, setObjection] = useState("");
  const [style, setStyle] = useState<ComebackStyle>("formal");
  const [result, setResult] = useState<ComebackResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function handleGenerate() {
    if (!objection.trim() || loading) return;
    try {
      setLoading(true);
      setResult(null);
      setCopiedIndex(null);
      const res = await generateComeback(objection.trim(), style);
      setResult(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div>
      <PageHeader
        title="切り返しAI"
        description="断り文句への切り返し案を生成"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel: Input */}
        <div className="w-full lg:w-1/2 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              断り文句入力
            </label>
            <textarea
              value={objection}
              onChange={(e) => setObjection(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="お客様の断り文句を入力してください..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              スタイル
            </label>
            <div className="flex gap-2">
              {styles.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-4 py-2 text-sm rounded-md font-medium border transition-colors ${
                    style === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {comebackStyleLabel[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              よくある断り文句
            </label>
            <div className="flex flex-wrap gap-2">
              {quickObjections.map((q) => (
                <button
                  key={q}
                  onClick={() => setObjection(q)}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!objection.trim() || loading}
            className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                生成中...
              </span>
            ) : (
              "生成する"
            )}
          </button>
        </div>

        {/* Right panel: Results */}
        <div className="w-full lg:w-1/2">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-gray-500">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-sm">生成中...</span>
              </div>
            </div>
          )}

          {!loading && !result && (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              断り文句を入力して「生成する」を押してください
            </div>
          )}

          {!loading && result && (
            <div className="space-y-4">
              {result.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow p-5 relative"
                >
                  <p className="text-sm font-medium text-gray-900 leading-relaxed mb-3">
                    {suggestion.text}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {suggestion.reasoning}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleCopy(suggestion.text, index)}
                      className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      {copiedIndex === index ? (
                        <span className="text-green-600">コピーしました!</span>
                      ) : (
                        "コピー"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
