import type { BazarPriceItem, Material } from "../types/domain";

export const BAZAR_PRICES: BazarPriceItem[] = [
  {
    id: "p_copper",
    material: "Copper cable",
    category: "Metals",
    currentPrice: 620,
    previousPrice: 585,
    changePercent: 5.98,
    trend: "up",
    demand: "HIGH",
    history7Days: [
      { day: "Day 1", price: 575 },
      { day: "Day 2", price: 580 },
      { day: "Day 3", price: 585 },
      { day: "Day 4", price: 590 },
      { day: "Day 5", price: 605 },
      { day: "Day 6", price: 612 },
      { day: "Day 7", price: 620 }
    ],
    advice: "Strong demand from smelters in Pune MIDC. Sell today to lock in high margins.",
    adviceHi: "पुणे एमआईडीसी में तांबे की भारी मांग है। आज ही बेचकर ज़्यादा मुनाफ़ा कमाएं।",
    adviceMr: "पुणे एमआयडीसीमध्ये तांब्याला मोठी मागणी आहे. चांगल्या नफ्यासाठी आजच विका."
  },
  {
    id: "p_server_boards",
    material: "Server boards",
    category: "Electronics",
    currentPrice: 510,
    previousPrice: 495,
    changePercent: 3.03,
    trend: "up",
    demand: "HIGH",
    history7Days: [
      { day: "Day 1", price: 470 },
      { day: "Day 2", price: 480 },
      { day: "Day 3", price: 485 },
      { day: "Day 4", price: 490 },
      { day: "Day 5", price: 495 },
      { day: "Day 6", price: 502 },
      { day: "Day 7", price: 510 }
    ],
    advice: "Gold and palladium recovery value is peaking. Verified recyclers offering pickup premium.",
    adviceHi: "सोना और पैलेडियम निष्कर्षण की वजह से भाव बढ़ रहा है। रीसाइक्लर अच्छा दाम दे रहे हैं।",
    adviceMr: "गोल्ड व पॅलॅडियम घटकांमुळे भाव तेजीत आहेत. प्रमाणित रीसायकलर्स चांगला परतावा देत आहेत."
  },
  {
    id: "p_aluminium",
    material: "Aluminium",
    category: "Metals",
    currentPrice: 145,
    previousPrice: 142,
    changePercent: 2.11,
    trend: "up",
    demand: "MODERATE",
    history7Days: [
      { day: "Day 1", price: 138 },
      { day: "Day 2", price: 139 },
      { day: "Day 3", price: 140 },
      { day: "Day 4", price: 141 },
      { day: "Day 5", price: 142 },
      { day: "Day 6", price: 143 },
      { day: "Day 7", price: 145 }
    ],
    advice: "Steady automotive casting demand. Good volume turnover expected.",
    adviceHi: "ऑटोमोबाइल सेक्टर से स्थिर मांग। इकट्ठा करके 25 किलो से ऊपर बेचने पर बेहतर भाव।",
    adviceMr: "ऑटोमोबाईल क्षेत्रातून स्थिर मागणी. 25 किलोपेक्षा जास्त वजनावर उत्तम दर."
  },
  {
    id: "p_brass",
    material: "Brass fittings",
    category: "Metals",
    currentPrice: 430,
    previousPrice: 435,
    changePercent: -1.15,
    trend: "down",
    demand: "MODERATE",
    history7Days: [
      { day: "Day 1", price: 440 },
      { day: "Day 2", price: 442 },
      { day: "Day 3", price: 438 },
      { day: "Day 4", price: 436 },
      { day: "Day 5", price: 435 },
      { day: "Day 6", price: 432 },
      { day: "Day 7", price: 430 }
    ],
    advice: "Slight dip in sanitaryware scrap. Hold for 2-3 days if storage permits.",
    adviceHi: "पीतल के भाव में हल्की गिरावट। अगर जगह हो तो 2 दिन रोककर बेचें।",
    adviceMr: "पितळाच्या दरात थोडी घसरण. जागा असल्यास 2 दिवस थांबून विका."
  },
  {
    id: "p_pcb",
    material: "Printed Circuit Boards (PCB)",
    category: "Electronics",
    currentPrice: 340,
    previousPrice: 320,
    changePercent: 6.25,
    trend: "up",
    demand: "HIGH",
    history7Days: [
      { day: "Day 1", price: 310 },
      { day: "Day 2", price: 315 },
      { day: "Day 3", price: 318 },
      { day: "Day 4", price: 320 },
      { day: "Day 5", price: 325 },
      { day: "Day 6", price: 332 },
      { day: "Day 7", price: 340 }
    ],
    advice: "Government e-waste circular mandates are driving up green recycling procurement.",
    adviceHi: "सरकार के ई-कचरा नियमों से प्रमाणित रीसाइक्लिंग कंपनियों से ज़बरदस्त मांग।",
    adviceMr: "शासकीय नियमांमुळे अधिकृत कंपन्यांकडून पीसीबी बोर्डांना मोठी मागणी."
  },
  {
    id: "p_motors",
    material: "Electric motors",
    category: "Heavy Scrap",
    currentPrice: 195,
    previousPrice: 195,
    changePercent: 0.0,
    trend: "stable",
    demand: "MODERATE",
    history7Days: [
      { day: "Day 1", price: 192 },
      { day: "Day 2", price: 193 },
      { day: "Day 3", price: 194 },
      { day: "Day 4", price: 195 },
      { day: "Day 5", price: 195 },
      { day: "Day 6", price: 195 },
      { day: "Day 7", price: 195 }
    ],
    advice: "Stable copper winding extraction price. Copper-heavy motors yield highest return.",
    adviceHi: "स्थिर भाव। भारी कॉपर वाइंडिंग वाली मोटरों को अलग छांटकर बेचें।",
    adviceMr: "स्थिर भाव. तांब्याची वाइंडिंग असलेल्या मोटर्स वेगळ्या करून विकल्यास अधिक नफा."
  },
  {
    id: "p_lithium",
    material: "Lithium-ion batteries",
    category: "Batteries",
    currentPrice: 280,
    previousPrice: 265,
    changePercent: 5.66,
    trend: "up",
    demand: "HIGH",
    history7Days: [
      { day: "Day 1", price: 250 },
      { day: "Day 2", price: 255 },
      { day: "Day 3", price: 260 },
      { day: "Day 4", price: 265 },
      { day: "Day 5", price: 270 },
      { day: "Day 6", price: 275 },
      { day: "Day 7", price: 280 }
    ],
    advice: "EV & cobalt recovery plants buying aggressively. Handle with safety precautions.",
    adviceHi: "ईवी और कोबाल्ट रीसाइक्लिंग प्लांट तेजी से खरीद रहे हैं। सावधानीपूर्वक संभालें।",
    adviceMr: "ईव्ही बॅटरी रीसायकलर्सकडून मोठी मागणी. सुरक्षेचे नियम पाळून संकलन करा."
  },
  {
    id: "p_iron",
    material: "Iron & steel scrap",
    category: "Heavy Scrap",
    currentPrice: 38,
    previousPrice: 37.5,
    changePercent: 1.33,
    trend: "up",
    demand: "MODERATE",
    history7Days: [
      { day: "Day 1", price: 36.5 },
      { day: "Day 2", price: 36.8 },
      { day: "Day 3", price: 37.0 },
      { day: "Day 4", price: 37.2 },
      { day: "Day 5", price: 37.5 },
      { day: "Day 6", price: 37.8 },
      { day: "Day 7", price: 38.0 }
    ],
    advice: "Construction rebar scrap demand is healthy. Best sold in lots > 50 kg.",
    adviceHi: "लोहे का भाव स्थिर एवं मजबूत। 50 किलो से अधिक का लॉट बनाकर बेचना फ़ायदेमंद।",
    adviceMr: "बांधकाम क्षेत्रातील स्टील मागणी चांगली. 50 किलोपेक्षा जास्त लॉट केल्यास फायदा."
  },
  {
    id: "p_mixed_ewaste",
    material: "Mixed e-waste",
    category: "Electronics",
    currentPrice: 85,
    previousPrice: 80,
    changePercent: 6.25,
    trend: "up",
    demand: "MODERATE",
    history7Days: [
      { day: "Day 1", price: 75 },
      { day: "Day 2", price: 76 },
      { day: "Day 3", price: 78 },
      { day: "Day 4", price: 80 },
      { day: "Day 5", price: 81 },
      { day: "Day 6", price: 83 },
      { day: "Day 7", price: 85 }
    ],
    advice: "Mixed e-waste accepted at bulk. Sort out metals first for better yield.",
    adviceHi: "मिश्रित ई-कचरा थोक में स्वीकृत। पहले धातुएं अलग करने पर ज़्यादा कमाई।",
    adviceMr: "मिश्र ई-कचरा घाऊक स्वरूपात स्वीकारला जातो. धातू आधी वेगळ्या करा."
  },
  {
    id: "p_crt",
    material: "CRT & monitor glass",
    category: "Electronics",
    currentPrice: 18,
    previousPrice: 20,
    changePercent: -10.0,
    trend: "down",
    demand: "LOW",
    history7Days: [
      { day: "Day 1", price: 22 },
      { day: "Day 2", price: 21 },
      { day: "Day 3", price: 21 },
      { day: "Day 4", price: 20 },
      { day: "Day 5", price: 19 },
      { day: "Day 6", price: 18 },
      { day: "Day 7", price: 18 }
    ],
    advice: "CRT demand is declining. Only TSDF-authorised recyclers accept safely. Do not break.",
    adviceHi: "सीआरटी की मांग घट रही है। केवल अधिकृत TSDF केंद्र स्वीकार करते हैं। न तोड़ें।",
    adviceMr: "सीआरटीची मागणी घटत आहे. फक्त TSDF परवानाधारक रीसायकलर स्वीकारतात. तोडू नका."
  },
  {
    id: "p_lead_acid",
    material: "Lead acid batteries",
    category: "Batteries",
    currentPrice: 98,
    previousPrice: 95,
    changePercent: 3.16,
    trend: "up",
    demand: "HIGH",
    history7Days: [
      { day: "Day 1", price: 90 },
      { day: "Day 2", price: 91 },
      { day: "Day 3", price: 93 },
      { day: "Day 4", price: 94 },
      { day: "Day 5", price: 95 },
      { day: "Day 6", price: 96 },
      { day: "Day 7", price: 98 }
    ],
    advice: "Lead recyclers offering good rates. Keep upright, avoid tipping. UPS and automotive demand is high.",
    adviceHi: "लेड रीसाइक्लर अच्छा दाम दे रहे हैं। सीधा रखें, उल्टा न पलटें। यूपीएस और गाड़ियों में ज़बरदस्त मांग।",
    adviceMr: "लेड रीसायकलर्स चांगला दर देत आहेत. सरळ ठेवा. यूपीएस आणि वाहनांची मागणी जास्त."
  },
  {
    id: "p_compressors",
    material: "Compressors & cooling units",
    category: "Heavy Scrap",
    currentPrice: 165,
    previousPrice: 160,
    changePercent: 3.13,
    trend: "up",
    demand: "MODERATE",
    history7Days: [
      { day: "Day 1", price: 155 },
      { day: "Day 2", price: 157 },
      { day: "Day 3", price: 158 },
      { day: "Day 4", price: 160 },
      { day: "Day 5", price: 161 },
      { day: "Day 6", price: 163 },
      { day: "Day 7", price: 165 }
    ],
    advice: "AC compressors with copper coil yield high copper extraction value. Drain refrigerant first.",
    adviceHi: "तांबे की कॉइल वाले एसी कंप्रेसर सबसे अच्छे। पहले गैस निकालें।",
    adviceMr: "तांब्याच्या कॉइलसह एसी कंप्रेसर सर्वोत्तम. आधी गॅस काढा."
  }
];

export function getPriceByMaterial(material: Material): BazarPriceItem | undefined {
  return BAZAR_PRICES.find((item) => item.material === material);
}

export function getAllBazarPrices(): BazarPriceItem[] {
  return BAZAR_PRICES;
}
