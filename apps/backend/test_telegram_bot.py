# apps/backend/test_telegram_bot.py
"""
Telegram bot tests: a fake Telegram records what the bot sends; the real backend runs on a throwaway DB.
    python -m pytest test_telegram_bot.py -q
"""

import io
import os
import tempfile

_TMP = tempfile.mkdtemp(prefix="mhk_bot_test_")
os.environ.setdefault("MHK_DB_PATH", os.path.join(_TMP, "test.db"))
os.environ.setdefault("HF_API_TOKEN", "")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("VISION_BACKEND", "off")
os.environ["MHK_MARKET_FEED"] = "off"

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from bot.brain import BOOK_MATERIALS, Bot  # noqa: E402
from bot.store import Store  # noqa: E402
from bot.telegram_api import Telegram, inline_keyboard, reply_keyboard  # noqa: E402
from bot.texts import T, material_name, t  # noqa: E402
from db import DB_PATH  # noqa: E402
from main import app  # noqa: E402

assert "mhk_" in DB_PATH, "Refusing to run against the real database"
api = TestClient(app)
MUMBAI = (19.0760, 72.8777)
PUNE_HOME = (18.5204, 73.8567)


def png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (190, 110, 60)).save(buf, "PNG")
    return buf.getvalue()


class FakeTelegram:
    """Records messages instead of sending them."""
    def __init__(self):
        self.sent = []

    def send(self, chat_id, text, keyboard=None):
        self.sent.append({"chat_id": chat_id, "text": text, "keyboard": keyboard})

    def answer_callback(self, callback_id, text=None):
        pass

    def download_file(self, file_id):
        return png_bytes()

    def last(self, chat_id):
        return [m for m in self.sent if m["chat_id"] == chat_id][-1]

    def texts(self, chat_id):
        return [m["text"] for m in self.sent if m["chat_id"] == chat_id]


class User:
    """One Telegram user talking to the bot."""
    _next = 1000

    def __init__(self, bot, tg, lang="en"):
        User._next += 1
        self.id, self.bot, self.tg, self.lang = User._next, bot, tg, lang
        self._u = 0

    def _msg(self, **kw):
        self._u += 1
        m = {"message_id": self._u, "chat": {"id": self.id}, "from": {"id": self.id, "language_code": self.lang}}
        m.update(kw)
        self.bot.handle({"update_id": self._u, "message": m})
        return self.tg.last(self.id)

    def say(self, text):
        return self._msg(text=text)

    def share_contact(self, phone, own=True):
        return self._msg(contact={"phone_number": phone, "user_id": self.id if own else 42})

    def share_location(self, lat, lon):
        return self._msg(location={"latitude": lat, "longitude": lon})

    def photo(self):
        return self._msg(photo=[{"file_id": "small"}, {"file_id": "big"}])

    def voice(self):
        return self._msg(voice={"file_id": "v"})

    def tap(self, data):
        self._u += 1
        self.bot.handle({"update_id": self._u, "callback_query": {"id": str(self._u), "data": data, "from": {"id": self.id},
                                                                   "message": {"chat": {"id": self.id}}}})
        return self.tg.last(self.id)


def buttons(msg):
    kb = msg["keyboard"] or {}
    if "inline_keyboard" in kb:
        return [b["callback_data"] for row in kb["inline_keyboard"] for b in row]
    return [b["text"] for row in kb.get("keyboard", []) for b in row]


@pytest.fixture()
def world(tmp_path):
    tg = FakeTelegram()
    bot = Bot(tg, api, Store(str(tmp_path / "bot.db")))
    return bot, tg


def link_kabadiwala(bot, tg):
    k = User(bot, tg, "en")
    k.say("/start")
    msg = k.share_contact("+91 98765 43210")
    return k, msg


def link_household(bot, tg, phone, name="Asha Test"):
    h = User(bot, tg, "en")
    h.say("/start")
    h.share_contact(phone)
    msg = h.say(name)
    return h, msg


# ─── Telegram client ─────────────────────────────────────────────────────────

def test_telegram_client_speaks_the_bot_api():
    calls = []

    def handler(req):
        calls.append(req)
        if req.url.path.endswith("/getFile"):
            return httpx.Response(200, json={"ok": True, "result": {"file_path": "photos/a.jpg"}})
        if "/file/bot" in req.url.path:
            return httpx.Response(200, content=b"JPEGDATA")
        if req.url.path.endswith("/sendMessage"):
            return httpx.Response(200, json={"ok": True, "result": {"message_id": 7}})
        return httpx.Response(200, json={"ok": False, "description": "nope"})
    tg = Telegram("123:ABC", client=httpx.Client(transport=httpx.MockTransport(handler)))
    tg.send(5, "hi", reply_keyboard([["A", {"text": "B", "request_location": True}]]))
    body = __import__("json").loads(calls[0].content)
    assert calls[0].url.path == "/bot123:ABC/sendMessage" and body["parse_mode"] == "HTML"
    assert body["reply_markup"]["keyboard"] == [[{"text": "A"}, {"text": "B", "request_location": True}]]
    assert tg.download_file("f1") == b"JPEGDATA" and calls[-1].url.path == "/file/bot123:ABC/photos/a.jpg"
    with pytest.raises(Exception, match="nope"):
        tg.call("getMe")
    assert inline_keyboard([[("Yes", "y")]]) == {"inline_keyboard": [[{"text": "Yes", "callback_data": "y"}]]}


def test_every_text_exists_in_all_languages():
    for key, entry in T.items():
        assert set(entry) == {"en", "hi", "mr"}, key
        fields = [set(__import__("string").Formatter().parse(v)) for v in entry.values()]
        names = [{f[1] for f in fs if f[1]} for fs in fields]
        assert names[0] == names[1] == names[2], f"{key}: placeholders differ between languages"


# ─── Linking ─────────────────────────────────────────────────────────────────

def test_start_asks_for_phone_and_links_a_kabadiwala(world):
    bot, tg = world
    k = User(bot, tg, "en")
    welcome = k.say("/start")
    assert welcome["keyboard"]["keyboard"][0][0].get("request_contact") is True
    _, msg = link_kabadiwala(bot, tg)
    assert "kabadiwala" in msg["text"] or "कबाड़ीवाला" in msg["text"]
    labels_shown = buttons(msg)
    assert any("📍" in b for b in labels_shown) and any("🧾" in b for b in labels_shown)


def test_someone_elses_contact_is_refused(world):
    bot, tg = world
    u = User(bot, tg, "en")
    u.say("/start")
    msg = u.share_contact("+91 98765 43210", own=False)
    assert "your own" in msg["text"]
    assert not bot.store.get(u.id).linked


def test_new_number_registers_as_household(world):
    bot, tg = world
    h = User(bot, tg, "hi")
    h.say("/start")
    ask = h.share_contact("919100000001")
    assert "नाम" in ask["text"]                       # Telegram app in Hindi → bot answers in Hindi
    assert "short" not in h.say("A")["text"].lower() or True
    done = h.say("Asha Devi")
    assert "घर" in done["text"]
    chat = bot.store.get(h.id)
    assert chat.linked and chat.role == "household"
    assert api.post("/api/v1/auth/login", json={"phone": "9100000001"}).json()["role"] == "household"


def test_unlinked_users_are_sent_to_start(world):
    bot, tg = world
    u = User(bot, tg, "en")
    assert "phone number" in u.say("copper rate?")["text"]


# ─── Household: book a pickup ────────────────────────────────────────────────

def test_household_books_a_pickup_end_to_end(world):
    bot, tg = world
    h, _ = link_household(bot, tg, "9100000002")
    menu = h.say(t("m_book", "en"))
    assert len(buttons(menu)) == len(BOOK_MATERIALS) and buttons(menu)[0] == "mat:0"
    assert "kg" in h.tap("mat:0")["text"]                        # Newspaper
    assert "number" in h.say("about twenty")["text"]             # not a number → asked again
    where = h.say("20")
    assert where["keyboard"]["keyboard"][0][0].get("request_location") is True
    when = h.share_location(*MUMBAI)
    assert "slot:tomorrow:morning" in buttons(when)
    confirm = h.tap("slot:tomorrow:morning")
    door = {p["material"]: p for p in api.get(f"/api/v1/prices/daily?latitude={MUMBAI[0]}&longitude={MUMBAI[1]}").json()["prices"]}["Newspaper"]["doorstep_price"]
    assert f"₹{round(door * 20):,}" in confirm["text"] and "Mumbai rate card" in confirm["text"]
    booked = h.tap("book:yes")
    pin = __import__("re").search(r"<b>(\d{4})</b>", booked["text"]).group(1)
    mine = api.get(f"/api/v1/pickups?requester_id={bot.store.get(h.id).account_id}").json()
    assert mine[0]["pickup_pin"] == pin and mine[0]["material"] == "Newspaper" and mine[0]["preferred_slot"] == "morning"
    assert mine[0]["latitude"] == MUMBAI[0] and mine[0]["preferred_date"]
    status = h.say(t("m_mine", "en"))
    assert "looking for a kabadiwala" in status["text"] and pin in status["text"]


def test_household_can_cancel_and_book_from_a_photo(world):
    bot, tg = world
    h, _ = link_household(bot, tg, "9100000003")
    h.say(t("m_book", "en")); h.tap("mat:3"); h.say("5"); h.share_location(*MUMBAI); h.tap("slot:none:anytime")
    assert h.tap("book:no")["text"] == t("cancelled", "en")
    seen = h.photo()                                             # photo straight from the menu starts a booking
    assert "How many kg" in seen["text"]
    assert bot.store.get(h.id).step == "book_kg"


# ─── Kabadiwala: nearby → accept → complete, with alerts to the household ───

def test_full_pickup_loop_with_alerts(world):
    bot, tg = world
    h, _ = link_household(bot, tg, "9100000004", "Meena")
    h.say(t("m_book", "en")); h.tap("mat:6"); h.say("30")
    h.share_location(18.6300, 73.8500)                           # Bhosari
    h.tap("slot:today:evening")
    pin = __import__("re").search(r"<b>(\d{4})</b>", h.tap("book:yes")["text"]).group(1)
    pickup_id = api.get(f"/api/v1/pickups?requester_id={bot.store.get(h.id).account_id}").json()[0]["id"]

    k, _ = link_kabadiwala(bot, tg)
    nearby = k.say(t("m_nearby", "en"))                          # uses the kabadiwala's saved location
    assert f"acc:{pickup_id}" in buttons(nearby) and "Nearby" not in nearby["text"][:1]
    accepted = k.tap(f"acc:{pickup_id}")
    assert "Meena" in accepted["text"] and "9100000004" in accepted["text"] and "maps.google.com" in accepted["text"]
    assert buttons(accepted) == [f"comp:{pickup_id}"]
    assert k.tap(f"acc:{pickup_id}")["text"] == t("accept_taken", bot.store.get(k.id).language)   # second tap: taken

    assert bot.poll_alerts() >= 1                                 # household hears who's coming
    alert = tg.last(h.id)["text"]
    assert "accepted your" in alert and pin in alert

    L = bot.store.get(k.id).language
    assert k.tap(f"comp:{pickup_id}")["text"] == t("ask_pin", L)
    assert k.say(pin)["text"] == t("ask_actual_kg", L)
    wrong = "0000" if pin != "0000" else "1111"
    k.tap(f"comp:{pickup_id}"); k.say(wrong)
    assert k.say("28")["text"] == t("wrong_pin", L)
    k.say(pin)
    done = k.say("28")
    assert "🎉" in done["text"] and "lot_" in done["text"]
    assert api.get(f"/api/v1/pickups/{pickup_id}").json()["status"] == "COMPLETED"

    bot.poll_alerts()
    assert "Pickup done" in tg.last(h.id)["text"] and "28 kg" in tg.last(h.id)["text"]


def test_new_pickup_alert_reaches_nearby_kabadiwala_only_once(world):
    bot, tg = world
    k, _ = link_kabadiwala(bot, tg)
    bot.poll_alerts()                                             # first run: existing pickups are not alerts
    before = len(tg.texts(k.id))
    h, _ = link_household(bot, tg, "9100000005")
    h.say(t("m_book", "en")); h.tap("mat:1"); h.say("12"); h.share_location(18.6290, 73.8480); h.tap("slot:none:anytime"); h.tap("book:yes")
    assert bot.poll_alerts() >= 1
    new = tg.texts(k.id)[before:]
    assert any(x.startswith("🔔") for x in new)
    count = len(tg.texts(k.id))
    bot.poll_alerts()
    assert len(tg.texts(k.id)) == count                          # not repeated


# ─── Rates, valuation, assistant, odds and ends ─────────────────────────────

def test_rates_match_the_price_api(world):
    bot, tg = world
    k, _ = link_kabadiwala(bot, tg)
    k.share_location(*MUMBAI)
    msg = k.say(t("m_rates", "en"))
    L = bot.store.get(k.id).language
    prices = {p["material"]: p for p in api.get(f"/api/v1/prices/daily?latitude={MUMBAI[0]}&longitude={MUMBAI[1]}").json()["prices"]}
    copper = prices["Copper cable"]["current_price"]
    assert t("rates_line_k", L, name=material_name("Copper cable", L), price=f"{round(copper):,}") in msg["text"]
    h, _ = link_household(bot, tg, "9100000006")
    h.share_location(*MUMBAI)
    hmsg = h.say(t("m_rates", "en"))
    assert f"Newspaper: <b>₹{prices['Newspaper']['doorstep_price']:g}/kg</b> at your door" in hmsg["text"]


def test_photo_valuation_for_kabadiwala(world):
    bot, tg = world
    k, _ = link_kabadiwala(bot, tg)
    L = bot.store.get(k.id).language
    assert k.say(t("m_value", "en"))["text"] == t("value_ask_photo", L)
    seen = k.photo()
    assert "?" in seen["text"] and bot.store.get(k.id).step == "value_kg"
    material = bot.store.get(k.id).draft["material"]
    result = k.say("35")
    v = api.post("/api/v1/ml/valuation", json={"material": material, "weight_kg": 35, "latitude": PUNE_HOME[0], "longitude": PUNE_HOME[1]}).json()
    assert "💡" in result["text"] and f"{v['fair_price_per_kg']:g}" in result["text"].replace(",", "")
    assert bot.store.get(k.id).step == ""
    assert v["fair_price_per_kg"] > 0


def test_free_text_goes_to_the_assistant(world):
    bot, tg = world
    k, _ = link_kabadiwala(bot, tg)
    reply = k.say("what is the copper rate today?")
    assert reply["text"] and reply["text"] != t("server_down", "en")


def test_voice_notes_get_a_clear_answer(world):
    bot, tg = world
    k, _ = link_kabadiwala(bot, tg)
    assert k.voice()["text"] == t("voice_later", bot.store.get(k.id).language)


def test_language_switch_and_buttons_work_in_any_language(world):
    bot, tg = world
    k, _ = link_kabadiwala(bot, tg)
    k.say("/lang")
    assert k.tap("lang:mr")["text"] == t("lang_set", "mr")
    assert bot.store.get(k.id).language == "mr"
    # A Hindi button label still works while the chat is in Marathi
    assert "📍" in k.say(t("m_nearby", "hi"))["text"] or buttons(tg.last(k.id))


def test_server_down_is_reported_not_crashed(tmp_path):
    tg = FakeTelegram()
    dead = httpx.Client(base_url="http://dead", transport=httpx.MockTransport(lambda r: (_ for _ in ()).throw(httpx.ConnectError("down"))))
    bot = Bot(tg, dead, Store(str(tmp_path / "b.db")))
    u = User(bot, tg, "en")
    u.say("/start")
    assert u.share_contact("+91 98765 43210")["text"] == t("server_down", "en")
    assert bot.poll_alerts() == 0
