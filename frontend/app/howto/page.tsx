import Link from "next/link";

const CATEGORIES = [
  { color: "bg-pink-600", label: "単独ライブ" },
  { color: "bg-pink-500", label: "ライブ" },
  { color: "bg-pink-400", label: "合同ライブ" },
  { color: "bg-lime-500", label: "フェス出演" },
  { color: "bg-amber-400", label: "大特典会" },
  { color: "bg-yellow-400", label: "特典会" },
  { color: "bg-teal-400", label: "オンラインサイン会" },
  { color: "bg-purple-400", label: "リリースイベント" },
  { color: "bg-blue-500", label: "テレビ出演" },
  { color: "bg-violet-400", label: "ラジオ出演" },
  { color: "bg-cyan-500", label: "雑誌掲載" },
  { color: "bg-blue-300", label: "その他メディア" },
  { color: "bg-green-400", label: "配信イベント" },
  { color: "bg-orange-400", label: "物販・グッズ" },
  { color: "bg-gray-400", label: "その他イベント" },
  { color: "bg-red-500", label: "申込締切" },
];

export default function HowToPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-6 inline-block">
          ← トップへ戻る
        </Link>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">使い方</h1>
        <p className="text-sm text-gray-500 mb-10">
          グループカレンダーの基本的な使い方をまとめています。
        </p>

        {/* このアプリについて */}
        <section className="mb-10">
          <h2 className="text-base font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            このアプリについて
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            アソビシステム所属グループのライブ・イベント・メディア出演などのスケジュールをカレンダー形式でまとめて確認できるアプリです。
            公式サイトの情報および X（旧 Twitter）の公式アカウント投稿を自動で収集し、カテゴリ分類して表示します。
          </p>
        </section>

        {/* 対応グループ */}
        <section className="mb-10">
          <h2 className="text-base font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            対応グループ
          </h2>
          <ul className="text-sm text-gray-600 grid grid-cols-2 gap-1">
            {["CUTIE STREET", "CANDY TUNE", "SWEET STEADY", "わーすた", "ukka", "BROMAnce", "OCHA NORMA", "FRUITS ZIPPER", "ぽいずん"].map((g) => (
              <li key={g} className="flex items-center gap-1">
                <span className="text-gray-400">•</span> {g}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-3">
            一覧にないグループは、サイドバーの「＋グループを追加」からサブドメインを直接入力することで公式サイトの情報を参照できます（例: ukka）。
          </p>
        </section>

        {/* 基本操作 */}
        <section className="mb-10">
          <h2 className="text-base font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            基本操作
          </h2>
          <ul className="text-sm text-gray-600 space-y-3">
            <li>
              <span className="font-semibold text-gray-700">グループ切り替え：</span>
              画面左のサイドバーからグループ名をクリックして切り替えます。「×」で一覧から削除できます。
            </li>
            <li>
              <span className="font-semibold text-gray-700">グループ追加：</span>
              サイドバー上部の「＋グループを追加」をクリックし、一覧から選択またはサブドメインを入力して追加します。
            </li>
            <li>
              <span className="font-semibold text-gray-700">イベント詳細：</span>
              カレンダー上のイベントボタンをクリックすると、右側に詳細（投稿テキスト・日時・画像・元の投稿リンク）が表示されます。
            </li>
            <li>
              <span className="font-semibold text-gray-700">月の移動：</span>
              ◀ / ▶ ボタンで前後の月に移動できます。
            </li>
            <li>
              <span className="font-semibold text-gray-700">日程未確定：</span>
              カレンダー下部の「日程未確定」をクリックすると、日程が特定できなかったイベント一覧が展開されます。
            </li>
          </ul>
        </section>

        {/* 見どころ */}
        <section className="mb-10">
          <h2 className="text-base font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            注目機能
          </h2>
          <ul className="text-sm text-gray-600 space-y-3">
            <li>
              <span className="font-semibold text-gray-700">★ NEW バッジ：</span>
              過去24時間以内に追加されたイベントには黄色の「★」マークが付きます。最新情報をすぐに見つけられます。
            </li>
            <li>
              <span className="font-semibold text-gray-700">⏰ 申込締切バナー：</span>
              締切まで7日以内の申込締切が、カレンダー上部に「あとN日」と表示されます。締切を見逃しません。
            </li>
          </ul>
        </section>

        {/* カテゴリ一覧 */}
        <section className="mb-10">
          <h2 className="text-base font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            カテゴリ・色の見方
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`${color} text-white text-xs px-2 py-0.5 rounded font-medium`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* データ更新 */}
        <section className="mb-10">
          <h2 className="text-base font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            データの更新について
          </h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>・毎日 <span className="font-semibold">22:00 JST</span> に最新情報を自動取得します</li>
            <li>・情報源は公式サイト（asobisystem.com）の告知ページと X 公式アカウントの投稿です</li>
            <li>・キーワードマッチングでイベント性を自動判定・分類しています</li>
            <li>・情報の正確性は保証されません。詳細は必ず公式サイト・SNS をご確認ください</li>
          </ul>
        </section>

        <p className="text-xs text-gray-400">
          本アプリは非公式のファン向けツールです。各グループ・アソビシステムとは無関係です。
        </p>
      </div>
    </div>
  );
}
