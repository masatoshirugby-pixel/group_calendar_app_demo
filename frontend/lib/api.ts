const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Group {
  slug: string;
  name: string;
}

export interface ScheduleEvent {
  post_id: string;
  post_text: string;
  post_url: string;
  category: string;
  event_date: string | null;
}

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${BASE_URL}/groups`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.groups;
}

export async function fetchSchedule(group: string): Promise<ScheduleEvent[]> {
  const res = await fetch(`${BASE_URL}/schedule?group=${encodeURIComponent(group)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`取得失敗: ${res.status}`);
  const data = await res.json();
  return data.events;
}
