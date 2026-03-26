"use client";

import { useState } from "react";
import Image from "next/image";
import type { ScheduleEvent } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  大特典会: "bg-amber-400 text-white",
  特典会: "bg-yellow-400 text-white",
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
  その他イベント: "bg-gray-400 text-white",
  申込締切: "bg-red-500 text-white",
};

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

function isNew(createdAt: string | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Calendar({ events }: { events: ScheduleEvent[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);
  const [undatedOpen, setUndatedOpen] = useState(false);

  // 申込締切が7日以内に迫っているイベント
  const upcomingDeadlines = events
    .filter((ev) => ev.category === "申込締切" && ev.event_date)
    .map((ev) => ({ ev, days: daysUntil(ev.event_date!) }))
    .filter(({ days }) => days >= 0 && days <= 7)
    .sort((a, b) => a.days - b.days);

  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);

  const eventsByDate: Record<string, ScheduleEvent[]> = {};
  for (const ev of events) {
    if (!ev.event_date) continue;
    const d = new Date(ev.event_date + "T00:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString();
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(ev);
    }
  }

  const undatedEvents = events.filter((e) => !e.event_date);

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

  return (
    <div className="flex flex-col lg:flex-row gap-4">
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
                      className={`text-left text-xs px-1 py-0.5 rounded truncate w-full ${CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS["その他イベント"]} ${selected?.post_id === ev.post_id ? "ring-2 ring-offset-1 ring-gray-400" : ""} ${isNew(ev.created_at) ? "ring-2 ring-yellow-300 ring-offset-1" : ""}`}
                    >
                      {isNew(ev.created_at) && <span className="mr-0.5">★</span>}{ev.category}
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
                    {isNew(ev.created_at) && <span className="mr-1 text-yellow-200 font-bold">★NEW</span>}
                    {ev.category} — {ev.post_text.slice(0, 40)}…
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 詳細パネル */}
      <div className="w-full lg:w-72 shrink-0">
        {selected ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sticky top-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS["その他イベント"]}`}>
                {selected.category}
              </span>
              {isNew(selected.created_at) && (
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
