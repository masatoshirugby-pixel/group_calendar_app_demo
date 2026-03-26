import Image from "next/image";
import { fetchSchedule, type ScheduleEvent, GROUPS } from "@/lib/api";
import Calendar from "@/components/Calendar";
import GroupPanel from "@/components/GroupPanel";

const GROUP_HEADERS: Record<string, string> = {
  cutiestreet: "https://d1rjcmiyngzjnh.cloudfront.net/prod/public/fcopen/contents/top_image/1351/04577a8885337b8a2e8f67cc65286da1.jpeg",
  sweetsteady: "https://d1rjcmiyngzjnh.cloudfront.net/prod/public/fcopen/contents/top_image/1217/82eb2c3a913dd9c6b552ea68418be46c.jpeg",
  candytune:   "https://d1rjcmiyngzjnh.cloudfront.net/prod/public/fcopen/contents/top_image/666/9a02cefd0e75e34e6a0f4a101c7111a3.jpeg",
};

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
      {/* 左サイドバー */}
      <GroupPanel currentGroup={group} />

      {/* メインエリア */}
      <main className="flex-1 overflow-y-auto px-4 py-8">
        {GROUP_HEADERS[group] && (
          <div className="relative w-full h-32 rounded-xl overflow-hidden mb-4">
            <Image
              src={GROUP_HEADERS[group]}
              alt={groupName}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}
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
          <Calendar key={group} events={events} />
        )}
      </main>
    </div>
  );
}
