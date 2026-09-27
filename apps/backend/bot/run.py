# apps/backend/bot/run.py
"""
Run the Telegram bot (long polling — no public URL or tunnel needed):

    1. In Telegram, talk to @BotFather → /newbot → copy the token
    2. Add it to apps/backend/.env:   TELEGRAM_BOT_TOKEN=123456:ABC...
    3. Start the backend (port 8000), then from apps/backend:   python -m bot.run

Options (env / .env): MHK_API_BASE (default http://127.0.0.1:8000), TELEGRAM_BOT_DB (default data/telegram_bot.db).
"""

from __future__ import annotations

import os
import sys
import time

import httpx

import settings
from bot.brain import Bot
from bot.store import Store
from bot.telegram_api import Telegram, TelegramError

ALERT_EVERY_S = 60


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    token = settings._get("TELEGRAM_BOT_TOKEN")
    if not token:
        sys.exit("TELEGRAM_BOT_TOKEN is not set — create a bot with @BotFather and add the token to apps/backend/.env")
    api_base = settings._get("MHK_API_BASE", "http://127.0.0.1:8000")
    db_path = settings._get("TELEGRAM_BOT_DB") or os.path.join(settings.DATA_DIR, "telegram_bot.db")

    tg = Telegram(token)
    try:
        me = tg.get_me()
    except (TelegramError, httpx.HTTPError) as e:
        sys.exit(f"Telegram rejected the token or is unreachable: {e}")
    bot = Bot(tg, httpx.Client(base_url=api_base, timeout=30), Store(db_path))
    print(f"[bot] @{me['username']} running · API {api_base} · state {db_path}")

    offset = None
    last_alerts = 0.0
    while True:
        try:
            for update in tg.get_updates(offset, timeout=25):
                offset = update["update_id"] + 1
                try:
                    bot.handle(update)
                except Exception as e:  # noqa: BLE001 — one bad update must not stop the bot
                    print(f"[bot] update {update.get('update_id')} failed: {e}")
            if time.time() - last_alerts >= ALERT_EVERY_S:
                last_alerts = time.time()
                n = bot.poll_alerts()
                if n:
                    print(f"[bot] sent {n} alert(s)")
        except (httpx.HTTPError, TelegramError) as e:
            print(f"[bot] connection problem, retrying in 5 s: {e}")
            time.sleep(5)
        except KeyboardInterrupt:
            print("[bot] stopped")
            return


if __name__ == "__main__":
    main()
