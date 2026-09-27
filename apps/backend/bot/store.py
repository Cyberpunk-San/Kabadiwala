# apps/backend/bot/store.py
"""Per-chat memory: who the chat is linked to, their language, last location and the current step."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Iterator, Optional


@dataclass
class Chat:
    chat_id: int
    phone: Optional[str] = None
    role: Optional[str] = None          # kabadiwala | household | company
    account_id: Optional[str] = None
    name: Optional[str] = None
    language: str = "hi"
    lat: Optional[float] = None
    lon: Optional[float] = None
    located_at: float = 0.0             # when the last location was shared (epoch s)
    step: str = ""
    draft: Dict[str, Any] = field(default_factory=dict)

    @property
    def linked(self) -> bool:
        return bool(self.account_id)


class Store:
    def __init__(self, path: str):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.Lock()
        with self.lock:
            self.db.execute("CREATE TABLE IF NOT EXISTS chats (chat_id INTEGER PRIMARY KEY, data TEXT NOT NULL)")
            self.db.execute("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)")
            self.db.commit()

    def get(self, chat_id: int) -> Chat:
        with self.lock:
            row = self.db.execute("SELECT data FROM chats WHERE chat_id = ?", (chat_id,)).fetchone()
        return Chat(**json.loads(row[0])) if row else Chat(chat_id=chat_id)

    def save(self, chat: Chat) -> None:
        with self.lock:
            self.db.execute("INSERT OR REPLACE INTO chats (chat_id, data) VALUES (?, ?)", (chat.chat_id, json.dumps(asdict(chat))))
            self.db.commit()

    def all(self) -> Iterator[Chat]:
        with self.lock:
            rows = self.db.execute("SELECT data FROM chats").fetchall()
        for (data,) in rows:
            yield Chat(**json.loads(data))

    def kv_get(self, key: str, default: Any = None) -> Any:
        with self.lock:
            row = self.db.execute("SELECT v FROM kv WHERE k = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def kv_set(self, key: str, value: Any) -> None:
        with self.lock:
            self.db.execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (key, json.dumps(value)))
            self.db.commit()


def fresh_location(chat: Chat, max_age_s: int = 1800) -> bool:
    return chat.lat is not None and time.time() - chat.located_at <= max_age_s
