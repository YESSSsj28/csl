// calls-and-presence.js — Calling features + presence tracking for Chayt
// This file integrates with Firebase Realtime Database (RTDB) for:
// - Voice/video calls via WebRTC signaling
// - Presence tracking (online/offline, last seen)
// - Typing indicators
// Depends on Firebase `db`, `currentUser` already set by main app

/* =====================
   Presence Tracking
   ===================== */
function initPresenceTracking() {
  if (!currentUser) return;

  const userStatusDatabaseRef = db.ref('/status/' + currentUser.username);
  const isOfflineForDatabase = {
    state: 'offline',
    last_changed: firebase.database.ServerValue.TIMESTAMP
  };

  const isOnlineForDatabase = {
    state: 'online',
    last_changed: firebase.database.ServerValue.TIMESTAMP
  };

  const connectedRef = db.ref('.info/connected');
  connectedRef.on('value', function(snapshot) {
    if (snapshot.val() === false) {
      return;
    }
    userStatusDatabaseRef.onDisconnect().set(isOfflineForDatabase).then(function() {
      userStatusDatabaseRef.set(isOnlineForDatabase);
    });
  });
}

/* =====================
   Typing Indicators
   ===================== */
function sendTypingIndicator(chatId) {
  if (!currentUser) return;
  db.ref(`typing/${chatId}/${currentUser.username}`).set(true);
  clearTimeout(window._typingTimeout);
  window._typingTimeout = setTimeout(() => {
    db.ref(`typing/${chatId}/${currentUser.username}`).remove();
  }, 3000);
}

function watchTypingIndicators(chatId) {
  db.ref(`typing/${chatId}`).on('value', snap => {
    const data = snap.val() || {};
    const typingUsers = Object.keys(data).filter(u => u !== currentUser.username);
    renderTypingIndicator(typingUsers);
  });
}

function renderTypingIndicator(users) {
  const indicator = document.getElementById('typing-indicator');
  if (!indicator) return;
  if (users.length > 0) {
    indicator.textContent = `${users.join(', ')} typing...`;
    indicator.style.display = 'block';
  } else {
    indicator.style.display = 'none';
  }
}

/* =====================
   WebRTC Calling — Signaling over Firebase
   ===================== */
const CallManager = (function() {
  let pc = null;
  let localStream = null;

  async function startCall(chatId, video = false) {
    pc = new RTCPeerConnection();
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const localVideo = document.getElementById('local-video') || document.createElement('video');
    localVideo.id = 'local-video';
    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.srcObject = localStream;
    document.body.appendChild(localVideo);

    pc.ontrack = event => {
      const remoteVideo = document.getElementById('remote-video') || document.createElement('video');
      remoteVideo.id = 'remote-video';
      remoteVideo.autoplay = true;
      remoteVideo.srcObject = event.streams[0];
      document.body.appendChild(remoteVideo);
    };

    pc.onicecandidate = event => {
      if (event.candidate) {
        db.ref(`calls/${chatId}/candidates`).push(event.candidate.toJSON());
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await db.ref(`calls/${chatId}/offer`).set(offer);

    db.ref(`calls/${chatId}/answer`).on('value', async snap => {
      const answer = snap.val();
      if (answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    db.ref(`calls/${chatId}/candidates`).on('child_added', async snap => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(snap.val()));
      } catch (e) {
        console.warn('Error adding ICE candidate', e);
      }
    });
  }

  async function answerCall(chatId) {
    pc = new RTCPeerConnection();
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const localVideo = document.getElementById('local-video') || document.createElement('video');
    localVideo.id = 'local-video';
    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.srcObject = localStream;
    document.body.appendChild(localVideo);

    pc.ontrack = event => {
      const remoteVideo = document.getElementById('remote-video') || document.createElement('video');
      remoteVideo.id = 'remote-video';
      remoteVideo.autoplay = true;
      remoteVideo.srcObject = event.streams[0];
      document.body.appendChild(remoteVideo);
    };

    pc.onicecandidate = event => {
      if (event.candidate) {
        db.ref(`calls/${chatId}/candidates`).push(event.candidate.toJSON());
      }
    };

    const offerSnap = await db.ref(`calls/${chatId}/offer`).once('value');
    const offer = offerSnap.val();
    if (offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await db.ref(`calls/${chatId}/answer`).set(answer);
    }

    db.ref(`calls/${chatId}/candidates`).on('child_added', async snap => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(snap.val()));
      } catch (e) {
        console.warn('Error adding ICE candidate', e);
      }
    });
  }

  function endCall(chatId) {
    if (pc) {
      pc.close();
      pc = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    db.ref(`calls/${chatId}`).remove();
    const vids = document.querySelectorAll('#local-video, #remote-video');
    vids.forEach(v => v.remove());
  }

  return { startCall, answerCall, endCall };
})();

/* =====================
   Init
   ===================== */
function runCallsAndPresenceInit() {
  if (typeof db === 'undefined' || !document.body) {
    setTimeout(runCallsAndPresenceInit, 200);
    return;
  }
  initPresenceTracking();
}
runCallsAndPresenceInit();

// Expose globally
window.CallManager = CallManager;
window.sendTypingIndicator = sendTypingIndicator;
window.watchTypingIndicators = watchTypingIndicators;
