# School Chat — Cross Check Report

तैयार संस्करण: 1.1.0 (+ post-review fixes, 2026-09-17)

## नई जाँच में मिली और ठीक की गई समस्याएँ

1. **बिल्ड फेल (`0_build.txt` लॉग से)**: `Setup Android SDK` स्टेप में `Warning: Failed to find package 'tools'` — Google ने legacy `tools` पैकेज SDK रिपॉज़िटरी से हटा दिया है (सितंबर 2026), और `android-actions/setup-android@v3` डिफ़ॉल्ट रूप से वही माँगता है। **फिक्स**: उस स्टेप में `packages: 'platform-tools'` साफ़ तौर पर दे दिया — यही एकमात्र चीज़ है जो इस स्टेप से चाहिए, बाकी SDK platform/build-tools Gradle खुद डाउनलोड कर लेता है।
2. **रजिस्ट्रेशन पूरी तरह टूटा हुआ था**: `database.rules.json` में `config/adminUid` पर `.read:false` था, लेकिन `lib/auth.js` का `register()` बिना शर्त उसे पढ़ने की कोशिश करता था — यानी हर रजिस्ट्रेशन (एडमिन हो या सामान्य यूज़र) permission-denied एरर पर तुरंत फेल हो जाता। **फिक्स**: `config` पर सामान्य read खोल दिया।
3. **एडमिन कभी बन ही नहीं सकता था**: `register()` कभी `config/adminUid` नहीं लिखता था, जबकि पूरा rules-सिस्टम (users, chats, adminMirror का admin-read) उसी वैल्यू पर निर्भर था। इसका मतलब चाहे कोई सही एडमिन कोड डाल भी दे, वो कभी असल में एडमिन नहीं बनता। **फिक्स**: अब सही कोड डालने पर `config/adminUid` को transaction से क्लेम किया जाता है — और चूँकि यह सिर्फ एक बार लिखा जा सकता है, पहला सही-कोड-वाला व्यक्ति ही स्थायी रूप से इकलौता एडमिन बनता है (आगे कोई और उसी कोड से एडमिन नहीं बन सकता — बिना किसी अलग "lock" बटन के)।
4. **एडमिन-मॉनिटरिंग का खुलासा नदारद था**: रजिस्ट्रेशन स्क्रीन या कहीं भी यूज़र को यह नहीं बताया जाता था कि उनकी और दूसरे दोस्तों की आपस की चैट भी एडमिन देख सकता है। **फिक्स**: रजिस्ट्रेशन फ़ॉर्म के ऊपर और Settings ड्रॉअर में साफ़ डिस्क्लोज़र टेक्स्ट जोड़ दिया।
5. **एडमिन कोड कहीं से मैनेज नहीं होता था**: Admin Panel में सिर्फ invite code बदलने का विकल्प था। **फिक्स**: अब Admin Panel में एडमिन कोड भी दिखता है और उसे regenerate किया जा सकता है (ध्यान दें: यह सिर्फ़ कोड बदलता है, नए एडमिन बनने की सुविधा नहीं देता — वह हमेशा के लिए लॉक है)।
6. **किसी और role वाले व्यक्ति को मैसेज भेजना हमेशा फेल होता (सबसे गंभीर मिली समस्या)**: `users/$uid` का `.validate` हर बार (चाहे कोई भी लिखे) यह जाँचता था कि `role` वैल्यू लिखने वाले (`auth.uid`) के adminUid होने/न-होने से मेल खाए। इसका मतलब — जब कोई सामान्य यूज़र एडमिन को मैसेज भेजता (जिसमें `users/{adminUid}/unread/...` भी अपडेट होता है), तो एडमिन के रिकॉर्ड की जाँच लिखने वाले (सामान्य यूज़र) की पहचान से होती, जो मेल नहीं खाती — पूरा मैसेज-सेंड ऑपरेशन fail हो जाता। मतलब **"Private Chat to Admin" फीचर कभी काम ही नहीं करता।** **फिक्स**: role की जाँच अब सिर्फ तभी होती है जब व्यक्ति अपना ही रिकॉर्ड लिख रहा हो (`auth.uid === $uid`) — बाकी सबके लिए (जैसे unread-counter अपडेट) यह जाँच स्किप हो जाती है, जिससे किसी को भी (एडमिन सहित) मैसेज भेजना सही तरीके से काम करता है।
7. **Typing indicator पहली मैसेज से पहले काम नहीं करता था**: rule में `participants` मौजूद होने की शर्त थी, जो पहली चैट शुरू होने से पहले नहीं होती। **फिक्स**: typing write की शर्त हटाकर सिर्फ अपने uid पर लिखने तक सीमित कर दी।

## बचा हुआ known issue (जानबूझकर नहीं छेड़ा)
फ़ोन कॉन्टैक्ट मैचिंग (`getPhoneContacts`) असल APK में काम नहीं करेगी क्योंकि यह browser Contact Picker API पर निर्भर है, Capacitor WebView में यह उपलब्ध नहीं। ठीक करने के लिए `@capacitor-community/contacts` नेटिव प्लगइन जोड़ना होगा — अगर चाहें तो बता दें, वह अलग से जोड़ सकता हूं।

---

## राउंड 2 — "बिल्ड हो गया पर ऐप खुलता ही नहीं" (2026-09-17)

बिल्ड इस बार पास हो गया (राउंड 1 का SDK फिक्स काम कर गया), लेकिन इंस्टॉल के बाद ऐप ओपन ही नहीं हुआ और लॉन्चर आइकॉन भी गलत दिखा। कोई नया लॉग नहीं मिला था, इसलिए कोड से ही जड़ खोजनी पड़ी — दो असली बग मिले:

1. **ख़ाली Firebase secrets से चुपचाप ब्लैंक स्क्रीन**: `firebase.js` में `apiKey`/`messagingSenderId`/`appId` GitHub secrets से आते हैं (`FIREBASE_SETUP.md` सेक्शन 3 में हमेशा से लिखा था, पर लगता है ये secrets कभी GitHub repo में जोड़े ही नहीं गए)। जब ये खाली होते हैं, बिल्ड फिर भी सफलतापूर्वक पूरा हो जाता है — पर APK में Firebase का init module-load के वक्त ही क्रैश कर जाता है, यानी React कभी render ही नहीं कर पाता → स्क्रीन हमेशा के लिए खाली रहती है, कोई एरर कहीं नहीं दिखता। **फिक्स**:
   - `firebase.js` अब कभी crash नहीं करेगी — खाली/गलत config होने पर साफ़ हिंदी मैसेज के साथ एक असली स्क्रीन दिखाएगी, ब्लैंक स्क्रीन की जगह।
   - एक React Error Boundary (`ErrorBoundary.jsx`) जोड़ दिया है, ताकि आगे कभी भी कोई और रेंडर-एरर आए तो कम से कम स्क्रीन पर मैसेज दिखे (और वो मैसेज आगे किसी भी debugging के लिए मुझे भेजा जा सकता है)।
   - GitHub Actions में एक नया स्टेप जोड़ा है जो इन तीन secrets में से कोई खाली होने पर बिल्ड को वहीं रोक देगा, साफ़ बताते हुए कि क्या जोड़ना है — इससे "बिल्ड पास, ऐप फिर भी टूटा हुआ" वाली स्थिति दोबारा चुपचाप नहीं बनेगी।
   - **आपको अभी यह करना है**: repo → Settings → Secrets and variables → Actions में `FIREBASE_API_KEY`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` जोड़ें (पूरे स्टेप्स `FIREBASE_SETUP.md` सेक्शन 3 में हैं), फिर दोबारा बिल्ड चलाएं।
2. **लॉन्चर आइकॉन गलत दिखना**: वर्कफ़्लो सिर्फ़ फ्लैट `ic_launcher.png` फ़ाइलें बदलता था, लेकिन Android 8+ पर असल आइकॉन एक अलग "adaptive icon" XML (`mipmap-anydpi-v26/ic_launcher.xml`) से तय होता है जो Capacitor के डिफ़ॉल्ट प्लेसहोल्डर आइकॉन की तरफ़ इशारा करता रहता है — इसलिए हमारा असली आइकॉन कभी दिखता ही नहीं था। **फिक्स**: वो XML सिलेक्टर बिल्ड टाइम पर हटा दिया जाता है, ताकि Android सीधे हमारी असली PNG इस्तेमाल करे।
3. **सुरक्षा जाँच जोड़ी**: एक नया स्टेप web build के Android प्रोजेक्ट में सही से कॉपी होने की पुष्टि करता है — अगर भविष्य में यह टूटे तो बिल्ड साफ़ एरर के साथ रुकेगा, चुपचाप खराब APK नहीं बनेगा।

## शामिल और जाँचे गए हिस्से

- Last Seen / online presence: Firebase `.info/connected` + `onDisconnect`.
- Typing indicator: per-chat realtime `typing` node, idle timeout और disconnect cleanup.
- Delivered ✓✓: प्राप्तकर्ता message listener से delivered state अपडेट करता है.
- Seen ✓✓: चैट खुलने पर unread messages seen किए जाते हैं.
- Unread count: प्रति उपयोगकर्ता/चैट realtime counter.
- Notification: Capacitor Local Notifications की permission और foreground notification flow.
- Admin mirror: हर message के साथ realtime mirror.
- Admin panel: सभी उपलब्ध `adminMirror` chats सूचीबद्ध और पढ़ी जा सकती हैं.
- Last message metadata: chat path में lastMessage/lastMessageAt.
- App icon: School Chat का स्कूल + graduation-cap + chat-bubble प्रतीक, बिना text के.
- Android build workflow: `npm install` → Vite build → Capacitor Android sync → launcher icon → Gradle debug APK.

## स्वतः किए गए सत्यापन

- सभी JSON files parse की गईं.
- JavaScript utility modules को Node syntax checker से जाँचा गया.
- `src/App.jsx` को TypeScript parser के JSX mode में syntax-check किया गया.
- मुख्य feature symbols और Firebase rule paths की उपस्थिति जाँची गई.
- GitHub workflow में dependency installation, Capacitor sync, launcher icon और APK upload steps की जाँच की गई.

## एक सीमा

इस वातावरण में npm registry से dependencies डाउनलोड होकर पूरा `vite build` स्थानीय रूप से पूरा नहीं हो सका, इसलिए अंतिम APK build को GitHub Actions runner पर ही करना होगा। Workflow में `npm install --no-audit --no-fund` रखा गया है ताकि बिना committed lockfile के भी build pipeline चल सके.

## Notification सीमा

`@capacitor/local-notifications` device पर local notification दे सकता है; Android 13+ पर notification permission आवश्यक है. लेकिन ऐप पूरी तरह बंद होने पर Realtime Database listener नहीं चलता, इसलिए वास्तविक WhatsApp-जैसा background push notification अभी इसमें शामिल नहीं है. उसके लिए Firebase Cloud Messaging और trusted backend/Cloud Function चाहिए।
