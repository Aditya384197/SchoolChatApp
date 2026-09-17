import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'schoolchatapp-2cc47.firebaseapp.com',
  databaseURL: 'https://schoolchatapp-2cc47-default-rtdb.firebaseio.com',
  projectId: 'schoolchatapp-2cc47',
  storageBucket: 'schoolchatapp-2cc47.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// IMPORTANT: this file must never throw at import time. If it does, the
// whole app fails before React even mounts and the WebView just shows a
// permanent blank/white screen with no error visible anywhere -- that is
// exactly what happens if VITE_FIREBASE_API_KEY / _MESSAGING_SENDER_ID /
// _APP_ID were never set as GitHub Actions secrets (see FIREBASE_SETUP.md
// section 3): the build still "succeeds", but the .env values baked into
// the bundle are empty strings, and Firebase's SDK throws on init.
// So: catch everything here and let App.jsx show a real, readable message.
export let auth = null;
export let db = null;
export let firebaseInitError = null;

const missing = Object.entries({
  apiKey: firebaseConfig.apiKey,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  firebaseInitError =
    `Firebase config खाली है: ${missing.join(', ')}। GitHub repo -> Settings -> ` +
    `Secrets and variables -> Actions में FIREBASE_API_KEY, FIREBASE_MESSAGING_SENDER_ID, ` +
    `FIREBASE_APP_ID जोड़ें (FIREBASE_SETUP.md देखें), फिर दोबारा बिल्ड चलाएं।`;
} else {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
  } catch (e) {
    firebaseInitError = 'Firebase शुरू नहीं हो पाया: ' + (e?.message || String(e));
  }
}
