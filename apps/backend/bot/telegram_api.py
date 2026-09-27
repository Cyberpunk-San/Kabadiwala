# apps/backend/bot/telegram_api.py
"""Minimal Telegram Bot API client (https://core.telegram.org/bots/api) on httpx — no extra dependency."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx


class TelegramError(RuntimeError):
    pass


class Telegram:
    def __init__(self, token: str, client: Optional[httpx.Client] = None, base: str = "https://api.telegram.org"):
        self.token = token
        self.base = base.rstrip("/")
        # Long polling holds the request open for up to `timeout` seconds, so allow a bit more.
        self.http = client or httpx.Client(timeout=httpx.Timeout(40.0, connect=10.0))

    def call(self, method: str, **params: Any) -> Any:
        payload = {k: v for k, v in params.items() if v is not None}
        res = self.http.post(f"{self.base}/bot{self.token}/{method}", json=payload)
        data = res.json()
        if not data.get("ok"):
            raise TelegramError(f"{method}: {data.get('description', res.status_code)}")
        return data["result"]

    # ── receiving ────────────────────────────────────────────────────────────
    def get_updates(self, offset: Optional[int], timeout: int = 30) -> List[Dict[str, Any]]:
        return self.call("getUpdates", offset=offset, timeout=timeout,
                         allowed_updates=["message", "callback_query"])

    def download_file(self, file_id: str) -> bytes:
        path = self.call("getFile", file_id=file_id)["file_path"]
        res = self.http.get(f"{self.base}/file/bot{self.token}/{path}")
        res.raise_for_status()
        return res.content

    # ── sending ──────────────────────────────────────────────────────────────
    def send(self, chat_id: int, text: str, keyboard: Optional[Dict[str, Any]] = None) -> Any:
        return self.call("sendMessage", chat_id=chat_id, text=text, reply_markup=keyboard,
                         parse_mode="HTML", disable_web_page_preview=True)

    def answer_callback(self, callback_id: str, text: Optional[str] = None) -> Any:
        return self.call("answerCallbackQuery", callback_query_id=callback_id, text=text)

    def get_me(self) -> Dict[str, Any]:
        return self.call("getMe")


# ── keyboards ───────────────────────────────────────────────────────────────

def reply_keyboard(rows: List[List[Any]], one_time: bool = False) -> Dict[str, Any]:
    """Buttons under the text box. A row item is a label or a dict (e.g. {'text':..., 'request_location': True})."""
    return {"keyboard": [[b if isinstance(b, dict) else {"text": b} for b in row] for row in rows],
            "resize_keyboard": True, "one_time_keyboard": one_time}


def inline_keyboard(rows: List[List[tuple]]) -> Dict[str, Any]:
    """Buttons attached to a message: rows of (label, callback_data)."""
    return {"inline_keyboard": [[{"text": label, "callback_data": data} for label, data in row] for row in rows]}
