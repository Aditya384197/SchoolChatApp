# Firebase Setup — School Chat

## 1. Authentication
Firebase Console → Authentication → Sign-in method → Email/Password → Enable.

## 2. Realtime Database
Database → Rules में `database.rules.json` की सामग्री लागू करें (यह fix के बाद अपडेट हो चुकी है)।

पहले इस्तेमाल से पहले Data में कम से कम यह रखें (सिर्फ `inviteCode` और `adminCode` — `adminUid` जान-बूझकर खाली छोड़ें):

```json
{
  "config": {
    "inviteCode": "JOIN-7K4P9M",
    "adminCode": "ADMIN-9X2Q7L"
  }
}
```

अब `adminUid` को मैन्युअल सेट करने की ज़रूरत नहीं है: जो भी व्यक्ति रजिस्टर करते समय सही `adminCode` डालेगा, ऐप अपने-आप `config/adminUid` में उसका UID क्लेम कर लेगा — और चूँकि यह field सिर्फ एक बार लिखी जा सकती है (rules में `!data.exists()`), पहला सही-कोड-वाला व्यक्ति ही हमेशा के लिए एकमात्र एडमिन बन जाता है; उसके बाद कोई और व्यक्ति वही कोड डाले तब भी एडमिन नहीं बन सकता।

अगर फिर भी मैन्युअली किसी को एडमिन बनाना हो (जैसे adminCode भूल जाने पर), तब भी कंसोल से सीधे `config/adminUid` में उसका UID डाला जा सकता है — पर सामान्य इस्तेमाल में यह ज़रूरी नहीं।

## 3. Firebase Web configuration — यह सबसे ज़रूरी स्टेप है
**अगर यह स्टेप छूट गया, तो APK इंस्टॉल तो हो जाएगा पर खोलते ही खाली/सफ़ेद स्क्रीन दिखाएगा (ऐप "खुलेगा नहीं")।**

1. Firebase console → ⚙️ Project settings → General → नीचे "Your apps" में अपना Web app खोलें (न हो तो "</> Add app" से एक Web app बना लें)।
2. वहाँ मिलने वाले `firebaseConfig` में से तीन वैल्यू कॉपी करें: `apiKey`, `messagingSenderId`, `appId`।
3. GitHub पर अपनी repo → **Settings → Secrets and variables → Actions → New repository secret** — तीन secrets बनाएं (नाम बिल्कुल यही रखें):
   - `FIREBASE_API_KEY`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
4. अब वर्कफ़्लो को फिर से चलाएं। यह fix के बाद अब एक "Check Firebase secrets are set" स्टेप है जो इनमें से कोई भी खाली होने पर बिल्ड को तुरंत साफ़ एरर के साथ रोक देगा — इससे पहले जैसा "बिल्ड तो पास पर ऐप नहीं खुलता" वाला चुपचाप-टूटना अब नहीं होगा।

## 4. Android notifications
Capacitor Local Notifications plugin Android पर permission संभालता है। Android 13+ पर notification permission माँगी जाती है।

ध्यान दें: यह local notification है। ऐप पूरी तरह बंद होने पर RTDB संदेश सुनने वाला JavaScript नहीं चलता। वास्तविक background push के लिए FCM + trusted server/Cloud Function जोड़ना होगा।

## 5. Admin monitoring — disclosed, by design
हर यूजर की और दो यूजर्स की आपस की चैट भी `adminMirror` में कॉपी होकर एडमिन को दिखती है — यह जान-बूझकर बनाया गया फीचर है, इसलिए रजिस्ट्रेशन स्क्रीन और Settings दोनों जगह इसका साफ़ डिस्क्लोज़र (खुलासा) दिखाया गया है। इसे छुपाया नहीं जाना चाहिए।

## 6. जानी हुई सीमाएँ
- फ़ोन कॉन्टैक्ट मैचिंग (`getPhoneContacts`) ब्राउज़र के Contact Picker API (`navigator.contacts`) पर निर्भर है, जो सामान्य Capacitor Android WebView में उपलब्ध नहीं होता — असली APK में यह फ़ीचर चुपचाप खाली लिस्ट लौटाएगा। असल APK में काम करने के लिए `@capacitor-community/contacts` जैसा नेटिव प्लगइन जोड़ना होगा।
- सुरक्षा नियम पूरी तरह क्लाइंट-साइड जाँच पर भरोसा करते हैं (कोई Cloud Function नहीं) — दोस्तों के छोटे, भरोसेमंद ग्रुप के लिए ठीक है, पर एक तकनीकी यूजर rules को पढ़कर समझ सकता है कि `adminCode` किसी भी लॉग-इन यूज़र को दिख जाता है।
