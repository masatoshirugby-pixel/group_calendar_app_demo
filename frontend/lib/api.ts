// API_URL はサーバーサイド専用（ランタイムで読まれる）
const BASE_URL = process.env.API_URL ?? "http://localhost:8000";

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
  image_url: string | null;
  source: string | null;
  posted_at: string | null;
  created_at: string | null;
}

// グループ一覧はフロントエンドに直接定義（バックエンドとの同期不要）
export const GROUPS: Group[] = [
  { slug: "cutiestreet",   name: "CUTIE STREET" },
  { slug: "candytune",     name: "CANDY TUNE" },
  { slug: "sweetsteady",   name: "SWEET STEADY" },
  { slug: "wasuta",        name: "わーすた" },
  { slug: "ukka",          name: "ukka" },
  { slug: "bromance",      name: "BROMAnce" },
  { slug: "ocha-norma",    name: "OCHA NORMA" },
  { slug: "fruits-zipper", name: "FRUITS ZIPPER" },
  { slug: "poipoipoizon",  name: "ぽいずん" },
];

export async function fetchGroups(): Promise<Group[]> {
  return GROUPS;
}

export async function fetchSchedule(group: string): Promise<ScheduleEvent[]> {
  const res = await fetch(`${BASE_URL}/schedule?group=${encodeURIComponent(group)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`取得失敗: ${res.status}`);
  const data = await res.json();
  return data.events;
}
