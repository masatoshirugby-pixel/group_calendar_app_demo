"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GROUPS } from "@/lib/api";

export default function Onboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");

  function toggle(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function addCustom() {
    const s = customInput.trim();
    if (!s) return;
    if (!selected.includes(s)) setSelected((prev) => [...prev, s]);
    setCustomInput("");
  }

  function confirm() {
    if (selected.length === 0) return;
    localStorage.setItem("gcad_selected_groups", JSON.stringify(selected));
    localStorage.setItem("gcad_active_group", selected[0]);
    router.push(`/calendar?group=${encodeURIComponent(selected[0])}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">グループカレンダー</h1>
      <p className="text-gray-500 text-sm mb-10">
        カレンダーに表示するグループを選んでください（複数可）
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-md mb-6">
        {GROUPS.map((g) => (
          <button
            key={g.slug}
            onClick={() => toggle(g.slug)}
            className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${
              selected.includes(g.slug)
                ? "border-gray-800 bg-gray-800 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 w-full max-w-md mb-10">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="サブドメインを入力 (例: ukka)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
        />
        <button
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg disabled:opacity-40 hover:bg-gray-300"
        >
          追加
        </button>
      </div>

      <button
        onClick={confirm}
        disabled={selected.length === 0}
        className="px-8 py-3 bg-gray-800 text-white rounded-xl font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors"
      >
        始める {selected.length > 0 && `（${selected.length}グループ）`}
      </button>
    </div>
  );
}
