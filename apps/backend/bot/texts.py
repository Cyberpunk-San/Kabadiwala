# apps/backend/bot/texts.py
"""Everything the bot says, in English, Hindi and Marathi. Placeholders use str.format."""

from __future__ import annotations

import json
import os
from typing import Dict

_NAMES = json.load(open(os.path.join(os.path.dirname(__file__), "material_names.json"), encoding="utf-8"))

T: Dict[str, Dict[str, str]] = {
    "welcome": {
        "en": "🙏 Namaste! I'm the <b>Mai Hu Kabadiwala</b> bot.\nTap the button below to share your phone number so I can find your account.",
        "hi": "🙏 नमस्ते! मैं <b>मैं हूँ कबाड़ीवाला</b> बॉट हूँ।\nअपना खाता ढूँढने के लिए नीचे के बटन से अपना फ़ोन नंबर भेजें।",
        "mr": "🙏 नमस्कार! मी <b>मैं हूँ कबाड़ीवाला</b> बॉट आहे.\nतुमचे खाते शोधण्यासाठी खालच्या बटणाने तुमचा फोन नंबर पाठवा.",
    },
    "share_phone_btn": {"en": "📱 Share my phone number", "hi": "📱 मेरा फ़ोन नंबर भेजें", "mr": "📱 माझा फोन नंबर पाठवा"},
    "own_contact_only": {"en": "Please share <b>your own</b> number with the button.", "hi": "कृपया बटन से <b>अपना</b> नंबर भेजें।", "mr": "कृपया बटणाने <b>तुमचा स्वतःचा</b> नंबर पाठवा."},
    "not_registered": {
        "en": "No account for this number yet. Send your <b>name</b> to join as a household and book pickups.\n(Kabadiwalas: please sign up in the app — KYC is needed to accept jobs.)",
        "hi": "इस नंबर का अभी कोई खाता नहीं है। घर के रूप में जुड़ने और पिकअप बुलाने के लिए अपना <b>नाम</b> भेजें।\n(कबाड़ीवाले: काम लेने के लिए KYC ज़रूरी है — कृपया ऐप में जुड़ें।)",
        "mr": "या नंबरचे अजून खाते नाही. घर म्हणून जोडण्यासाठी आणि पिकअप बोलावण्यासाठी तुमचे <b>नाव</b> पाठवा.\n(भंगारवाले: काम घेण्यासाठी KYC लागते — कृपया ॲपमध्ये नोंदणी करा.)",
    },
    "name_too_short": {"en": "Please send your name (at least 2 letters).", "hi": "कृपया अपना नाम भेजें (कम से कम 2 अक्षर)।", "mr": "कृपया तुमचे नाव पाठवा (किमान 2 अक्षरे)."},
    "linked": {
        "en": "✅ Hi {name}! You're signed in as <b>{role}</b>. Choose from the menu below, or just ask me anything.",
        "hi": "✅ नमस्ते {name}! आप <b>{role}</b> के रूप में जुड़ गए हैं। नीचे मेनू से चुनें, या कुछ भी पूछें।",
        "mr": "✅ नमस्कार {name}! तुम्ही <b>{role}</b> म्हणून जोडले गेलात. खालील मेनूमधून निवडा, किंवा काहीही विचारा.",
    },
    "role_kabadiwala": {"en": "kabadiwala", "hi": "कबाड़ीवाला", "mr": "भंगारवाला"},
    "role_household": {"en": "household", "hi": "घर", "mr": "घर"},
    "role_company": {"en": "company", "hi": "कंपनी", "mr": "कंपनी"},
    "not_linked": {"en": "Please share your phone number first — tap /start.", "hi": "पहले अपना फ़ोन नंबर भेजें — /start दबाएँ।", "mr": "आधी तुमचा फोन नंबर पाठवा — /start दाबा."},

    # menus
    "m_nearby": {"en": "📍 Nearby pickups", "hi": "📍 पास के पिकअप", "mr": "📍 जवळचे पिकअप"},
    "m_rates": {"en": "💰 Today's rates", "hi": "💰 आज के भाव", "mr": "💰 आजचे दर"},
    "m_jobs": {"en": "🧾 My jobs", "hi": "🧾 मेरे काम", "mr": "🧾 माझी कामे"},
    "m_value": {"en": "📷 Value my scrap", "hi": "📷 कबाड़ की कीमत", "mr": "📷 भंगाराची किंमत"},
    "m_book": {"en": "🛺 Book a pickup", "hi": "🛺 पिकअप बुलाएँ", "mr": "🛺 पिकअप बोलवा"},
    "m_mine": {"en": "📦 My pickups", "hi": "📦 मेरी पिकअप", "mr": "📦 माझे पिकअप"},
    "m_help": {"en": "❓ Help", "hi": "❓ मदद", "mr": "❓ मदत"},

    # location
    "send_location_btn": {"en": "📍 Send my location", "hi": "📍 मेरी लोकेशन भेजें", "mr": "📍 माझे लोकेशन पाठवा"},
    "use_saved_btn": {"en": "🏠 Use my saved address", "hi": "🏠 मेरा सेव पता", "mr": "🏠 माझा सेव्ह पत्ता"},
    "ask_location": {"en": "Send your location so I can work out prices and distances for your area.", "hi": "अपनी लोकेशन भेजें ताकि मैं आपके इलाके के भाव और दूरी बता सकूँ।", "mr": "तुमचे लोकेशन पाठवा म्हणजे मी तुमच्या भागाचे दर आणि अंतर सांगू शकेन."},

    # rates
    "rates_title": {"en": "💰 <b>Today's rates near you</b>", "hi": "💰 <b>आपके पास आज के भाव</b>", "mr": "💰 <b>तुमच्या जवळचे आजचे दर</b>"},
    "rates_line_k": {"en": "{name}: <b>₹{price}/kg</b>", "hi": "{name}: <b>₹{price}/किलो</b>", "mr": "{name}: <b>₹{price}/किलो</b>"},
    "rates_line_h": {"en": "{name}: <b>₹{door}/kg</b> at your door", "hi": "{name}: घर पर <b>₹{door}/किलो</b>", "mr": "{name}: घरी <b>₹{door}/किलो</b>"},
    "rates_live": {"en": "Metals: live exchange prices · household scrap: city rate cards", "hi": "धातु: लाइव बाज़ार भाव · घरेलू कबाड़: शहर के रेट कार्ड", "mr": "धातू: लाइव्ह बाजार दर · घरगुती भंगार: शहराचे रेट कार्ड"},
    "rates_reference": {"en": "Reference rates (live market unavailable right now)", "hi": "अनुमानित भाव (अभी लाइव बाज़ार उपलब्ध नहीं)", "mr": "अंदाजे दर (सध्या लाइव्ह बाजार उपलब्ध नाही)"},

    # kabadiwala: nearby pickups & jobs
    "nearby_title": {"en": "📍 <b>Open pickups, nearest first</b>", "hi": "📍 <b>खुले पिकअप, सबसे पास वाले पहले</b>", "mr": "📍 <b>खुले पिकअप, सर्वात जवळचे आधी</b>"},
    "nearby_line": {"en": "{i}. {material} · {kg} kg · {km} km · ≈₹{value}\n    {area}", "hi": "{i}. {material} · {kg} किलो · {km} किमी · ≈₹{value}\n    {area}", "mr": "{i}. {material} · {kg} किलो · {km} किमी · ≈₹{value}\n    {area}"},
    "nearby_none": {"en": "No open pickup requests right now. I'll message you when one comes in near you.", "hi": "अभी कोई खुला पिकअप नहीं है। आपके पास नया आते ही मैं बताऊँगा।", "mr": "सध्या कोणताही खुला पिकअप नाही. तुमच्या जवळ नवीन आला की मी कळवेन."},
    "accept_btn": {"en": "✅ Accept {i}", "hi": "✅ {i} स्वीकार करें", "mr": "✅ {i} स्वीकारा"},
    "accepted": {
        "en": "✅ Accepted! {material}, {kg} kg\n👤 {name} · 📞 {phone}\n🏠 {address}\n🗺 {map}\n\nWhen you've weighed and paid at the door, tap <b>Complete</b> and enter the customer's PIN.",
        "hi": "✅ स्वीकार हो गया! {material}, {kg} किलो\n👤 {name} · 📞 {phone}\n🏠 {address}\n🗺 {map}\n\nदरवाज़े पर तौलकर पैसे देने के बाद <b>पूरा करें</b> दबाएँ और ग्राहक का PIN डालें।",
        "mr": "✅ स्वीकारले! {material}, {kg} किलो\n👤 {name} · 📞 {phone}\n🏠 {address}\n🗺 {map}\n\nदारात वजन करून पैसे दिल्यावर <b>पूर्ण करा</b> दाबा आणि ग्राहकाचा PIN टाका.",
    },
    "complete_btn": {"en": "🏁 Complete {material}", "hi": "🏁 पूरा करें: {material}", "mr": "🏁 पूर्ण करा: {material}"},
    "accept_taken": {"en": "Sorry — someone already took this pickup.", "hi": "माफ़ करें — यह पिकअप कोई और ले चुका है।", "mr": "माफ करा — हा पिकअप कोणीतरी आधीच घेतला."},
    "accept_kyc": {"en": "Complete KYC in the app before accepting pickups.", "hi": "पिकअप लेने से पहले ऐप में KYC पूरा करें।", "mr": "पिकअप घेण्याआधी ॲपमध्ये KYC पूर्ण करा."},
    "ask_pin": {"en": "Enter the customer's 4-digit PIN:", "hi": "ग्राहक का 4 अंकों का PIN डालें:", "mr": "ग्राहकाचा 4 अंकी PIN टाका:"},
    "ask_actual_kg": {"en": "How many kg did you actually collect?", "hi": "असल में कितने किलो उठाए?", "mr": "प्रत्यक्षात किती किलो उचलले?"},
    "wrong_pin": {"en": "❌ Wrong PIN — ask the customer to check their app or chat, then try again.", "hi": "❌ गलत PIN — ग्राहक से दोबारा देखने को कहें और फिर से डालें।", "mr": "❌ चुकीचा PIN — ग्राहकाला पुन्हा तपासायला सांगा आणि परत टाका."},
    "completed": {"en": "🎉 Done! You paid ₹{paid} for {kg} kg. It's now your lot <code>{lot}</code> — sell it from the app's Market.", "hi": "🎉 हो गया! आपने {kg} किलो के ₹{paid} दिए। यह अब आपका लॉट <code>{lot}</code> है — ऐप के बाज़ार से बेचें।", "mr": "🎉 झाले! तुम्ही {kg} किलोचे ₹{paid} दिले. हा आता तुमचा लॉट <code>{lot}</code> आहे — ॲपच्या बाजारातून विका."},
    "jobs_title": {"en": "🧾 <b>Your accepted pickups</b>", "hi": "🧾 <b>आपके लिए हुए पिकअप</b>", "mr": "🧾 <b>तुम्ही घेतलेले पिकअप</b>"},
    "jobs_none": {"en": "No pickups in progress. Tap 📍 Nearby pickups to find one.", "hi": "अभी कोई पिकअप चालू नहीं। 📍 पास के पिकअप से ढूँढें।", "mr": "सध्या कोणताही पिकअप सुरू नाही. 📍 जवळचे पिकअप मधून शोधा."},

    # valuation
    "value_ask_photo": {"en": "Send a photo of the scrap 📷", "hi": "कबाड़ की फ़ोटो भेजें 📷", "mr": "भंगाराचा फोटो पाठवा 📷"},
    "value_seen": {"en": "Looks like <b>{material}</b> ({conf}% sure).{safety}\nHow many kg is it?", "hi": "यह <b>{material}</b> लगता है ({conf}% भरोसा)।{safety}\nकितने किलो है?", "mr": "हे <b>{material}</b> दिसते ({conf}% खात्री).{safety}\nकिती किलो आहे?"},
    "value_result": {
        "en": "💡 Fair price: <b>₹{fair}/kg</b> → ₹{payout} for {kg} kg\n🏆 Best buyer: {buyer} pays ₹{best}/kg — ₹{net} in your hand after pickup and fees.\n<i>{why}</i>",
        "hi": "💡 सही दाम: <b>₹{fair}/किलो</b> → {kg} किलो के ₹{payout}\n🏆 सबसे अच्छा खरीदार: {buyer} ₹{best}/किलो देगा — पिकअप और फ़ीस के बाद हाथ में ₹{net}।\n<i>{why}</i>",
        "mr": "💡 योग्य दर: <b>₹{fair}/किलो</b> → {kg} किलोचे ₹{payout}\n🏆 सर्वोत्तम खरेदीदार: {buyer} ₹{best}/किलो देईल — पिकअप व फी नंतर हातात ₹{net}.\n<i>{why}</i>",
    },
    "value_no_buyer": {"en": "💡 Fair price: <b>₹{fair}/kg</b> → ₹{payout} for {kg} kg. No registered buyer for this yet — sell to your local dealer at around this rate.", "hi": "💡 सही दाम: <b>₹{fair}/किलो</b> → {kg} किलो के ₹{payout}। इसका अभी कोई रजिस्टर्ड खरीदार नहीं — स्थानीय व्यापारी को लगभग इसी भाव पर बेचें।", "mr": "💡 योग्य दर: <b>₹{fair}/किलो</b> → {kg} किलोचे ₹{payout}. याचा अजून नोंदणीकृत खरेदीदार नाही — स्थानिक व्यापाऱ्याला साधारण याच दराने विका."},

    # household booking
    "book_material": {"en": "What are you giving away? Pick one, or send a photo 📷", "hi": "क्या देना है? एक चुनें, या फ़ोटो भेजें 📷", "mr": "काय द्यायचे आहे? एक निवडा, किंवा फोटो पाठवा 📷"},
    "book_kg": {"en": "About how many kg of {material}? (a guess is fine)", "hi": "{material} लगभग कितने किलो? (अंदाज़ा ठीक है)", "mr": "{material} साधारण किती किलो? (अंदाज चालेल)"},
    "book_where": {"en": "Where should the kabadiwala come?", "hi": "कबाड़ीवाला कहाँ आए?", "mr": "भंगारवाला कुठे यावा?"},
    "book_when": {"en": "When is good for you?", "hi": "आपके लिए कब ठीक है?", "mr": "तुमच्यासाठी केव्हा योग्य?"},
    "slot_today": {"en": "Today", "hi": "आज", "mr": "आज"},
    "slot_tomorrow": {"en": "Tomorrow", "hi": "कल", "mr": "उद्या"},
    "slot_morning": {"en": "morning", "hi": "सुबह", "mr": "सकाळ"},
    "slot_afternoon": {"en": "afternoon", "hi": "दोपहर", "mr": "दुपार"},
    "slot_evening": {"en": "evening", "hi": "शाम", "mr": "संध्याकाळ"},
    "slot_anytime": {"en": "Any time", "hi": "कभी भी", "mr": "केव्हाही"},
    "book_confirm": {
        "en": "Please confirm:\n• {material}, about {kg} kg\n• {when}\n• You'll get about <b>₹{estimate}</b> at the door (₹{door}/kg · {source})",
        "hi": "कृपया पक्का करें:\n• {material}, लगभग {kg} किलो\n• {when}\n• घर पर लगभग <b>₹{estimate}</b> मिलेंगे (₹{door}/किलो · {source})",
        "mr": "कृपया खात्री करा:\n• {material}, साधारण {kg} किलो\n• {when}\n• घरी साधारण <b>₹{estimate}</b> मिळतील (₹{door}/किलो · {source})",
    },
    "confirm_btn": {"en": "✅ Book it", "hi": "✅ बुक करें", "mr": "✅ बुक करा"},
    "cancel_btn": {"en": "✖ Cancel", "hi": "✖ रद्द करें", "mr": "✖ रद्द करा"},
    "booked": {
        "en": "🎉 Booked! Nearby kabadiwalas can see your request now.\n🔐 Your pickup PIN: <b>{pin}</b>\nGive it only after your scrap is weighed and you're paid.",
        "hi": "🎉 बुक हो गया! पास के कबाड़ीवाले अब आपकी रिक्वेस्ट देख सकते हैं।\n🔐 आपका पिकअप PIN: <b>{pin}</b>\nकबाड़ तौलने और पैसे मिलने के बाद ही बताएँ।",
        "mr": "🎉 बुक झाले! जवळचे भंगारवाले आता तुमची विनंती पाहू शकतात.\n🔐 तुमचा पिकअप PIN: <b>{pin}</b>\nभंगाराचे वजन होऊन पैसे मिळाल्यावरच सांगा.",
    },
    "cancelled": {"en": "Okay, cancelled.", "hi": "ठीक है, रद्द कर दिया।", "mr": "ठीक आहे, रद्द केले."},
    "mine_title": {"en": "📦 <b>Your pickups</b>", "hi": "📦 <b>आपकी पिकअप</b>", "mr": "📦 <b>तुमचे पिकअप</b>"},
    "mine_none": {"en": "No pickups yet. Tap 🛺 Book a pickup.", "hi": "अभी कोई पिकअप नहीं। 🛺 पिकअप बुलाएँ दबाएँ।", "mr": "अजून पिकअप नाही. 🛺 पिकअप बोलवा दाबा."},
    "status_OPEN": {"en": "looking for a kabadiwala · PIN {pin}", "hi": "कबाड़ीवाला ढूँढ रहे हैं · PIN {pin}", "mr": "भंगारवाला शोधत आहोत · PIN {pin}"},
    "status_ACCEPTED": {"en": "{collector} is coming ({phone}) · PIN {pin}", "hi": "{collector} आ रहे हैं ({phone}) · PIN {pin}", "mr": "{collector} येत आहेत ({phone}) · PIN {pin}"},
    "status_COMPLETED": {"en": "done · ₹{paid} paid", "hi": "पूरा · ₹{paid} मिले", "mr": "पूर्ण · ₹{paid} मिळाले"},
    "status_CANCELLED": {"en": "cancelled", "hi": "रद्द", "mr": "रद्द"},

    # notifications
    "n_new_pickup": {"en": "🔔 New pickup {km} km away: {material}, {kg} kg (≈₹{value}) · {area}", "hi": "🔔 {km} किमी दूर नया पिकअप: {material}, {kg} किलो (≈₹{value}) · {area}", "mr": "🔔 {km} किमी अंतरावर नवीन पिकअप: {material}, {kg} किलो (≈₹{value}) · {area}"},
    "n_accepted": {"en": "🛺 {collector} accepted your {material} pickup and is on the way. 📞 {phone}\nKeep your PIN ready: <b>{pin}</b>", "hi": "🛺 {collector} ने आपका {material} पिकअप ले लिया है और आ रहे हैं। 📞 {phone}\nअपना PIN तैयार रखें: <b>{pin}</b>", "mr": "🛺 {collector} यांनी तुमचा {material} पिकअप घेतला आहे आणि येत आहेत. 📞 {phone}\nतुमचा PIN तयार ठेवा: <b>{pin}</b>"},
    "n_completed": {"en": "✅ Pickup done — you received ₹{paid} for {kg} kg of {material}. Thank you for recycling! ♻", "hi": "✅ पिकअप पूरा — {kg} किलो {material} के ₹{paid} मिले। रीसायकल करने के लिए धन्यवाद! ♻", "mr": "✅ पिकअप पूर्ण — {kg} किलो {material} चे ₹{paid} मिळाले. रीसायकल केल्याबद्दल धन्यवाद! ♻"},

    # misc
    "bad_number": {"en": "Please send a number, like 12 or 7.5", "hi": "कृपया एक संख्या भेजें, जैसे 12 या 7.5", "mr": "कृपया एक संख्या पाठवा, जसे 12 किंवा 7.5"},
    "voice_later": {"en": "🎤 Voice notes aren't supported yet — please type, or use the buttons.", "hi": "🎤 वॉइस नोट अभी नहीं चलते — कृपया लिखें या बटन दबाएँ।", "mr": "🎤 व्हॉइस नोट अजून चालत नाहीत — कृपया लिहा किंवा बटणे वापरा."},
    "server_down": {"en": "⚠ Our server isn't reachable right now. Please try again in a minute.", "hi": "⚠ अभी सर्वर से जुड़ नहीं पा रहे। एक मिनट बाद फिर कोशिश करें।", "mr": "⚠ सध्या सर्व्हरशी जोडता येत नाही. एका मिनिटाने पुन्हा प्रयत्न करा."},
    "photo_failed": {"en": "I couldn't read that photo — try again in good light, or pick from the list.", "hi": "फ़ोटो समझ नहीं आई — अच्छी रोशनी में फिर भेजें, या सूची से चुनें।", "mr": "फोटो समजला नाही — चांगल्या प्रकाशात पुन्हा पाठवा, किंवा यादीतून निवडा."},
    "lang_pick": {"en": "Choose your language:", "hi": "अपनी भाषा चुनें:", "mr": "तुमची भाषा निवडा:"},
    "lang_set": {"en": "Language set to English.", "hi": "भाषा हिंदी कर दी गई।", "mr": "भाषा मराठी केली."},
    "help_k": {
        "en": "I can help you:\n📍 find open pickups near you (nearest first) and accept them\n🏁 complete a pickup with the customer's PIN\n💰 check today's rates for your area\n📷 value scrap from a photo\n…or just ask, e.g. <i>copper rate today?</i>\n/lang — change language · /start — re-link your number",
        "hi": "मैं आपकी मदद कर सकता हूँ:\n📍 पास के खुले पिकअप देखना (सबसे पास वाले पहले) और लेना\n🏁 ग्राहक के PIN से पिकअप पूरा करना\n💰 आपके इलाके के आज के भाव\n📷 फ़ोटो से कबाड़ की कीमत\n…या कुछ भी पूछें, जैसे <i>आज तांबे का भाव?</i>\n/lang — भाषा बदलें · /start — नंबर फिर से जोड़ें",
        "mr": "मी तुम्हाला मदत करू शकतो:\n📍 जवळचे खुले पिकअप पाहणे (सर्वात जवळचे आधी) आणि घेणे\n🏁 ग्राहकाच्या PIN ने पिकअप पूर्ण करणे\n💰 तुमच्या भागाचे आजचे दर\n📷 फोटोवरून भंगाराची किंमत\n…किंवा काहीही विचारा, जसे <i>आज तांब्याचा दर?</i>\n/lang — भाषा बदला · /start — नंबर पुन्हा जोडा",
    },
    "help_h": {
        "en": "I can help you:\n🛺 book a doorstep pickup (with a photo if you like)\n📦 see who's coming and your PIN\n💰 check what your scrap is worth today\n…or just ask a question.\n/lang — change language · /start — re-link your number",
        "hi": "मैं आपकी मदद कर सकता हूँ:\n🛺 घर से पिकअप बुलाना (चाहें तो फ़ोटो के साथ)\n📦 कौन आ रहा है और आपका PIN\n💰 आज आपके कबाड़ की कीमत\n…या कुछ भी पूछें।\n/lang — भाषा बदलें · /start — नंबर फिर से जोड़ें",
        "mr": "मी तुम्हाला मदत करू शकतो:\n🛺 घरून पिकअप बोलावणे (हवे तर फोटोसह)\n📦 कोण येत आहे आणि तुमचा PIN\n💰 आज तुमच्या भंगाराची किंमत\n…किंवा काहीही विचारा.\n/lang — भाषा बदला · /start — नंबर पुन्हा जोडा",
    },
}


def t(key: str, lang: str, **kw) -> str:
    entry = T[key]
    text = entry.get(lang) or entry["en"]
    return text.format(**kw) if kw else text


def material_name(material: str, lang: str) -> str:
    if lang in ("hi", "mr"):
        return _NAMES.get(material, {}).get(lang, material)
    return material


def labels(key: str):
    """The same button in every language — so a tap is understood whatever language the chat was in."""
    return set(T[key].values())
