# School Chat

React + Firebase Realtime Database + Capacitor Android.

## शामिल सुविधाएँ

- ईमेल/पासवर्ड खाता और Invite Code
- ऑनलाइन/ऑफलाइन स्थिति और Last Seen
- Typing indicator
- Delivered ✓✓ और Seen ✓✓
- Unread message count
- Android foreground local notifications
- Private Chat to Admin
- Admin द्वारा Invite Code बदलना
- Admin mirror में सभी रिकॉर्ड की गई chats
- Mobile-friendly UI
- Android 10+ के लिए GitHub Actions APK build

## महत्वपूर्ण सूचना

Realtime Database client से सीधे लिखे गए admin mirror को पूर्ण tamper-proof audit log नहीं माना जा सकता। बंद ऐप में वास्तविक push notification के लिए Firebase Cloud Messaging + trusted backend/Cloud Functions की जरूरत होगी। इस संस्करण में native local notifications तब दिखाई जाती हैं जब ऐप realtime listener चला रहा हो।

## Firebase setup

1. Firebase Authentication → Email/Password चालू करें।
2. Firebase Web App से `messagingSenderId` और `appId` लें।
3. Realtime Database में `database.rules.json` लागू करें।
4. `config/inviteCode` और `config/adminUid` सेट करें।
5. GitHub Actions Secrets में `FIREBASE_API_KEY`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` रखें।

## Build

```bash
npm ci
npm run build
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

GitHub Actions यही प्रक्रिया स्वतः चलाता है।
