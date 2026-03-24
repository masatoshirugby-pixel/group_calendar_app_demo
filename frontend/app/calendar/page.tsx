import { fetchSchedule } from "@/lib/api";
import Calendar from "@/components/Calendar";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ group?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const { group } = await searchParams;

  if (!group) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">グループが指定されていません。</p>
        <Link href="/" className="mt-4 inline-block text-blue-500 underline">
          ← トップに戻る
        </Link>
      </main>
    );
  }

  let events = [];
  let error = "";
  try {
    events = await fetchSchedule(group);
  } catch (e: any) {
    error = e.message ?? "取得失敗";
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← 戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 capitalize">{group}</h1>
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
  );
}
