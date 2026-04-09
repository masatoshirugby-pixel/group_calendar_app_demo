"""
対応グループの設定を一元管理する。
- account: DBに保存するグループ識別子（cutieStreet_appとの互換性のため3グループは既存名を維持）
- x_username: X APIで取得するアカウント名（None の場合はX取得スキップ）
"""

GROUPS: list[dict] = [
    {
        "slug":       "cutiestreet",
        "name":       "CUTIE STREET",
        "account":    "CUTIE_STREET_",
        "x_username": "CUTIE_STREET_",
    },
    {
        "slug":       "candytune",
        "name":       "CANDY TUNE",
        "account":    "CANDY_TUNE_",
        "x_username": "CANDY_TUNE_",
    },
    {
        "slug":       "sweetsteady",
        "name":       "SWEET STEADY",
        "account":    "SWEET_STEADY",
        "x_username": "SWEET_STEADY",
    },
]

# フロントエンド向けのグループ一覧（slug + name のみ）
KNOWN_GROUPS: list[dict] = [{"slug": g["slug"], "name": g["name"]} for g in GROUPS]

# slug → グループ設定 の逆引き辞書
_SLUG_MAP: dict[str, dict] = {g["slug"]: g for g in GROUPS}


def get_group(slug: str) -> dict | None:
    return _SLUG_MAP.get(slug)
