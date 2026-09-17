import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref, set } from 'firebase/database';
import {
  ArrowLeft, Bell, MessageCircle, Phone, Search, Send,
  ShieldCheck, Timer, Users, Wifi, X
} from 'lucide-react';
import { auth, db, firebaseInitError } from './firebase';
import { login, logout, register } from './lib/auth';
import {
  chatIdFor, clearUnread, listenMessages, markDelivered, markSeen, sendMessage
} from './lib/chat';
import { getPhoneContacts } from './lib/contacts';
import { listenTyping, setTyping, startPresence } from './lib/presence';
import { prepareNotifications, showMessageNotification } from './lib/notifications';

function generateCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

function formatLastSeen(ts) {
  if (!ts) return 'अंतिम बार उपलब्ध नहीं';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return 'अंतिम बार उपलब्ध नहीं';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'अभी-अभी ऑनलाइन था';
  return `अंतिम बार ${date.toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })}`;
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('अपना वास्तविक नाम भरें।');
        await register(email, password, name, phone, invite, adminCode);
      } else {
        await login(email, password);
      }
    } catch (e) {
      setError(e.message || 'प्रक्रिया पूरी नहीं हुई।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="card auth-card">
        <img className="brand-image" src="/school-chat-icon.png" alt="School Chat" />
        <h1>School Chat</h1>
        <p className="muted">अपने समूह से जुड़े रहें</p>
        {mode === 'register' && (
          <p className="disclosure">
            यह ऐप एडमिन-मॉनिटर्ड है: इस ऐप में होने वाली सभी चैट — आपकी एडमिन से बातचीत और आपस में दो दोस्तों की चैट भी — एडमिन को दिखती हैं। खाता बनाकर आप इससे सहमत हैं।
          </p>
        )}
        <form onSubmit={submit}>
          {mode === 'register' && <>
            <label>वास्तविक नाम<input value={name} onChange={e => setName(e.target.value)} required /></label>
            <label>मोबाइल नंबर <span className="optional">(वैकल्पिक)</span><input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" /></label>
            <label>जोड़ने वाला यूनिक कोड<input value={invite} onChange={e => setInvite(e.target.value)} required /></label>
            <label>एडमिन कोड <span className="optional">(केवल पहली बार एडमिन बनाने के लिए)</span><input value={adminCode} onChange={e => setAdminCode(e.target.value)} /></label>
          </>}
          <label>ईमेल<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>पासवर्ड<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength="6" required /></label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>{busy ? 'कृपया प्रतीक्षा करें…' : mode === 'register' ? 'खाता बनाएँ' : 'प्रवेश करें'}</button>
        </form>
        <button className="link" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
          {mode === 'register' ? 'पहले से खाता है? प्रवेश करें' : 'नया खाता बनाएँ'}
        </button>
      </section>
    </main>
  );
}

function MessageBubble({ me, message, onSeen }) {
  const mine = message.senderId === me.uid;
  return (
    <div className={`bubble ${mine ? 'mine' : 'theirs'}`} onClick={() => !mine && onSeen(message.id)}>
      <div>{message.text}</div>
      <div className="message-meta">
        <span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }) : '…'}</span>
        {mine && <span className={`ticks ${message.seen ? 'seen' : ''}`}>{message.delivered ? '✓✓' : '✓'}</span>}
      </div>
    </div>
  );
}

function Chat({ me, user, onBack }) {
  const chatId = chatIdFor(me.uid, user.uid);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const typingTimer = useRef(null);
  const typingActive = useRef(false);

  useEffect(() => listenMessages(chatId, setMessages), [chatId]);
  useEffect(() => listenTyping(chatId, setTypingUsers), [chatId]);
  useEffect(() => {
    let active = true;
    messages.forEach(m => {
      if (m.receiverId === me.uid && !m.delivered) markDelivered(chatId, m.id).catch(() => {});
    });
    const incoming = messages.filter(m => m.receiverId === me.uid);
    const latest = incoming[incoming.length - 1];
    if (active && latest && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    return () => { active = false; };
  }, [messages, me.uid, chatId]);

  useEffect(() => {
    clearUnread(me.uid, chatId).catch(() => {});
    messages.filter(m => m.receiverId === me.uid && !m.seen).forEach(m => markSeen(chatId, m.id).catch(() => {}));
  }, [chatId, me.uid, messages.length]);

  async function handleTyping(value) {
    setText(value);
    clearTimeout(typingTimer.current);
    if (value && !typingActive.current) {
      typingActive.current = true;
      await setTyping(chatId, me.uid, true).catch(() => {});
    }
    if (!value && typingActive.current) {
      typingActive.current = false;
      await setTyping(chatId, me.uid, false).catch(() => {});
      return;
    }
    if (value) {
      typingTimer.current = setTimeout(() => {
        typingActive.current = false;
        setTyping(chatId, me.uid, false).catch(() => {});
      }, 1400);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText('');
    clearTimeout(typingTimer.current);
    typingActive.current = false;
    await setTyping(chatId, me.uid, false).catch(() => {});
    try {
      await sendMessage(chatId, me.uid, user.uid, value);
    } finally {
      setSending(false);
    }
  }

  const otherTyping = Boolean(typingUsers[user.uid]);
  return (
    <div className="screen chat-screen">
      <header className="topbar">
        <button className="icon" onClick={onBack}><ArrowLeft /></button>
        <div className="chat-title">
          <b>{user.name}</b>
          <small>{user.online ? 'ऑनलाइन' : formatLastSeen(user.lastSeen)}</small>
          {otherTyping && <span className="typing-label">टाइप कर रहा है…</span>}
        </div>
        <div className="online-dot" title={user.online ? 'ऑनलाइन' : 'ऑफलाइन'} />
      </header>
      <div className="messages" ref={listRef}>
        {messages.map(m => <MessageBubble key={m.id} me={me} message={m} onSeen={id => markSeen(chatId, id).catch(() => {})} />)}
        {otherTyping && <div className="typing-bubble"><span></span><span></span><span></span></div>}
      </div>
      <form className="composer" onSubmit={submit}>
        <input value={text} onChange={e => handleTyping(e.target.value)} placeholder="संदेश लिखें…" />
        <button className="send" disabled={sending}><Send size={20} /></button>
      </form>
    </div>
  );
}

function AppShell({ me, profile }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [chatUser, setChatUser] = useState(null);
  const [settings, setSettings] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [unread, setUnread] = useState({});
  const [notificationsReady, setNotificationsReady] = useState(false);

  useEffect(() => onValue(ref(db, 'users'), s => {
    const all = s.val() || {};
    setUsers(Object.entries(all).map(([uid, u]) => ({ uid, ...u })).filter(u => u.uid !== me.uid));
  }), [me.uid]);

  useEffect(() => onValue(ref(db, `users/${me.uid}/unread`), s => setUnread(s.val() || {})), [me.uid]);
  useEffect(() => {
    startPresence(me.uid);
    prepareNotifications().then(setNotificationsReady);
  }, [me.uid]);

  // Foreground notification for incoming messages. Full closed-app push notifications require FCM/backend.
  useEffect(() => {
    const stops = users.map(user => {
      const chatId = chatIdFor(me.uid, user.uid);
      let first = true;
      return onValue(ref(db, `chats/${chatId}/messages`), snap => {
        if (first) { first = false; return; }
        const data = snap.val() || {};
        const list = Object.entries(data).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const latest = list[list.length - 1];
        if (latest?.receiverId === me.uid && !latest.seen && notificationsReady && chatUser?.uid !== user.uid) {
          showMessageNotification({ title: user.name, body: latest.text, id: Number(Date.now() % 2147483647) });
        }
      });
    });
    return () => stops.forEach(stop => stop && stop());
  }, [users, me.uid, notificationsReady, chatUser?.uid]);

  const filtered = useMemo(() => users
    .filter(u =>
      (u.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(query.toLowerCase()) ||
      (u.phone || '').includes(query)
    )
    .sort((a, b) => Number(b.online) - Number(a.online) || (a.name || '').localeCompare(b.name || '')),
  [users, query]);

  const totalUnread = Object.values(unread).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const adminUser = users.find(u => u.role === 'admin');

  if (chatUser) return <Chat me={me} user={chatUser} onBack={() => setChatUser(null)} />;

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand-line">
          <img src="/school-chat-icon.png" alt="" />
          <div><b>School Chat</b><small>नमस्ते, {profile.name}</small></div>
        </div>
        <button className="icon notification-icon" onClick={() => setSettings(true)}>
          <Bell />{totalUnread > 0 && <span className="badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}
        </button>
      </header>
      <main className="content">
        <div className="search"><Search size={19} /><input placeholder="नाम, ईमेल या नंबर खोजें" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <div className="section-title"><h3>आपके संपर्क</h3><span><Wifi size={14} /> {users.filter(u => u.online).length} ऑनलाइन</span></div>
        {filtered.map(u => <button className="user-row" key={u.uid} onClick={() => setChatUser(u)}>
          <div className="avatar-wrap"><div className="avatar">{(u.name || '?').slice(0, 1).toUpperCase()}</div>{u.online && <span className="presence-dot" />}</div>
          <div className="grow"><b>{u.name}</b><small>{u.online ? 'ऑनलाइन' : formatLastSeen(u.lastSeen)}</small></div>
          {unread[chatIdFor(me.uid, u.uid)] > 0 && <span className="row-unread">{unread[chatIdFor(me.uid, u.uid)]}</span>}
          <MessageCircle size={20} />
        </button>)}
        {!filtered.length && <div className="empty"><Users size={38} /><p>कोई उपयोगकर्ता नहीं मिला।</p></div>}
      </main>
      {settings && <SettingsDrawer
        me={me} profile={profile} adminUser={adminUser} users={users} unread={unread}
        contacts={contacts} setContacts={setContacts} onClose={() => setSettings(false)} onOpenChat={setChatUser}
      />}
    </div>
  );
}

function SettingsDrawer({ me, profile, adminUser, users, unread, contacts, setContacts, onClose, onOpenChat }) {
  const [notificationState, setNotificationState] = useState('जाँच हो रही है…');
  useEffect(() => { prepareNotifications().then(ok => setNotificationState(ok ? 'चालू' : 'उपलब्ध नहीं')); }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-head"><b>सेटिंग</b><button className="icon" onClick={onClose}><X /></button></div>
        <div className="setting-user"><div className="avatar big">{profile.name.slice(0, 1).toUpperCase()}</div><b>{profile.name}</b><small>{profile.email}</small></div>
        <p className="disclosure small">यह ऐप एडमिन-मॉनिटर्ड है — सभी चैट एडमिन को दिख सकती हैं।</p>
        {adminUser && <button className="setting-row" onClick={() => { onOpenChat(adminUser); onClose(); }}><ShieldCheck /> Private Chat to Admin <span className="row-end">›</span></button>}
        <button className="setting-row" onClick={async () => setContacts(await getPhoneContacts())}><Phone /> फोन संपर्क मिलाएँ <span className="row-end">›</span></button>
        <div className="setting-row static"><Bell /> सूचनाएँ <span className="row-end status-text">{notificationState}</span></div>
        <div className="setting-row static"><Timer /> अनपढ़ संदेश <span className="row-end status-text">{Object.values(unread).reduce((s, v) => s + Number(v || 0), 0)}</span></div>
        {contacts.length > 0 && <div className="contact-note">{contacts.length} फोन संपर्क उपलब्ध हैं।</div>}
        {profile.role === 'admin' && <AdminPanel users={users} me={me} />}
        <button className="setting-row danger" onClick={logout}><X /> बाहर निकलें</button>
      </aside>
    </div>
  );
}

function AdminPanel({ users, me }) {
  const [invite, setInvite] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [mirrors, setMirrors] = useState({});

  useEffect(() => onValue(ref(db, 'config/inviteCode'), s => setInvite(s.val() || '')), []);
  useEffect(() => onValue(ref(db, 'config/adminCode'), s => setAdminCode(s.val() || '')), []);
  useEffect(() => onValue(ref(db, 'adminMirror'), s => setMirrors(s.val() || {})), []);
  useEffect(() => {
    if (!selectedChat) { setLogs([]); return undefined; }
    return onValue(ref(db, `adminMirror/${selectedChat}/messages`), s => {
      const d = s.val() || {};
      setLogs(Object.entries(d).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    });
  }, [selectedChat]);

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      await set(ref(db, 'config/inviteCode'), invite.trim());
      setMsg('नया जोड़ने वाला कोड सेव हो गया।');
    } catch (e) {
      setMsg(e.message || 'कोड सेव नहीं हुआ।');
    } finally {
      setSaving(false);
    }
  }

  async function regenerateInvite() {
    const code = generateCode('JOIN');
    setInvite(code);
    await set(ref(db, 'config/inviteCode'), code).catch(() => {});
    setMsg('नया जोड़ने वाला कोड बन गया।');
  }

  async function regenerateAdminCode() {
    // Note: this only changes the *code*. Since config/adminUid can only ever
    // be written once (see database.rules.json), regenerating this code does
    // NOT create a way for a second person to become admin — it's only
    // useful if you want to invalidate a leaked code before anyone has used
    // it to claim admin.
    const code = generateCode('ADMIN');
    setAdminCode(code);
    await set(ref(db, 'config/adminCode'), code).catch(() => {});
    setMsg('नया एडमिन कोड बन गया।');
  }

  const mirroredChats = Object.keys(mirrors).sort((a, b) => (mirrors[b]?.lastMessageAt || 0) - (mirrors[a]?.lastMessageAt || 0));

  return <div className="admin">
    <div className="admin-title"><ShieldCheck size={18} /><h3>एडमिन नियंत्रण</h3></div>
    <p>कुल उपयोगकर्ता: {users.length}</p>
    <label>जोड़ने वाला कोड (दोस्तों के लिए)<input value={invite} onChange={e => setInvite(e.target.value)} /></label>
    <div className="admin-actions">
      <button className="primary" onClick={save} disabled={saving}>{saving ? 'सेव हो रहा है…' : 'कोड सेव करें'}</button>
      <button className="secondary" onClick={regenerateInvite} disabled={saving}>नया बनाएं</button>
    </div>
    <label>एडमिन कोड<input value={adminCode} readOnly /></label>
    <div className="admin-actions">
      <button className="secondary" onClick={regenerateAdminCode} disabled={saving}>एडमिन कोड बदलें</button>
    </div>
    {msg && <small className="success-text">{msg}</small>}
    <h4>सभी रिकॉर्ड की गई चैट (मॉनिटरिंग)</h4>
    {mirroredChats.map(chatId => {
      const parts = chatId.split('_');
      const names = parts.map(uid => uid === me.uid ? 'आप' : users.find(u => u.uid === uid)?.name || 'उपयोगकर्ता');
      return <button className="monitor-row" key={chatId} onClick={() => setSelectedChat(chatId)}>
        <span className="avatar">{names.filter(Boolean).join(' ').slice(0, 1)}</span>
        <span className="grow"><b>{names.join(' ↔ ')}</b><small>{mirrors[chatId]?.lastMessage || 'कोई संदेश नहीं'}</small></span>
      </button>;
    })}
    {!mirroredChats.length && <small>अभी कोई चैट रिकॉर्ड नहीं हुई है।</small>}
    {selectedChat && <div className="monitor"><b>चयनित चैट</b>{logs.length ? logs.map(m => <div className="log" key={m.id}><b>{m.senderId === me.uid ? 'आप' : users.find(u => u.uid === m.senderId)?.name || 'उपयोगकर्ता'}</b>: {m.text}</div>) : <small>इस चैट में अभी कोई संदेश नहीं है।</small>}</div>}
  </div>;
}

export default function App() {
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) { setLoading(false); return undefined; }
    return onAuthStateChanged(auth, async user => {
      setMe(user);
      if (user) {
        onValue(ref(db, `users/${user.uid}`), s => setProfile(s.val()));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  if (firebaseInitError) {
    return (
      <div className="splash config-error">
        <img src="/school-chat-icon.png" alt="School Chat" />
        <span>Setup अधूरा है</span>
        <p>{firebaseInitError}</p>
      </div>
    );
  }
  if (loading) return <div className="splash"><img src="/school-chat-icon.png" alt="School Chat" /><span>School Chat</span></div>;
  if (!me || !profile) return <AuthScreen />;
  return <AppShell me={me} profile={profile} />;
}
