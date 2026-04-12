"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-2"
    >
      <ChevronLeft size={16} />
      戻る
    </button>
  );
}
