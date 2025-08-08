// app.js — Main client-side logic for Chayt
// Features in this file:
// - Together.ai integration for smart replies (smart-assistant)
// - Message processing hooks for smart-reply suggestions
// - Lightweight game framework stubs: UNO, Chess (client side multiplayer-ready hooks)
// - Call / RTC integration helpers (signaling placeholders)
// - Utilities: local drafts, typing indicators, reactions

/*
  IMPORTANT:
  - This file expects firebase to be already initialized (see index.html)
  - Together API key included per user request. Keep private for production.
*/

/* =====================
   Configuration
   ===================== */
const TOGETHER_API_KEY = 'e7456d10d09865a39f2c7aebf2540368cc74962f12195cb3f1383dce541ad3c9';
const TOGETHER_API_URL = 'https://api.together.ai'; // placeholder base

// Rate-limiting / debounce to avoid spamming the AI
const SMART_REPLY_DEBOUNCE_MS = 800; // after user stops typing
let smartReplyTimeout = null;

/* =====================
   Smart Assistant (Together) — simple wrapper
   - Provides `getSmartReply(prompt)` which returns suggested replies
   - Provides `summarizeMessages(messages)` helper
   ===================== */
async function togetherRequest(path, body = {}) {
  try {
    const res = await fetch(`${TOGETHER_API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOGETHER_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Together API error ${res.status}: ${txt}`);
    }

    return await res.json();
  } catch (err) {
    console.error('Together request failed', err);
    throw err;
  }
}

/**
 * Get smart reply suggestions for a chat context.
 * messages: [{role: 'user'|'assistant'|'system', content: '...'}]
 * returns: ["short reply 1","reply 2"]
 */
async function getSmartReplies(messages, maxReplies = 3) {
  // Build a short prompt specially tailored for quick smart replies
  const prompt = {
    model: 'gpt-4o-mini',
    messages: messages,
    max_tokens: 128,
    temperature: 0.6,
    n: maxReplies
  };

  // NOTE: the actual Together.ai endpoint and payload may differ.
  // This wrapper tries a generalized "chat completion" style request.
  try {
    const response = await togetherRequest('/v1/chat/completions', prompt);
    // Normalize output to array of strings
    if (response.choices && Array.isArray(response.choices)) {
      return response.choices.map(c => (c.message && c.message.content) || c.text || '').filter(Boolean);
    }

    // Fallback if API returns a single text
    if (response.text) return [response.text];
    return [];
  } catch (e) {
    console.warn('Smart replies failed', e);
    return [];
  }
}

/**
 * Summarize the last N messages to be used by the assistant
 */
async function summarizeMessages(messages, maxTokens = 200) {
  if (!messages || messages.length === 0) return '';
  const prompt = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Create a 2-3 sentence summary of the following conversation.' },
      ...messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
    ],
    max_tokens: maxTokens,
    temperature: 0.2
  };

  try {
    const res = await togetherRequest('/v1/chat/completions', prompt);
    const text = (res.choices && res.choices[0] && (res.choices[0].message?.content || res.choices[0].text)) || '';
    return text.trim();
  } catch (err) {
    console.warn('Summarize failed', err);
    return '';
  }
}

/* =====================
   UI: Smart Reply Hook
   - Attaches to the message input
   - Shows 2-3 suggested quick replies
   - Click a suggestion to insert into input or send
   ===================== */

// Create a small suggestion box under the input
function createSmartReplyBox() {
  const container = document.createElement('div');
  container.id = 'smart-reply-box';
  container.style.cssText = `
    position: absolute; bottom: 110px; left: 24px; right: 24px; display:flex; gap:8px; z-index:50; justify-content:flex-start; flex-wrap:wrap;
  `;
  document.body.appendChild(container);
  return container;
}

let smartReplyBox = null;
function ensureSmartReplyBox() {
  if (!smartReplyBox) smartReplyBox = createSmartReplyBox();
  smartReplyBox.innerHTML = '';
}

async function showSmartRepliesForChat(chatId) {
  if (!currentUser || !chatId) return;
  // gather last 10 messages from DOM or from a cache/db
  const messages = gatherLastMessagesForChat(chatId, 10);
  // Map to assistant format
  const formatted = messages.map(m => ({ role: m.sender === currentUser.username ? 'user' : 'assistant', content: m.text }));

  // debounce
  clearTimeout(smartReplyTimeout);
  smartReplyTimeout = setTimeout(async () => {
    ensureSmartReplyBox();
    smartReplyBox.textContent = 'Thinking...';
    try {
      const replies = await getSmartReplies(formatted, 3);
      renderSmartReplies(replies);
    } catch (e) {
      smartReplyBox.textContent = '';
    }
  }, SMART_REPLY_DEBOUNCE_MS);
}

function renderSmartReplies(replies) {
  ensureSmartReplyBox();
  if (!replies || replies.length === 0) {
    smartReplyBox.style.display = 'none';
    return;
  }
  smartReplyBox.style.display = 'flex';
  smartReplyBox.innerHTML = '';
  replies.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'smart-reply-btn';
    btn.textContent = r.length > 60 ? r.slice(0, 57) + '...' : r;
    btn.style.cssText = 'padding:8px 12px; border-radius:12px; border:none; background:var(--bg-card); color:var(--text-primary); cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,0.25);';
    btn.addEventListener('click', () => {
      // Insert into input
      messageInput.value = r;
      messageInput.focus();
    });
    btn.addEventListener('dblclick', () => {
      messageInput.value = r;
      sendText();
    });
    smartReplyBox.appendChild(btn);
  });
}

/* =====================
   Helpers: gather messages
   - Reads recent messages from the DOM as fallback
   ===================== */
function gatherLastMessagesForChat(chatId, limit = 10) {
  const out = [];
  // Try to get from a cached structure first
  if (window.chatMessageCache && window.chatMessageCache[chatId]) {
    const msgs = window.chatMessageCache[chatId];
    return msgs.slice(-limit);
  }

  // Fallback: read from DOM (#messages container)
  const msgNodes = Array.from(document.querySelectorAll('#messages .message'));
  for (let i = Math.max(0, msgNodes.length - limit); i < msgNodes.length; i++) {
    const node = msgNodes[i];
    const sender = node.dataset.sender || (node.classList.contains('sent') ? currentUser.username : 'them');
    const text = node.querySelector('.content') ? node.querySelector('.content').textContent : node.textContent;
    out.push({ sender, text });
  }
  return out;
}

/* ================
   Real-time Typing Hook
   - When the user types, we trigger showSmartRepliesForChat for current chat
   ================ */

function attachSmartReplyToInput() {
  if (!messageInput) return;
  messageInput.addEventListener('input', () => {
    if (!currentChat) return;
    // Show suggestions based on context
    showSmartRepliesForChat(getChatId(currentChat.id, currentChat.type));
  });
}

/* =====================
   Game Framework — client side stubs
   - The goal: provide a lightweight framework to build UNO / Chess clients
   - These are designed to use Firebase RTDB for state syncing (rooms), but are decoupled
   ===================== */

const GameEngine = {
  games: {},
  createRoom: async function(gameType, roomId, opts = {}) {
    // roomId optional — Firebase push if not provided
    roomId = roomId || `${gameType}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    // initial room state
    let initialState = { type: gameType, players: {}, state: {}, createdAt: Date.now(), host: currentUser.username };
    // Persist to Firebase
    await db.ref(`gameRooms/${roomId}`).set(initialState);
    return roomId;
  },
  joinRoom: async function(roomId, playerInfo) {
    const ref = db.ref(`gameRooms/${roomId}/players/${playerInfo.username}`);
    await ref.set({ username: playerInfo.username, joinedAt: Date.now(), ready: false });
    // Listen for state changes
    db.ref(`gameRooms/${roomId}/state`).on('value', snap => {
      const state = snap.val();
      GameEngine.onRoomState(roomId, state);
    });
    return true;
  },
  leaveRoom: async function(roomId) {
    await db.ref(`gameRooms/${roomId}/players/${currentUser.username}`).remove();
  },
  updateRoomState: async function(roomId, newState) {
    await db.ref(`gameRooms/${roomId}/state`).set(newState);
  },
  onRoomState: function(roomId, state) {
    // Hook: implementers should override
    console.log('Room state updated', roomId, state);
  }
};

/* =====================
   UNO — minimal client logic
   - Card model, basic actions
   - Turn-based engine operating on shared room state
   ===================== */

const Uno = (function() {
  function makeDeck() {
    const colors = ['red','green','blue','yellow'];
    const numbers = Array.from({length:10}, (_,i) => String(i));
    const deck = [];
    colors.forEach(c => {
      numbers.forEach(n => deck.push({ type: 'number', color: c, value: n }));
      // extra copies for 1-9
      numbers.slice(1).forEach(n => deck.push({ type: 'number', color: c, value: n }));
      // add simple special cards
      ['skip','reverse','draw2'].forEach(spec => deck.push({ type: spec, color: c }));
    });
    // adds wilds
    deck.push({ type: 'wild' }, { type: 'wild_draw4' }, { type: 'wild' }, { type: 'wild_draw4' });
    return shuffle(deck);
  }

  function shuffle(arr) {
    for (let i = arr.length -1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function startGame(roomId) {
    const deck = makeDeck();
    const initialState = {
      deck, pile: [], playersOrder: [], currentTurn: 0, direction: 1, createdAt: Date.now(), status: 'started'
    };
    await GameEngine.updateRoomState(roomId, initialState);
  }

  async function playCard(roomId, username, card) {
    // Basic validation and state update (simplified)
    const snapshot = await db.ref(`gameRooms/${roomId}/state`).once('value');
    const state = snapshot.val() || {};
    // TODO: validation rules
    // Apply card to pile and update turn
    state.pile = state.pile || [];
    state.pile.push(card);
    state.currentTurn = (state.currentTurn + state.direction + state.playersOrder.length) % state.playersOrder.length;
    await GameEngine.updateRoomState(roomId, state);
  }

  return { startGame, playCard, makeDeck };
})();

/* =====================
   Chess — minimal client logic
   - Uses simple FEN-like state stored in room.state.board (2D array)
   - Move validation is intentionally tiny here; replace with full engine later
   ===================== */

const Chess = (function() {
  function initialBoard() {
    // simplified initial board representation
    return [
      ['r','n','b','q','k','b','n','r'],
      ['p','p','p','p','p','p','p','p'],
      ['','','','','','','',''],
      ['','','','','','','',''],
      ['','','','','','','',''],
      ['','','','','','','',''],
      ['P','P','P','P','P','P','P','P'],
      ['R','N','B','Q','K','B','N','R']
    ];
  }

  async function startGame(roomId) {
    const state = { board: initialBoard(), turn: 'white', moves: [] };
    await GameEngine.updateRoomState(roomId, state);
  }

  async function applyMove(roomId, from, to, promotion) {
    const snap = await db.ref(`gameRooms/${roomId}/state`).once('value');
    const state = snap.val() || {};
    // minimal move application — no validation
    const board = state.board || initialBoard();
    const [fx,fy] = from; const [tx,ty] = to;
    const piece = board[fx][fy];
    board[fx][fy] = '';
    board[tx][ty] = piece;
    state.board = board;
    state.moves = state.moves || [];
    state.moves.push({ from, to, piece, promotion, ts: Date.now() });
    state.turn = state.turn === 'white' ? 'black' : 'white';
    await GameEngine.updateRoomState(roomId, state);
  }

  return { startGame, applyMove };
})();

/* =====================
   RTC / Calls — placeholders
   - For voice/video we need a signaling channel (Firebase RTDB used here for simplicity)
   - This code creates offer/answer flow and stores SDP/ICE in DB
   ===================== */

const RTC = (function() {
  let pc = null;

  async function createPeerConnection(roomId, isOffer = false) {
    pc = new RTCPeerConnection();
    // add audio/video tracks
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      // show local preview if desired
      const localPreview = document.createElement('video');
      localPreview.autoplay = true; localPreview.muted = true; localPreview.srcObject = localStream;
      document.body.appendChild(localPreview);
    } catch (err) {
      console.warn('Media not allowed or available', err);
    }

    pc.ontrack = (evt) => {
      // attach remote stream
      const remoteVideo = document.getElementById('remote-video') || document.createElement('video');
      remoteVideo.id = 'remote-video';
      remoteVideo.autoplay = true;
      remoteVideo.srcObject = evt.streams[0];
      document.body.appendChild(remoteVideo);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candRef = db.ref(`calls/${roomId}/candidates`).push();
        candRef.set(event.candidate.toJSON());
      }
    };

    // Signaling watchers
    db.ref(`calls/${roomId}/offer`).on('value', async snap => {
      const offer = snap.val();
      if (offer && !isOffer) {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await db.ref(`calls/${roomId}/answer`).set(answer);
      }
    });

    db.ref(`calls/${roomId}/answer`).on('value', async snap => {
      const answer = snap.val();
      if (answer && isOffer) {
        await pc.setRemoteDescription(answer);
      }
    });

    db.ref(`calls/${roomId}/candidates`).on('child_added', async snap => {
      const cand = snap.val();
      try { await pc.addIceCandidate(cand); } catch(e) { console.warn('ICE add failed', e); }
    });

    return pc;
  }

  async function startCall(roomId, makeOffer = true) {
    const pc = await createPeerConnection(roomId, makeOffer);
    if (makeOffer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await db.ref(`calls/${roomId}/offer`).set(offer);
    }
  }

  return { startCall };
})();

/* =====================
   Init wiring: attach UI hooks so the app uses smart replies and game stubs
   ===================== */

function wireUpAppFeatures() {
  attachSmartReplyToInput();
  // Expose GameEngine on window for debugging
  window.GameEngine = GameEngine;
  window.Uno = Uno;
  window.Chess = Chess;
  window.RTC = RTC;

  // When a chat opens, show suggestions
  const originalOpenChat = window.openChat || function(){};
  window.openChat = function(id, type) {
    originalOpenChat(id, type);
    try {
      showSmartRepliesForChat(getChatId(id, type));
    } catch(e) { /* ignore */ }
  };
}

// Run init when firebase & DOM ready
function runInitWhenReady() {
  if (typeof db === 'undefined' || !document.body) {
    setTimeout(runInitWhenReady, 200);
    return;
  }
  wireUpAppFeatures();
}
runInitWhenReady();

/* =====================
   Exports for bundlers / manual include
   ===================== */
if (typeof window !== 'undefined') {
  window.Together = { getSmartReplies, summarizeMessages };
}

// End of app.js
