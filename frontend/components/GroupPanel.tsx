"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GROUPS } from "@/lib/api";

export default function GroupPanel({ currentGroup }: { currentGroup: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addSlug, setAddSlug] = useState("");
  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("gcad_selected_groups");
    if (stored) {
      try { setSelectedGroups(JSON.parse(stored)); } catch {}
    }
  }, []);

  function save(groups: string[]) {
    setSelectedGroups(groups);
    localStorage.setItem("gcad_selected_groups", JSON.stringify(groups));
  }

  function navigate(slug: string) {
    localStorage.setItem("gcad_active_group", slug);
    router.push(`/calendar?group=${encodeURIComponent(slug)}`);
    setIsOpen(false);
  }

  function remove(slug: string) {
    const next = selectedGroups.filter((s) => s !== slug);
    save(next);
    if (slug === currentGroup) {
      if (next.length > 0) {
        navigate(next[0]);
      } else {
        localStorage.removeItem("gcad_active_group");
        localStorage.removeItem("gcad_selected_groups");
        router.push("/");
      }
    }
  }

  function addGroup(slug: string) {
    const s = slug.trim();
    if (!s || selectedGroups.includes(s)) return;
    save([...selectedGroups, s]);
    setShowAdd(false);
    setAddSlug("");
    setCustomInput("");
  }

  const availableToAdd = GROUPS.filter((g) => !selectedGroups.includes(g.slug));

  return (
    <>
      {/* ハンバーガーボタン（常時表示） */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-0 top-4 z-40 bg-white border border-l-0 border-gray-200 rounded-r-lg px-2 py-2.5 shadow-sm hover:bg-gray-50 transition-colors"
        title="グループメニュー"
        aria-label="グループメニューを開く"
      >
        <div className="flex flex-col gap-1">
          <span className="block w-4 h-0.5 bg-gray-500 rounded" />
          <span className="block w-4 h-0.5 bg-gray-500 rounded" />
          <span className="block w-4 h-0.5 bg-gray-500 rounded" />
        </div>
      </button>

      {/* バックドロップ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ドロワーパネル */}
      <div
        className={`fixed left-0 top-0 h-full z-50 w-56 bg-white border-r border-gray-100 flex flex-col shadow-xl transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ヘッダー：グループ追加 ＋ 閉じるボタン */}
        <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <button
            onClick={() => setShowAdd((v) => !v)}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
              showAdd ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <span className="text-base leading-none">{showAdd ? "×" : "＋"}</span>
            <span>グループを追加</span>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 text-sm px-1"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* グループ追加フォーム */}
        {showAdd && (
          <div className="p-3 border-b border-gray-100 flex flex-col gap-2">
            {availableToAdd.length > 0 && (
              <select
                value={addSlug}
                onChange={(e) => setAddSlug(e.target.value)}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="">一覧から選択...</option>
                {availableToAdd.map((g) => (
                  <option key={g.slug} value={g.slug}>{g.name}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGroup(customInput)}
              placeholder="サブドメインを入力..."
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700"
              autoFocus
            />
            <button
              onClick={() => addGroup(addSlug || customInput)}
              disabled={!addSlug && !customInput.trim()}
              className="w-full bg-gray-800 text-white text-xs py-1.5 rounded disabled:opacity-40 hover:bg-gray-700"
            >
              追加
            </button>
          </div>
        )}

        {/* グループ一覧 */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {selectedGroups.map((slug) => {
            const group = GROUPS.find((g) => g.slug === slug);
            const name = group?.name ?? slug;
            const isActive = slug === currentGroup;
            return (
              <div
                key={slug}
                className={`flex items-center gap-1 rounded-lg px-2 py-2 group/item ${
                  isActive ? "bg-gray-800 text-white" : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <button
                  onClick={() => navigate(slug)}
                  className="flex-1 text-left text-xs font-medium truncate"
                >
                  {name}
                </button>
                <button
                  onClick={() => remove(slug)}
                  className={`text-sm shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity ${
                    isActive ? "text-gray-400 hover:text-white" : "text-gray-300 hover:text-gray-600"
                  }`}
                  title="削除"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div className="p-3 border-t border-gray-100">
          <Link href="/howto" className="text-xs text-gray-400 hover:text-gray-600">
            使い方
          </Link>
        </div>
      </div>
    </>
  );
}
