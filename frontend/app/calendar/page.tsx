import { fetchSchedule, type ScheduleEvent, GROUPS } from "@/lib/api";
import Calendar from "@/components/Calendar";
import GroupPanel from "@/components/GroupPanel";

interface Props {
  searchParams: Promise<{ group?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const { group } = await searchParams;

  if (!group) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500 text-sm">
        グループが指定されていません。
      </div>
    );
  }

  let events: ScheduleEvent[] = [];
  let error = "";
  try {
    events = await fetchSchedule(group);
  } catch (e: any) {
    error = e.message ?? "取得失敗";
  }

  const groupName = GROUPS.find((g) => g.slug === group)?.name ?? group;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* メインエリア */}
      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{groupName}</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {events.length} 件
          </span>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
            {error}
          </div>
        ) : (
          <Calendar events={events} />
        )}
      </main>

      {/* 右サイドバー */}
      <GroupPanel currentGroup={group} />
    </div>
  );
}
