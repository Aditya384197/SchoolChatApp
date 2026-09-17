import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile
} from 'firebase/auth';
import { ref, get, set, runTransaction } from 'firebase/database';
import { auth, db } from '../firebase';

export async function register(email, password, name, phone, inviteCode, adminCode) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });

  try {
    const snap = await get(ref(db, 'config/inviteCode'));
    const validInvite = snap.exists() && snap.val() === inviteCode;

    // Try to become the (single, permanent) admin: config/adminUid can only
    // ever be written once — first correct-code claim wins — so this also
    // doubles as the "lock admin entry after the first admin" behaviour.
    let role = 'user';
    if (adminCode) {
      const codeSnap = await get(ref(db, 'config/adminCode'));
      const codeMatches = codeSnap.exists() && codeSnap.val() === adminCode;
      if (codeMatches) {
        const result = await runTransaction(ref(db, 'config/adminUid'), (current) => {
          if (current !== null) return; // someone already claimed it — abort
          return cred.user.uid;
        });
        if (result.committed && result.snapshot.val() === cred.user.uid) {
          role = 'admin';
        }
      }
    }

    if (!validInvite && role !== 'admin') throw new Error('गलत जोड़ने वाला कोड।');
    await set(ref(db, `users/${cred.user.uid}`), {
      name: name.trim(),
      email: cred.user.email,
      phone: phone?.trim() || '',
      role,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      online: true
    });
    localStorage.setItem('schoolChatVerified', '1');
    return { ...cred, role };
  } catch (e) {
    await cred.user.delete().catch(() => {});
    throw e;
  }
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await set(ref(db, `users/${cred.user.uid}/lastSeen`), Date.now());
  await set(ref(db, `users/${cred.user.uid}/online`), true);
  localStorage.setItem('schoolChatVerified', '1');
  return cred;
}

export async function logout() {
  if (auth.currentUser) {
    await set(ref(db, `users/${auth.currentUser.uid}/online`), false);
  }
  localStorage.removeItem('schoolChatVerified');
  return signOut(auth);
}
