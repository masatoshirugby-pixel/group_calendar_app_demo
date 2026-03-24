"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Group } from "@/lib/api";

interface Props {
  groups: Group[];
}

export default function GroupSelector({ groups }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState("");

  function handleGo(slug: string) {
    const s = slug.trim();
    if (!s) return;
    router.push(`/calendar?group=${encodeURIComponent(s)}`);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
      {/* プルダウン */}
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">対応グループから選ぶ</p>
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="">グループを選択...</option>
            {groups.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleGo(selected)}
            disabled={!selected}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-gray-700"
          >
            見る
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <hr className="flex-1 border-gray-100" />
        <span className="text-xs text-gray-400">または</span>
        <hr className="flex-1 border-gray-100" />
      </div>

      {/* 直接入力 */}
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">
          グループのサブドメインを入力
        </p>
        <p className="text-xs text-gray-400 mb-2">
          例）cutiestreet（https://<strong>cutiestreet</strong>.asobisystem.com）
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGo(input)}
            placeholder="グループ名を入力..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
          />
          <button
            onClick={() => handleGo(input)}
            disabled={!input.trim()}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-gray-700"
          >
            見る
          </button>
        </div>
      </div>
    </div>
  );
}
