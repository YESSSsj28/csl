// extra-services.js — Moderation, polls, leaderboards, scheduled messages, search
// Dependencies: Firebase `db`, `currentUser`, Together.ai wrapper from app.js for smart actions

/* =====================
   Moderation (AI-powered)
   - Uses Together AI to classify messages for toxicity/spam
   - Flags messages and optionally auto-moderates (delete/hide)
   ===================== */

async function moderateMessage(chatId, messageId, text) {
  // Lightweight classification prompt
  try {
    const prompt = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Classify messages as SAFE, SPAM, TOXIC, or NSFW. Respond with one word only.' },
        { role: 'user', content: text }
      ],
      max_tokens: 10,
      temperature: 0.0
    };
    const res = await togetherRequest('/v1/chat/completions', prompt);
    const label = (res.choices && res.choices[0] && (res.choices[0].message?.content || res.choices[0].text) || '').trim().toUpperCase();
    if (label && ['SPAM','TOXIC','NSFW'].includes(label)) {
      // flag in DB
      await db.ref(`moderation/${chatId}/${messageId}`).set({ label, ts: Date.now(), moderator: 'ai' });
      // optionally hide message
      await db.ref(`messages/${chatId}/${messageId}/hidden`).set(true);
    } else {
      // mark safe
      await db.ref(`moderation/${chatId}/${messageId}`).set({ label: 'SAFE', ts: Date.now(), moderator: 'ai' });
    }
    return label;
  } catch (e) {
    console.warn('Moderation failed', e);
    return 'ERROR';
  }
}

/* =====================
   Polls
   - Create polls in chats, vote, and display results
   ===================== */

async function createPoll(chatId, question, options, durationSec = 3600) {
  const pollRef = db.ref(`polls/${chatId}`).push();
  const pollId = pollRef.key;
  const now = Date.now();
  const poll = { question, options: options.map(o => ({ text: o, votes: 0 })), createdAt: now, expiresAt: now + durationSec*1000, creator: currentUser.username };
  await pollRef.set(poll);
  return pollId;
}

async function votePoll(chatId, pollId, optionIndex) {
  const voteRef = db.ref(`polls/${chatId}/${pollId}/options/${optionIndex}/votes`);
  const snap = await voteRef.once('value');
  const count = snap.val() || 0;
  await voteRef.set(count + 1);
}

function watchPolls(chatId, onUpdate) {
  db.ref(`polls/${chatId}`).on('value', snap => {
    const polls = snap.val() || {};
    onUpdate(polls);
  });
}

/* =====================
   Leaderboards & Coins
   - Award coins for activity and games
   ===================== */

async function awardCoins(username, amount, reason = '') {
  const ref = db.ref(`accounts/${username}/coins`);
  const snap = await ref.once('value');
  const current = snap.val() || 0;
  await ref.set(current + amount);
  await db.ref(`transactions/${username}`).push({ amount, reason, ts: Date.now() });
}

function watchLeaderboard(limit = 10, onUpdate) {
  db.ref('accounts').orderByChild('coins').limitToLast(limit).on('value', snap => {
    const data = snap.val() || {};
    const arr = Object.keys(data).map(k => ({ username: k, coins: data[k].coins || 0 })).sort((a,b)=>b.coins-a.coins);
    onUpdate(arr);
  });
}

/* =====================
   Scheduled Messages
   - Schedule messages to be sent later via `scheduledMessages/{id}`
   - A lightweight worker using client checks (or Cloud Function recommended)
   ===================== */

async function scheduleMessage(chatId, content, sendAtTs) {
  const ref = db.ref(`scheduledMessages/${chatId}`).push();
  await ref.set({ content, sendAt: sendAtTs, creator: currentUser.username, sent: false, createdAt: Date.now() });
  return ref.key;
}

// Client poller: runs every 30s to dispatch due messages (not reliable long-term)
setInterval(async () => {
  try {
    const now = Date.now();
    const snap = await db.ref('scheduledMessages').once('value');
    const chats = snap.val() || {};
    for (const chatId of Object.keys(chats)) {
      const msgs = chats[chatId] || {};
      for (const mid of Object.keys(msgs)) {
        const m = msgs[mid];
        if (!m.sent && m.sendAt <= now) {
          // send into messages tree
          const msgRef = db.ref(`messages/${chatId}`).push();
          await msgRef.set({ sender: m.creator, text: m.content, ts: Date.now() });
          await db.ref(`scheduledMessages/${chatId}/${mid}/sent`).set(true);
        }
      }
    }
  } catch (e) { /* ignore errors */ }
}, 30*1000);

/* =====================
   Message Search (client-side indexed)
   - Simple inverted index stored under `searchIndex/{chatId}/{word}` -> [msgId]
   - Index created when messages are added
   ===================== */

function indexMessage(chatId, messageId, text) {
  const words = (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const updates = {};
  words.forEach(w => {
    const path = `searchIndex/${chatId}/${w}/${messageId}`;
    updates[path] = true;
  });
  return db.ref().update(updates);
}

async function searchMessages(chatId, query) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return [];
  const results = {};
  for (const w of words) {
    const snap = await db.ref(`searchIndex/${chatId}/${w}`).once('value');
    const hits = snap.val() || {};
    Object.keys(hits).forEach(msgId => { results[msgId] = (results[msgId]||0)+1; });
  }
  // rank by score
  const ranked = Object.keys(results).sort((a,b)=>results[b]-results[a]);
  // fetch messages
  const msgs = await Promise.all(ranked.map(id => db.ref(`messages/${chatId}/${id}`).once('value')));
  return msgs.map(s=>({ id: s.key, ...s.val() }));
}

/* =====================
   Basic E2E Placeholder
   - This includes UI-key generation and storing encrypted payloads in DB
   - IMPORTANT: This is only a placeholder & not secure for production without proper key management
   ===================== */

async function generateChatKey(chatId) {
  // generate simple symmetric key (not secure)
  const key = crypto.getRandomValues(new Uint8Array(32));
  const keyB64 = btoa(String.fromCharCode.apply(null, key));
  await db.ref(`e2eKeys/${chatId}`).set({ key: keyB64, createdAt: Date.now() });
  return keyB64;
}

async function encryptForChat(chatId, plaintext) {
  const snap = await db.ref(`e2eKeys/${chatId}`).once('value');
  const keyB64 = snap.val() && snap.val().key;
  if (!keyB64) return plaintext; // fallback
  // very simple XOR cipher for demonstration only
  const key = atob(keyB64).split('').map(c=>c.charCodeAt(0));
  const data = plaintext.split('').map(c=>c.charCodeAt(0));
  const out = data.map((v,i)=>String.fromCharCode(v ^ key[i%key.length])).join('');
  return btoa(out);
}

async function decryptForChat(chatId, cipherB64) {
  const snap = await db.ref(`e2eKeys/${chatId}`).once('value');
  const keyB64 = snap.val() && snap.val().key;
  if (!keyB64) return cipherB64;
  const key = atob(keyB64).split('').map(c=>c.charCodeAt(0));
  const data = atob(cipherB64).split('').map(c=>c.charCodeAt(0));
  const out = data.map((v,i)=>String.fromCharCode(v ^ key[i%key.length])).join('');
  return out;
}

/* =====================
   Exports
   ===================== */
window.Moderation = { moderateMessage };
window.Polls = { createPoll, votePoll, watchPolls };
window.Leaderboard = { awardCoins, watchLeaderboard };
window.Scheduler = { scheduleMessage };
window.Search = { indexMessage, searchMessages };
window.E2E = { generateChatKey, encryptForChat, decryptForChat };

// End of extra-services.js
