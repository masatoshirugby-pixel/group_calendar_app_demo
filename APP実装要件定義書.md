# グループカレンダー デモアプリ 実装要件定義書

最終更新: 2026-03-25

---

## 1. 概要

アソビシステム系アイドルグループのスケジュールをカレンダー形式で表示するデモアプリ。
プルダウンまたはサブドメイン直接入力でグループを選び、当月・翌月のイベントをカレンダーに表示する。

---

## 2. 対応グループ

| グループ名 | slug（サブドメイン） | データ取得方式 |
|---|---|---|
| CUTIE STREET | cutiestreet | PostgreSQL（cutieStreet_app 共有） |
| CANDY TUNE | candytune | PostgreSQL（cutieStreet_app 共有） |
| SWEET STEADY | sweetsteady | PostgreSQL（cutieStreet_app 共有） |
| わーすた | wasuta | Webスクレイピング |
| ukka | ukka | Webスクレイピング |
| BROMAnce | bromance | Webスクレイピング |
| OCHA NORMA | ocha-norma | Webスクレイピング |
| FRUITS ZIPPER | fruits-zipper | Webスクレイピング |
| ぽいずん | poipoipoizon | Webスクレイピング |

プルダウン対象外グループは、サブドメインを直接入力することでカレンダーを表示可能。

---

## 3. データ取得

### 3.1 DB 取得（cutiestreet / candytune / sweetsteady）

- cutieStreet_app が管理する PostgreSQL を **読み取り専用** でクエリ
- クエリ条件: `is_event = TRUE AND account = %s AND (event_date >= 当月1日 OR event_date IS NULL)`
- 取得上限: 200件
- データソース（Web / X / ニュース / メール）はすべて含む

**account 対応表**

| slug | DB の account 名 |
|---|---|
| cutiestreet | CUTIE_STREET_ |
| candytune | CANDY_TUNE_ |
| sweetsteady | SWEET_STEADY |

### 3.2 Webスクレイピング（その他グループ）

- URL: `https://{slug}.asobisystem.com/live_information/schedule/list/`
- **今月 + 翌月** の 2ヶ月分を取得（`?viewMode=default&year=YYYY&month=MM` パラメータ）
- `<a href="/live_information/detail/...">` および `<a href="/news/detail/...">` を対象に解析
- 起動時にサイト疎通確認を行い、失敗した場合は 400 エラーを返す
- イベントタイプ（LIVE / EVENT / TV / RADIO / VIDEO）をカテゴリに直接マッピング

**カテゴリマッピング**

| スケジュール TYPE | 付加キーワード | カテゴリ |
|---|---|---|
| LIVE | ワンマン / 単独公演 / 単独ライブ | 単独ライブ |
| LIVE | フェス / フェスティバル / festival | フェス出演 |
| LIVE | 対バン / 合同ライブ / 合同公演 | 合同ライブ |
| LIVE | （上記以外） | ライブ |
| TV | — | テレビ出演 |
| RADIO | — | ラジオ出演 |
| VIDEO | — | **スキップ** |
| EVENT | 大特典会 | 大特典会 |
| EVENT | オンラインサイン会 / オンラインサイン | オンラインサイン会 |
| EVENT | リリースイベント / リリイベ / 発売記念 / インストア | リリースイベント |
| EVENT | 特典会 / チェキ / お渡し / ハイタッチ / サイン会 | 特典会 |
| EVENT | フェス / フェスティバル / festival | フェス出演 |
| EVENT | （上記以外） | その他イベント |

---

## 4. APIエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | /health | ヘルスチェック |
| GET | /groups | 対応グループ一覧を返す |
| GET | /schedule?group={slug} | 指定グループのイベント一覧を返す |

### /schedule レスポンス形式

```json
{
  "group": "cutiestreet",
  "events": [
    {
      "post_id": "...",
      "post_text": "...",
      "post_url": "...",
      "category": "単独ライブ",
      "event_date": "2026-04-05"
    }
  ]
}
```

- `event_date` は ISO 形式（YYYY-MM-DD）、日程未確定の場合は `null`

---

## 5. システム構成

### 5.1 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 14.2.31 App Router |
| フロントホスティング | Vercel |
| バックエンド | Python + FastAPI 0.115.0 |
| バックホスティング | Railway |
| DB（参照のみ） | PostgreSQL（cutieStreet_app 共用） |

### 5.2 依存パッケージ（バックエンド）

| パッケージ | 用途 |
|---|---|
| fastapi | APIフレームワーク |
| uvicorn | ASGIサーバー |
| requests | HTTPクライアント（スクレイピング） |
| beautifulsoup4 | HTMLパース |
| psycopg2-binary | PostgreSQL 接続 |
| python-dotenv | 環境変数読み込み |

---

## 6. フロントエンド機能

### 6.1 トップページ（グループ選択）

- プルダウン: 対応グループ一覧から選択 → 「見る」ボタンでカレンダーへ遷移
- 直接入力: サブドメインをテキスト入力 → Enter キーまたはボタンでカレンダーへ遷移

### 6.2 カレンダーページ

- 月ナビゲーション（◀ 前月 / 翌月 ▶）
- 月曜始まり、土曜=青・日曜=赤
- 今日の日付をブルーでハイライト
- イベントをカテゴリ別カラーで表示（クリックで詳細パネルを表示）
- 日程未確定イベント件数をカレンダー下部に表示

### 6.3 イベント詳細パネル（右パネル）

- カテゴリバッジ / 開催日 / 本文 / 公式ページリンク を表示
- イベント未選択時はプレースホルダーを表示

### 6.4 カテゴリカラー定義

| カテゴリ | カラー（Tailwind） |
|---|---|
| 大特典会 | bg-amber-400 |
| 特典会 | bg-yellow-400 |
| オンラインサイン会 | bg-teal-400 |
| 単独ライブ | bg-pink-600 |
| 合同ライブ | bg-pink-400 |
| フェス出演 | bg-lime-500 |
| ライブ | bg-pink-500 |
| リリースイベント | bg-purple-400 |
| テレビ出演 | bg-blue-500 |
| ラジオ出演 | bg-violet-400 |
| 雑誌掲載 | bg-cyan-500 |
| その他メディア | bg-blue-300 |
| 配信イベント | bg-green-400 |
| 物販・グッズ | bg-orange-400 |
| その他イベント | bg-gray-400 |

---

## 7. 環境変数

| 変数名 | 設定箇所 | 説明 |
|---|---|---|
| `DATABASE_URL` | Railway | cutieStreet_app の PostgreSQL 接続文字列 |
| `NEXT_PUBLIC_API_URL` | Vercel | Railway バックエンドの URL |

---

## 8. 今後の課題・予定

| 優先度 | 内容 |
|---|---|
| 高 | カテゴリフィルター機能（表示するカテゴリを絞り込み） |
| 高 | 詳細パネルへの会場・画像・申込締切の表示（DB データ活用） |
| 中 | 対応グループの拡充 |
| 低 | SaaS 化（グループごとに独立したアプリとして提供） |
