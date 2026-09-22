import type { Language } from "../types/domain";

const en = {
  home: "Home",
  collect: "Collect",
  market: "Market",
  earnings: "Earnings",
  profile: "Profile",
  welcome: "Namaste, Ramesh",
  online: "Online",
  offline: "Offline · saved on this phone",
  collectSmarter: "Collect smarter.\nEarn better.",
  opportunity: "TODAY'S OPPORTUNITY",
  copperDemand: "Copper cable is in high demand near you today.",
  viewOpportunities: "View best opportunities",
  sellMaterial: "Sell material",
  takePhoto: "Take a photo",
  speakEntry: "Speak entry",
  checkPrices: "Check prices",
  nearbyDemand: "Nearby demand",
  yourBusiness: "Your business",
  earned: "Earned",
  collected: "Collected",
  weeklyGoal: "Weekly earning goal",
  newCollection: "New collection",
  takeMaterialPhoto: "Take material photo",
  captureHint: "Keep the item in clear light",
  demoScan: "Use guided demo instead",
  safety: "Safety first",
  safetyText: "Do not open batteries, CRT screens, or swollen devices.",
  aiIdentification: "AI IDENTIFICATION",
  confirmResult: "Confirm what the photo shows",
  material: "Material",
  weight: "Approximate weight (kg)",
  speakWeight: "Speak weight instead",
  checkBestPrice: "Check best price",
  bestNet: "BEST NET EARNING",
  estimatedTakeHome: "Your estimated take-home",
  whyBest: "Why this is best for you",
  acceptPickup: "Accept pickup offer",
  buyerOffers: "Best offers nearby",
  rankedByNet: "Ranked by what you take home, not only listed price.",
  listedPrice: "Listed price",
  pickupCost: "Pickup & costs",
  takeHome: "Take home",
  choose: "Choose",
  capturePhoto: "Capture photo",
  retake: "Retake",
  confirmAndSave: "Confirm & save offline",
  lotSaved: "Lot saved offline. It will sync when connected.",
  location: "Pune Industrial Cluster",
  highDemand: "High demand",
  lowTransport: "Low transport cost",
  verifiedBuyer: "Verified buyer",
  cameraPermission: "Camera permission is needed to photograph material.",
  cameraUnavailable: "The camera is unavailable. You can still use guided demo.",
  chooseLanguage: "Choose language",
  traceability: "Traceability",
  myLots: "My lots",
  noLots: "No local lots yet. Your first confirmed collection will appear here.",
  upcoming: "Pickup scheduled",
  synced: "Synced",
  pendingSync: "Waiting to sync",
  growthInsight: "Copper is your best material",
  growthText: "It brought 42% of your earnings. EcoCycle returns the most after pickup costs.",
  paymentReliability: "Payment reliability",
  distance: "Distance",
  available: "Available",
  useDemo: "Guided demo",

  // Bazar Bhav
  bazarBhav: "Bazar Bhav (Mandi Rates)",
  dailyRates: "Daily Scrap & E-Waste Rates",
  tapToHear: "Tap any material to listen in your language",
  priceTrend: "7-Day Trend",
  sellingAdvice: "Market Advice",
  sellThisNow: "Sell this material",

  // Handover & Settlement
  handover: "Digital Handover",
  handoverPass: "Digital Handover Pass",
  scanQrPrompt: "Ask the buyer or recycler to scan this QR code",
  orSharePin: "Or share this 4-digit pickup PIN",
  confirmHandover: "Confirm Handover & Payout",
  handoverSuccess: "Handover verified! ₹{amount} credited via instant settlement.",
  instantPayoutSim: "Instant Settlement (Simulated)",
  traceabilityPass: "Green Traceability Verified",
  utrNumber: "Bank UTR / Transaction ID",

  // Hazard Safety
  hazardAlert: "HAZARDOUS MATERIAL ALERT",
  hazardSafetyPrompt: "Strict precautions required for handling this scrap item.",
  safetyGearNeeded: "Wear thick gloves and eye protection. Keep away from water.",
  hazardAcknowledged: "I have taken necessary safety precautions",

  // Unit Economics Loss Calculator
  lossCalculator: "Middleman Deduction Trap vs. Verified Net",
  lossCalculatorSubtitle: "See how much you lose to unverified scrap middlemen",
  scaleCheating: "Uncalibrated scale cut (5-10%)",
  middlemanCommission: "Middleman margin & transport cut",
  appNetAdvantage: "Your extra earnings with Mai Hu Kabadiwala",
  guaranteedSavings: "Transparent digital scale & direct buyer matching",

  // Aamdani Card
  aamdaniCard: "Aamdani & Collector ID Card",
  warriorId: "Green Eco-Warrior ID",
  socialSecurityNumber: "National E-Waste Social Security",
  goldCollectorTier: "Gold Tier Collector",
  monthlyAamdani: "Estimated Monthly Aamdani",
  carbonOffsetKg: "E-Waste Diverted: 480 kg | CO₂ Saved: 340 kg",
  emergencyHelp: "24x7 Collector Emergency Helpline"
} as const;

const hi: Record<string, string> = {
  home: "होम", collect: "इकट्ठा करें", market: "बाज़ार", earnings: "कमाई", profile: "प्रोफ़ाइल",
  welcome: "नमस्ते, रमेश", online: "ऑनलाइन", offline: "ऑफलाइन · इस फ़ोन पर सेव है",
  collectSmarter: "समझदारी से इकट्ठा करें।\nज़्यादा कमाएं।", opportunity: "आज का अवसर",
  copperDemand: "आज आपके पास कॉपर केबल की मांग ज़्यादा है।", viewOpportunities: "बेहतरीन अवसर देखें",
  sellMaterial: "सामान बेचें", takePhoto: "फोटो लें", speakEntry: "बोलकर भरें", checkPrices: "भाव देखें",
  nearbyDemand: "पास की मांग", yourBusiness: "आपका कारोबार", earned: "कमाया", collected: "इकट्ठा किया",
  weeklyGoal: "साप्ताहिक कमाई का लक्ष्य", newCollection: "नया कलेक्शन", takeMaterialPhoto: "सामान की फोटो लें",
  captureHint: "सामान को साफ़ रोशनी में रखें", demoScan: "गाइडेड डेमो इस्तेमाल करें", safety: "पहले सुरक्षा",
  safetyText: "बैटरी, CRT स्क्रीन या फूले हुए उपकरण न खोलें।", aiIdentification: "एआई पहचान",
  confirmResult: "फोटो में दिख रहा सामान पक्का करें", material: "सामान", weight: "अनुमानित वज़न (किलो)",
  speakWeight: "वज़न बोलकर भरें", checkBestPrice: "सबसे अच्छा भाव देखें", bestNet: "सबसे अच्छी शुद्ध कमाई",
  estimatedTakeHome: "आपकी अनुमानित कमाई", whyBest: "यह आपके लिए सबसे अच्छा क्यों है", acceptPickup: "पिकअप ऑफर स्वीकार करें",
  buyerOffers: "पास के बेहतरीन ऑफर", rankedByNet: "सिर्फ भाव नहीं, आपको मिलने वाली रकम के आधार पर क्रम।",
  listedPrice: "दिया गया भाव", pickupCost: "पिकअप और खर्च", takeHome: "आपको मिलेगा", choose: "चुनें",
  capturePhoto: "फोटो लें", retake: "फिर लें", confirmAndSave: "पक्का करके ऑफलाइन सेव करें", lotSaved: "लॉट ऑफलाइन सेव हो गया। कनेक्शन पर सिंक होगा।",
  location: "पुणे इंडस्ट्रियल क्लस्टर", highDemand: "ज़्यादा मांग", lowTransport: "कम परिवहन खर्च", verifiedBuyer: "सत्यापित खरीदार",
  cameraPermission: "सामान की फोटो के लिए कैमरा अनुमति चाहिए।", cameraUnavailable: "कैमरा उपलब्ध नहीं है। आप डेमो इस्तेमाल कर सकते हैं।",
  chooseLanguage: "भाषा चुनें", traceability: "ट्रेसबिलिटी", myLots: "मेरे लॉट", noLots: "अभी कोई स्थानीय लॉट नहीं है। आपका पहला पक्का कलेक्शन यहां दिखेगा।",
  upcoming: "पिकअप तय है", synced: "सिंक हुआ", pendingSync: "सिंक होने का इंतज़ार", growthInsight: "कॉपर आपका सबसे अच्छा सामान है",
  growthText: "आपकी कमाई का 42% कॉपर से आया। पिकअप खर्च के बाद ईकोसाइकल सबसे अच्छा रिटर्न देता है।", paymentReliability: "भुगतान विश्वसनीयता", distance: "दूरी", available: "उपलब्ध", useDemo: "गाइडेड डेमो",

  // Bazar Bhav
  bazarBhav: "बाज़ार भाव (मंडी दरें)",
  dailyRates: "दैनिक स्क्रैप और ई-कचरा भाव",
  tapToHear: "अपनी भाषा में सुनने के लिए किसी भी सामान पर टैप करें",
  priceTrend: "7 दिनों का रुझान",
  sellingAdvice: "बाज़ार सलाह",
  sellThisNow: "यह सामान अभी बेचें",

  // Handover & Settlement
  handover: "डिजिटल हैंडओवर",
  handoverPass: "डिजिटल हैंडओवर पास",
  scanQrPrompt: "खरीदार या रीसाइक्लर को यह क्यूआर कोड स्कैन करने दें",
  orSharePin: "या यह 4-अंकों का पिकअप पिन बताएं",
  confirmHandover: "हैंडओवर और भुगतान पक्का करें",
  handoverSuccess: "हैंडओवर सत्यापित! तुरंत भुगतान प्राप्त हुआ।",
  instantPayoutSim: "त्वरित बैंक/UPI भुगतान",
  traceabilityPass: "ग्रीन रीसाइक्लिंग सर्टिफिकेट",
  utrNumber: "बैंक यूटीआर / लेनदेन आईडी",

  // Hazard Safety
  hazardAlert: "सावधान! ख़तरनाक सामग्री",
  hazardSafetyPrompt: "इस सामग्री को संभालने के लिए विशेष सावधानी आवश्यक है।",
  safetyGearNeeded: "मोटे दस्ताने और चश्मा पहनें। पानी और आग से दूर रखें।",
  hazardAcknowledged: "मैंने सभी सुरक्षा उपाय अपना लिए हैं",

  // Unit Economics Loss Calculator
  lossCalculator: "बिचौलिया कटौती बनाम शुद्ध कमाई",
  lossCalculatorSubtitle: "देखें कि लोकल बिचौलिया आपको कितना कम भुगतान करता है",
  scaleCheating: "खराब कांटे (तराजू) की कटौती (5-10%)",
  middlemanCommission: "बिचौलिये का कमीशन और मनमाना भाड़ा",
  appNetAdvantage: "मैं हूँ कबाड़ीवाला से होने वाला अतिरिक्त मुनाफ़ा",
  guaranteedSavings: "डिजिटल कांटा और सीधे खरीदार से सबसे ज़्यादा बचत",

  // Aamdani Card
  aamdaniCard: "आमदनी और कबाड़ीवाला पहचान पत्र",
  warriorId: "पर्यावरण योद्धा पहचान पत्र",
  socialSecurityNumber: "राष्ट्रीय ई-श्रम सामाजिक सुरक्षा",
  goldCollectorTier: "गोल्ड कबाड़ीवाला श्रेणी",
  monthlyAamdani: "अनुमानित मासिक आमदनी",
  carbonOffsetKg: "रीसायकल ई-कचरा: 480 किलो | कार्बन बचत: 340 किलो",
  emergencyHelp: "24x7 कबाड़ीवाला आपातकालीन सहायता"
};

const mr: Record<string, string> = {
  home: "मुख्यपृष्ठ", collect: "संकलन", market: "बाजार", earnings: "कमाई", profile: "प्रोफाइल",
  welcome: "नमस्कार, रमेश", online: "ऑनलाइन", offline: "ऑफलाइन · या फोनवर जतन आहे",
  collectSmarter: "हुशारीने संकलन करा.\nजास्त कमवा.", opportunity: "आजची संधी",
  copperDemand: "आज तुमच्या जवळ कॉपर केबलची मागणी जास्त आहे.", viewOpportunities: "उत्तम संधी पहा",
  sellMaterial: "साहित्य विका", takePhoto: "फोटो घ्या", speakEntry: "बोलून नोंद करा", checkPrices: "भाव पहा",
  nearbyDemand: "जवळची मागणी", yourBusiness: "तुमचा व्यवसाय", earned: "कमाई", collected: "संकलित",
  weeklyGoal: "आठवड्याचे कमाईचे उद्दिष्ट", newCollection: "नवीन संकलन", takeMaterialPhoto: "साहित्याचा फोटो घ्या",
  captureHint: "वस्तू स्वच्छ प्रकाशात ठेवा", demoScan: "मार्गदर्शित डेमो वापरा", safety: "सुरक्षितता प्रथम",
  safetyText: "बॅटरी, CRT स्क्रीन किंवा फुगलेली उपकरणे उघडू नका.", aiIdentification: "एआय ओळख",
  confirmResult: "फोटोमधील वस्तूची खात्री करा", material: "साहित्य", weight: "अंदाजे वजन (किलो)",
  speakWeight: "वजन बोलून भरा", checkBestPrice: "सर्वोत्तम भाव पहा", bestNet: "सर्वोत्तम निव्वळ कमाई",
  estimatedTakeHome: "तुमची अंदाजे कमाई", whyBest: "हे तुमच्यासाठी उत्तम का आहे", acceptPickup: "पिकअप ऑफर स्वीकारा",
  buyerOffers: "जवळचे सर्वोत्तम ऑफर", rankedByNet: "फक्त भाव नाही तर हाती येणाऱ्या रकमेनुसार क्रमवारी.",
  listedPrice: "जाहीर भाव", pickupCost: "पिकअप आणि खर्च", takeHome: "तुम्हाला मिळेल", choose: "निवडा",
  capturePhoto: "फोटो घ्या", retake: "पुन्हा घ्या", confirmAndSave: "खात्री करून ऑफलाइन जतन करा", lotSaved: "लॉट ऑफलाइन जतन झाला. कनेक्शन आल्यावर सिंक होईल.",
  location: "पुणे औद्योगिक विभाग", highDemand: "जास्त मागणी", lowTransport: "कमी वाहतूक खर्च", verifiedBuyer: "सत्यापित खरेदीदार",
  cameraPermission: "साहित्याचा फोटो घेण्यासाठी कॅमेरा परवानगी हवी.", cameraUnavailable: "कॅमेरा उपलब्ध नाही. तुम्ही डेमो वापरू शकता.",
  chooseLanguage: "भाषा निवडा", traceability: "मागोवा", myLots: "माझे लॉट", noLots: "अजून स्थानिक लॉट नाहीत. तुमचे पहिले निश्चित संकलन येथे दिसेल.",
  upcoming: "पिकअप नियोजित", synced: "सिंक झाले", pendingSync: "सिंकची प्रतीक्षा", growthInsight: "कॉपर तुमचे सर्वोत्तम साहित्य आहे",
  growthText: "तुमच्या कमाईपैकी 42% कॉपरमधून आला. पिकअप खर्चानंतर इकोसायकल उत्तम परतावा देते.", paymentReliability: "पेमेंट विश्वासार्हता", distance: "अंतर", available: "उपलब्ध", useDemo: "मार्गदर्शित डेमो",

  // Bazar Bhav
  bazarBhav: "बाजार भाव (मंडी दर)",
  dailyRates: "दैनिक स्क्रॅप व ई-कचरा दर",
  tapToHear: "आपल्या भाषेत ऐकण्यासाठी कोणत्याही साहित्यावर टॅप करा",
  priceTrend: "7 दिवसांचा कल",
  sellingAdvice: "बाजार सल्ला",
  sellThisNow: "हे साहित्य त्वरित विका",

  // Handover & Settlement
  handover: "डिजिटल हस्तांतरण",
  handoverPass: "डिजिटल हस्तांतरण पास",
  scanQrPrompt: "खरेदीदार किंवा रीसायकलरला हा क्यूआर कोड स्कॅन करू द्या",
  orSharePin: "किंवा हा 4-अंकी पिकअप पिन सांगा",
  confirmHandover: "हस्तांतरण आणि पेमेंट निश्चित करा",
  handoverSuccess: "हस्तांतरण प्रमाणित! तात्काळ पेमेंट मिळाले.",
  instantPayoutSim: "तात्काळ बँक/UPI पेमेंट",
  traceabilityPass: "ग्रीन रीसायकलिंग प्रमाणपत्र",
  utrNumber: "बँक यूटीआर / व्यवहार आयडी",

  // Hazard Safety
  hazardAlert: "धोकादायक साहित्य इशारा",
  hazardSafetyPrompt: "हे साहित्य हाताळताना विशेष काळजी घेणे आवश्यक आहे.",
  safetyGearNeeded: "जाड हातमोजे आणि चष्मा वापरा. पाणी व आगीपासून दूर ठेवा.",
  hazardAcknowledged: "मी सर्व सुरक्षा खबरदारी घेतली आहे",

  // Unit Economics Loss Calculator
  lossCalculator: "मध्यस्थ वजावट वि. थेट निव्वळ नफा",
  lossCalculatorSubtitle: "स्थानिक दलाल तुमचे किती नुकसान करतात ते पाहा",
  scaleCheating: "खोट्या वजनाची कपात (5-10%)",
  middlemanCommission: "दलालाचे कमिशन आणि छुपी वाहतूक",
  appNetAdvantage: "मी आहे कबाडीवाला मुळे होणारा अतिरिक्त नफा",
  guaranteedSavings: "डिजिटल वजन आणि थेट खरेदीदाराशी व्यवहार",

  // Aamdani Card
  aamdaniCard: "आमदनी आणि कबाडीवाला ओळखपत्र",
  warriorId: "पर्यावरण रक्षक ओळखपत्र",
  socialSecurityNumber: "राष्ट्रीय ई-श्रम सामाजिक सुरक्षा",
  goldCollectorTier: "सुवर्ण कबाडीवाला श्रेणी",
  monthlyAamdani: "अंदाजे मासिक आमदनी",
  carbonOffsetKg: "पुनर्वापर ई-कचरा: 480 किलो | कार्बन बचत: 340 किलो",
  emergencyHelp: "24x7 कबाडीवाला आपत्कालीन मदत"
};

const dictionaries: Record<Language, Record<string, string>> = { en, hi, mr };

export function t(language: Language, key: string) {
  return dictionaries[language][key] ?? en[key as keyof typeof en] ?? key;
}
