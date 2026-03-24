"use client";

import { useState } from "react";
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
};

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function formatEventDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default function Calendar({ events }: { events: ScheduleEvent[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);

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
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-lg">◀</button>
          <h2 className="text-xl font-bold text-gray-700">{year}年{month + 1}月</h2>
          <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-lg">▶</button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-gray-500"}`}>
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
                      className={`text-left text-xs px-1 py-0.5 rounded truncate w-full ${CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS["その他イベント"]} ${selected?.post_id === ev.post_id ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                    >
                      {ev.category}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {undatedEvents.length > 0 && (
          <div className="mt-4 text-xs text-gray-400">
            日程未確定: {undatedEvents.length}件
          </div>
        )}
      </div>

      {/* 詳細パネル */}
      <div className="w-full lg:w-72 shrink-0">
        {selected ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sticky top-4">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS["その他イベント"]}`}>
              {selected.category}
            </span>
            {selected.event_date && (
              <p className="text-lg font-bold text-gray-800 mt-2">
                {formatEventDate(selected.event_date)}
              </p>
            )}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">
                {selected.post_text}
              </p>
            </div>
            {selected.post_url && (
              <a href={selected.post_url} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-3 text-xs text-blue-500 hover:text-blue-700 underline">
                🌐 公式ページを見る →
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
