import { fetchGroups } from "@/lib/api";
import GroupSelector from "@/components/GroupSelector";

export default async function Home() {
  const groups = await fetchGroups();

  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
        グループカレンダー
      </h1>
      <p className="text-center text-gray-500 text-sm mb-10">
        アイドルグループのスケジュールをカレンダーで確認できます
      </p>
      <GroupSelector groups={groups} />
    </main>
  );
}
