// game-ui.js — Game lobby UI + in-chat game UIs for Chayt
// This file depends on `app.js` (GameEngine, Uno, Chess) and Firebase `db` already loaded.
// Responsibilities:
// - Render a games lobby / room browser UI
// - Create/join rooms for UNO and Chess
// - Provide minimal in-chat UIs for UNO and Chess
// - Hook up room state listeners to update UI in real-time

/* =====================
   DOM Elements
   ===================== */
const gamesPanelId = 'games-panel';
const gameModalId = 'game-modal';

function createGamesPanel() {
  if (document.getElementById(gamesPanelId)) return;
  const panel = document.createElement('div');
  panel.id = gamesPanelId;
  panel.style.cssText = 'position:fixed; right:20px; top:80px; width:360px; background:var(--bg-card); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.4); padding:12px; z-index:100;';
  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <h4 style="margin:0;">Play Games</h4>
      <button id="open-games-btn" title="Open games">🎮</button>
    </div>
    <div id="game-list" style="display:flex; flex-direction:column; gap:8px;"></div>
    <div style="margin-top:8px; display:flex; gap:8px;">
      <button id="create-uno-room">Create UNO Room</button>
      <button id="create-chess-room">Create Chess Room</button>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('create-uno-room').addEventListener('click', async () => {
    if (!currentUser) return alert('Login first');
    const roomId = await GameEngine.createRoom('uno');
    await Uno.startGame(roomId);
    await GameEngine.joinRoom(roomId, { username: currentUser.username });
    openGameModal(roomId, 'uno');
  });

  document.getElementById('create-chess-room').addEventListener('click', async () => {
    if (!currentUser) return alert('Login first');
    const roomId = await GameEngine.createRoom('chess');
    await Chess.startGame(roomId);
    await GameEngine.joinRoom(roomId, { username: currentUser.username });
    openGameModal(roomId, 'chess');
  });

  loadAvailableRooms();
}

/* =====================
   Room Browser
   ===================== */
async function loadAvailableRooms() {
  const gameList = document.getElementById('game-list');
  gameList.innerHTML = 'Loading rooms...';

  db.ref('gameRooms').on('value', snap => {
    const rooms = snap.val() || {};
    gameList.innerHTML = '';
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      const el = document.createElement('div');
      el.style.cssText = 'padding:8px; border-radius:8px; background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center;';
      el.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center;">
          <div style="width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.03);">${room.type.toUpperCase()}</div>
          <div>
            <div style="font-weight:700">${room.type.charAt(0).toUpperCase()+room.type.slice(1)} Room</div>
            <div style="font-size:12px; color:var(--text-secondary)">${Object.keys(room.players||{}).length} players</div>
          </div>
        </div>
        <div>
          <button data-room="${roomId}" class="join-room-btn">Join</button>
        </div>
      `;
      gameList.appendChild(el);
    });

    document.querySelectorAll('.join-room-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = e.target.dataset.room;
        const roomSnap = await db.ref(`gameRooms/${roomId}`).once('value');
        const room = roomSnap.val();
        if (!room) return alert('Room not found');
        await GameEngine.joinRoom(roomId, { username: currentUser.username });
        openGameModal(roomId, room.type);
      });
    });
  });
}

/* =====================
   Game Modal + UI
   ===================== */
function openGameModal(roomId, type) {
  // create single modal if not exists
  let modal = document.getElementById(gameModalId);
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = gameModalId;
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:900px; width:95%;">
      <div class="modal-header">
        <h3 id="game-modal-title">${type.toUpperCase()} — Room: ${roomId}</h3>
        <button class="modal-close" id="close-game-modal">&times;</button>
      </div>
      <div id="game-body" style="display:flex; gap:12px;">
        <div id="game-left" style="flex:1;"></div>
        <div id="game-right" style="width:320px;">
          <div id="game-players" style="margin-bottom:12px;"></div>
          <div id="game-controls"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('close-game-modal').addEventListener('click', async () => {
    // leave room when closing
    await GameEngine.leaveRoom(roomId);
    modal.classList.remove('active');
    modal.remove();
  });

  // Render based on type
  if (type === 'uno') renderUnoUI(roomId);
  if (type === 'chess') renderChessUI(roomId);

  // Player list watcher
  db.ref(`gameRooms/${roomId}/players`).on('value', snap => {
    const players = snap.val() || {};
    const container = document.getElementById('game-players');
    container.innerHTML = '<h4>Players</h4>';
    Object.keys(players).forEach(p => {
      const el = document.createElement('div');
      el.textContent = p;
      container.appendChild(el);
    });
  });
}

/* =====================
   UNO UI
   ===================== */
function renderUnoUI(roomId) {
  const left = document.getElementById('game-left');
  left.innerHTML = '<div id="uno-board" style="min-height:360px; display:flex; flex-direction:column; gap:8px;"></div>';
  const board = document.getElementById('uno-board');

  // Listen for state updates
  db.ref(`gameRooms/${roomId}/state`).on('value', snap => {
    const state = snap.val() || {};
    board.innerHTML = '';

    // Pile
    const pileDiv = document.createElement('div');
    pileDiv.innerHTML = `<div style="font-size:12px; color:var(--text-secondary)">Pile</div>`;
    const top = (state.pile||[]).slice(-1)[0];
    pileDiv.appendChild(renderUnoCard(top));
    board.appendChild(pileDiv);

    // Players & hands (in a simple list view)
    const playersDiv = document.createElement('div');
    playersDiv.innerHTML = '<div style="font-size:12px; color:var(--text-secondary)">Hands</div>';
    Object.keys(state.players || {}).forEach(username => {
      const hand = state.players[username].hand || [];
      const pEl = document.createElement('div');
      pEl.style.cssText = 'padding:6px; margin-top:6px; border-radius:8px; background:rgba(255,255,255,0.02);';
      pEl.innerHTML = `<strong>${username}</strong> — ${hand.length} cards`;
      if (username === currentUser.username) {
        // show player's cards with click handlers
        const cardsRow = document.createElement('div');
        cardsRow.style.display = 'flex';
        cardsRow.style.gap = '6px';
        hand.forEach((c, idx) => {
          const cardEl = renderUnoCard(c);
          cardEl.style.cursor = 'pointer';
          cardEl.addEventListener('click', async () => {
            // Attempt to play
            try {
              await Uno.playCard(roomId, currentUser.username, c);
            } catch (e) { console.warn(e); }
          });
          cardsRow.appendChild(cardEl);
        });
        pEl.appendChild(cardsRow);
      }
      playersDiv.appendChild(pEl);
    });
    board.appendChild(playersDiv);
  });
}

function renderUnoCard(card) {
  const el = document.createElement('div');
  el.style.cssText = 'min-width:64px; min-height:90px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; padding:8px;';
  if (!card) { el.textContent = 'Empty'; el.style.background = 'rgba(255,255,255,0.03)'; return el; }
  if (card.type === 'number') {
    el.textContent = card.value;
    el.style.background = card.color || 'gray';
    el.style.color = '#fff';
  } else {
    el.textContent = card.type.toUpperCase();
    el.style.background = card.color || '#333';
    el.style.color = '#fff';
  }
  return el;
}

/* =====================
   Chess UI
   ===================== */
function renderChessUI(roomId) {
  const left = document.getElementById('game-left');
  left.innerHTML = `<div id="chess-board" style="width:560px; height:560px; display:grid; grid-template-columns:repeat(8,1fr); grid-auto-rows:1fr; border-radius:12px; overflow:hidden;"></div>`;
  const boardEl = document.getElementById('chess-board');

  // fetch initial state and watch
  db.ref(`gameRooms/${roomId}/state`).on('value', snap => {
    const state = snap.val() || {};
    const board = state.board || Chess.initialBoard?.() || [];
    boardEl.innerHTML = '';
    for (let r=0;r<8;r++) {
      for (let c=0;c<8;c++) {
        const square = document.createElement('div');
        const isLight = (r+c)%2===0;
        square.style.cssText = `display:flex; align-items:center; justify-content:center; font-size:22px; border:1px solid rgba(255,255,255,0.02); background:${isLight?'#f9fafb':'#111827'}; color:${isLight?'#111827':'#f9fafb'};`;
        const piece = board[r] ? board[r][c] : '';
        square.textContent = piece || '';
        square.dataset.r = r; square.dataset.c = c;
        square.addEventListener('click', () => onChessSquareClick(roomId, r, c));
        boardEl.appendChild(square);
      }
    }
  });

  // simple click-to-move handler state
  window._chessSelected = null;
  window.onChessSquareClick = function(roomId, r, c) {
    const sel = window._chessSelected;
    if (!sel) {
      window._chessSelected = [r,c];
      highlightChessSquare(r,c,true);
      return;
    }
    // attempt move
    const from = sel; const to = [r,c];
    Chess.applyMove(roomId, from, to).catch(e => console.warn(e));
    highlightChessSquare(sel[0], sel[1], false);
    window._chessSelected = null;
  };
}

function highlightChessSquare(r,c,on) {
  const boardEl = document.getElementById('chess-board');
  if (!boardEl) return;
  const idx = r*8 + c;
  const sq = boardEl.children[idx];
  if (sq) {
    if (on) sq.style.outline = '3px solid rgba(99,102,241,0.8)'; else sq.style.outline='none';
  }
}

/* =====================
   Boot
   ===================== */
function initGamesUI() {
  createGamesPanel();
}

// Wait until firebase and app ready
function runGamesUIWhenReady() {
  if (typeof db === 'undefined' || !document.body || typeof GameEngine === 'undefined') {
    setTimeout(runGamesUIWhenReady, 200);
    return;
  }
  initGamesUI();
}
runGamesUIWhenReady();

// Expose for debugging
window.GameUI = { openGameModal, createGamesPanel, loadAvailableRooms };

// End of game-ui.js
