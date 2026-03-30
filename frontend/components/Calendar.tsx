"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { ScheduleEvent } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  大特典会: "bg-amber-400 text-white",
  特典会: "bg-yellow-400 text-white",
  一番くじ: "bg-orange-500 text-white",
  オンラインサイン会: "bg-teal-400 text-white",
  単独ライブ: "bg-pink-600 text-white",
  合同ライブ: "bg-pink-400 text-white",
  フェス出演: "bg-lime-500 text-white",
  ライブ: "bg-pink-500 text-white",
  リリースイベント: "bg-purple-400 text-white",
  テレビ出演: "bg-blue-500 text-white",
  ラジオ出演: "bg-violet-400 text-white",
  雑誌掲載: "bg-cyan-500 text-white",
  その他メディア: "bg-blue-300 text-white",
  配信イベント: "bg-green-400 text-white",
  "物販・グッズ": "bg-orange-400 text-white",
  "販売・発売": "bg-amber-600 text-white",
  その他イベント: "bg-gray-400 text-white",
  申込締切: "bg-red-500 text-white",
};

// 絞り込みカテゴリ（大特典会は特典会に統合、一番くじを追加）
const FILTER_CATEGORIES = [
  "単独ライブ", "ライブ", "合同ライブ", "フェス出演",
  "特典会", "一番くじ", "オンラインサイン会", "リリースイベント",
  "テレビ出演", "ラジオ出演", "雑誌掲載", "その他メディア",
  "配信イベント", "物販・グッズ", "その他イベント", "申込締切",
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatEventDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatPostedAt(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isNew(ev: ScheduleEvent): boolean {
  if (!ev.created_at) return false;
  if (ev.source === "web") return false; // Webスクレイピングは新着扱いしない
  return Date.now() - new Date(ev.created_at).getTime() < 24 * 60 * 60 * 1000;
}

/** 直前の JST 22:00（UTC 13:00）を返す */
function getLastUpdateTime(): Date {
  const now = new Date();
  const today13utc = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 0, 0, 0
  ));
  if (now >= today13utc) return today13utc;
  today13utc.setUTCDate(today13utc.getUTCDate() - 1);
  return today13utc;
}

/** 直前の22:00更新タイミング以降に追加されたか */
function isNewSinceLastUpdate(ev: ScheduleEvent): boolean {
  if (!ev.created_at) return false;
  if (ev.source === "web") return false; // Webスクレイピングは新着扱いしない
  return new Date(ev.created_at) >= getLastUpdateTime();
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** 申込締切レコードから親イベントを特定 */
function getParentEvent(ev: ScheduleEvent, allEvents: ScheduleEvent[]): ScheduleEvent | null {
  if (ev.category !== "申込締切") return null;
  const parentId = ev.post_id.replace(/_deadline.*$/, "");
  return allEvents.find((e) => e.post_id === parentId) ?? null;
}

/** イベントに紐づく申込締切レコードを全件取得 */
function getRelatedDeadlines(ev: ScheduleEvent, allEvents: ScheduleEvent[]): ScheduleEvent[] {
  if (ev.category === "申込締切") return [];
  return allEvents.filter(
    (e) => e.category === "申込締切" && e.post_id.startsWith(ev.post_id + "_deadline")
  );
}

export default function Calendar({ events }: { events: ScheduleEvent[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);
  const [undatedOpen, setUndatedOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(288);
  const [isDesktop, setIsDesktop] = useState(false);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      setPanelWidth(Math.max(200, Math.min(600, dragStartWidth.current + delta)));
    }
    function handleMouseUp() { isDragging.current = false; }
    function handleTouchMove(e: TouchEvent) {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.touches[0].clientX;
      setPanelWidth(Math.max(200, Math.min(600, dragStartWidth.current + delta)));
    }
    function handleTouchEnd() { isDragging.current = false; }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const isFiltered = selectedCategories.size > 0;

  // 22:00以降の新規のみフィルター
  const newFilteredEvents = showOnlyNew ? events.filter(isNewSinceLastUpdate) : events;

  // カテゴリ絞り込み（特典会は大特典会も包含）
  const displayEvents = isFiltered
    ? newFilteredEvents.filter((e) => {
        const cat = e.category ?? "";
        if (selectedCategories.has("特典会") && (cat === "特典会" || cat === "大特典会")) return true;
        if (selectedCategories.has(cat)) return true;
        if (selectedCategories.has("申込締切") && cat !== "申込締切") {
          return events.some(
            (d) => d.category === "申込締切" && d.post_id.startsWith(e.post_id + "_deadline")
          );
        }
        return false;
      })
    : newFilteredEvents;

  // 申込締切が7日以内に迫っているイベント
  const upcomingDeadlines = events
    .filter((ev) => ev.category === "申込締切" && ev.event_date)
    .map((ev) => ({ ev, days: daysUntil(ev.event_date!) }))
    .filter(({ days }) => days >= 0 && days <= 7)
    .sort((a, b) => a.days - b.days);

  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);

  const eventsByDate: Record<string, ScheduleEvent[]> = {};
  for (const ev of displayEvents) {
    if (!ev.event_date) continue;
    const d = new Date(ev.event_date + "T00:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString();
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(ev);
    }
  }

  const undatedEvents = displayEvents.filter((e) => !e.event_date);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelected(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelected(null);
  }

  // 詳細パネル用
  const relatedDeadlines = selected ? getRelatedDeadlines(selected, events) : [];
  const parentEvent = selected ? getParentEvent(selected, events) : null;

  // 直前22:00の表示用ラベル
  const lastUpdateLabel = (() => {
    const t = getLastUpdateTime();
    return t.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  return (
    <div className="flex flex-col lg:flex-row gap-0">
      {/* カレンダー本体 */}
      <div className="flex-1">

        {/* 申込締切バナー */}
        {upcomingDeadlines.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-bold text-red-600 mb-2">⏰ 申込締切が迫っています</p>
            <div className="flex flex-col gap-1.5">
              {upcomingDeadlines.map(({ ev, days }) => (
                <button
                  key={ev.post_id}
                  onClick={() => setSelected(ev)}
                  className={`flex items-center gap-2 text-left px-3 py-1.5 rounded-lg bg-white border ${selected?.post_id === ev.post_id ? "border-red-400" : "border-red-100"} hover:border-red-300 transition-colors`}
                >
                  <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${days === 0 ? "bg-red-500 text-white" : days <= 2 ? "bg-orange-400 text-white" : "bg-yellow-400 text-gray-800"}`}>
                    {days === 0 ? "本日" : `あと${days}日`}
                  </span>
                  <span className="text-xs text-gray-700 truncate">{ev.post_text.slice(0, 50)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 22:00以降の新規のみ表示チェックボックス */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showOnlyNew}
            onChange={(e) => setShowOnlyNew(e.target.checked)}
            className="w-4 h-4 accent-blue-500 rounded"
          />
          <span className="text-xs text-gray-600 font-medium">
            前回22:00（{lastUpdateLabel}）以降の新着のみ表示
          </span>
          {showOnlyNew && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              {newFilteredEvents.length}件
            </span>
          )}
        </label>

        {/* 絞り込みUI */}
        <div className="flex items-center gap-2 mb-3 flex-wrap" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isFiltered
                  ? "bg-gray-700 text-white border-gray-700"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span>絞り込み</span>
              {isFiltered && (
                <span className="bg-white text-gray-800 rounded-full px-1.5 leading-tight">
                  {selectedCategories.size}
                </span>
              )}
              <span className="text-gray-400">{dropdownOpen ? "▲" : "▼"}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-9 z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
                {FILTER_CATEGORIES.map((cat) => {
                  const checked = selectedCategories.has(cat);
                  const colorClass = (CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["その他イベント"]).split(" ")[0];
                  const label = cat === "特典会" ? "特典会／大特典会" : cat;
                  return (
                    <label key={cat} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(cat)}
                        className="w-3.5 h-3.5 accent-gray-700"
                      />
                      <span className={`inline-block w-2 h-2 rounded-full ${colorClass}`} />
                      <span className="text-xs text-gray-700">{label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {isFiltered && (
            <button
              onClick={() => setSelectedCategories(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              クリア
            </button>
          )}

          {isFiltered && (
            <div className="flex flex-wrap gap-1">
              {[...selectedCategories].map((cat) => (
                <span
                  key={cat}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["その他イベント"]}`}
                >
                  {cat === "特典会" ? "特典会／大特典会" : cat}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-lg">◀</button>
          <h2 className="text-xl font-bold text-gray-700">{year}年{month + 1}月</h2>
          <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-lg">▶</button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsByDate[day.toString()] ?? [];
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            return (
              <div key={day} className={`min-h-16 rounded-lg p-1 border ${isToday ? "border-blue-400 bg-blue-50" : "border-gray-100 bg-white"}`}>
                <div className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600 font-bold" : "text-gray-600"}`}>{day}</div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.map((ev) => (
                    <button
                      key={ev.post_id}
                      onClick={() => setSelected(ev)}
                      className={`text-left text-xs px-1 py-0.5 rounded truncate w-full ${CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS["その他イベント"]} ${selected?.post_id === ev.post_id ? "ring-2 ring-offset-1 ring-gray-400" : ""} ${isNew(ev) ? "ring-2 ring-yellow-300 ring-offset-1" : ""}`}
                    >
                      {isNew(ev) && <span className="mr-0.5">★</span>}{ev.category}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {undatedEvents.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setUndatedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 w-full text-left"
            >
              <span className={`transition-transform duration-200 ${undatedOpen ? "rotate-90" : ""}`}>▶</span>
              日程未確定
              <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                {undatedEvents.length}
              </span>
            </button>
            {undatedOpen && (
              <div className="flex flex-col gap-2 mt-2">
                {undatedEvents.map((ev) => (
                  <button
                    key={ev.post_id}
                    onClick={() => setSelected(ev)}
                    className={`text-left px-3 py-2 rounded-lg text-sm ${CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS["その他イベント"]} ${selected?.post_id === ev.post_id ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  >
                    {isNew(ev) && <span className="mr-1 text-yellow-200 font-bold">★NEW</span>}
                    {ev.category} — {ev.post_text.slice(0, 40)}…
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* リサイズハンドル（デスクトップのみ） */}
      <div
        className="hidden lg:flex w-3 cursor-col-resize items-center justify-center hover:bg-gray-100 group shrink-0"
        onMouseDown={(e) => {
          isDragging.current = true;
          dragStartX.current = e.clientX;
          dragStartWidth.current = panelWidth;
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          isDragging.current = true;
          dragStartX.current = e.touches[0].clientX;
          dragStartWidth.current = panelWidth;
        }}
      >
        <div className="w-0.5 h-8 bg-gray-300 rounded group-hover:bg-gray-400 transition-colors" />
      </div>

      {/* 詳細パネル */}
      <div className="w-full shrink-0" style={isDesktop ? { width: panelWidth } : undefined}>
        {selected ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sticky top-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS["その他イベント"]}`}>
                {selected.category}
              </span>
              {isNew(selected) && (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-400 text-gray-800">★ NEW</span>
              )}
            </div>
            {selected.event_date && (
              <p className="text-lg font-bold text-gray-800 mt-2">
                {formatEventDate(selected.event_date)}
              </p>
            )}
            {selected.posted_at && (
              <p className="text-xs text-gray-400 mt-1">
                投稿日時: {formatPostedAt(selected.posted_at)}
              </p>
            )}

            {/* 申込締切レコードの場合: 対応する親イベントを表示 */}
            {selected.category === "申込締切" && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">対応イベント</p>
                {parentEvent ? (
                  <button
                    onClick={() => setSelected(parentEvent)}
                    className={`text-left w-full text-xs px-2 py-1.5 rounded font-medium ${CATEGORY_COLORS[parentEvent.category] ?? CATEGORY_COLORS["その他イベント"]}`}
                  >
                    {parentEvent.category}
                    {parentEvent.event_date && ` — ${formatEventDate(parentEvent.event_date)}`}
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">（対応イベントが見つかりません）</p>
                )}
              </div>
            )}

            {/* 申込締切以外のイベントで締切レコードがある場合: 申込締切日を表示 */}
            {relatedDeadlines.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs font-semibold text-red-700 mb-1.5">申込締切</p>
                <div className="flex flex-col gap-1">
                  {relatedDeadlines.map((dl) => (
                    <button
                      key={dl.post_id}
                      onClick={() => setSelected(dl)}
                      className="text-left text-xs px-2 py-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      {dl.event_date ? formatEventDate(dl.event_date) : "日程未定"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected.image_url && (
              <div className="mt-3 relative w-full aspect-video rounded-lg overflow-hidden">
                <Image
                  src={selected.image_url}
                  alt="イベント画像"
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">
                {selected.post_text}
              </p>
            </div>
            {selected.post_url && (
              <a href={selected.post_url} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-3 text-xs text-blue-500 hover:text-blue-700 underline">
                {selected.source === "x" ? "𝕏 元の投稿を見る →" : "🌐 公式ページを見る →"}
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400 sticky top-4">
            イベントをクリックすると詳細が表示されます
          </div>
        )}
      </div>
    </div>
  );
}
