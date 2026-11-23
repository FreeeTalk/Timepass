/**
 * Timepass Talk - Main Application Controller
 * Free4Talk Exact UI + WebSockets + WebRTC + Lingauro Superpowers
 */

// Global State
let socket = null;
let webrtc = null;
let currentFilters = {
  language: 'all',
  level: 'any',
  size: 'all',
  search: ''
};
let cachedRooms = [];
window.activeRoomData = null;

// Document Ready
document.addEventListener('DOMContentLoaded', async () => {
  initSocket();
  await initAuth();
  initWebRTC();
  initUIEvents();
  initLingauroFeatures();
  await loadRooms();
});

// 1. Socket.IO Connection
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    const user = API.getCurrentUserLocal();
    if (user) {
      socket.emit('register-user', { userId: user.id });
    }
  });

  socket.on('lobby-room-updated', ({ roomId, participantsCount }) => {
    loadRooms(); // Refresh room cards and speaker status
  });
}

// 2. Authentication Initialization
async function initAuth() {
  let user = API.getCurrentUserLocal();
  const token = API.getToken();

  if (token) {
    try {
      user = await API.getMe();
    } catch (e) {
      console.warn('Session expired, logging in as default talker:', e);
      user = null;
    }
  }

  // If no user, log in automatically as guest with 150 welcome tokens
  if (!user) {
    try {
      const guestRes = await API.guestLogin('Karthik (Guest)');
      user = guestRes.user;
    } catch (e) {
      console.warn('Guest login error:', e);
    }
  }

  renderHeaderUser(user);
}

function renderHeaderUser(user) {
  const container = document.getElementById('header-user-slot');
  if (!container) return;

  if (user) {
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="f4t-user-btn" id="btn-user-profile-toggle" title="Click to edit profile">
          <img src="${user.avatar}" class="f4t-user-avatar ${user.isVip ? 'vip' : ''}" />
          <span class="f4t-user-name">${user.name}</span>
          <span style="font-size:12px;">${user.nativeFlag || '🌐'}</span>
        </button>
        <button class="btn-cancel" id="btn-logout" style="padding:4px 8px; font-size:11px;" title="Switch user / Logout">Logout</button>
      </div>
    `;

    document.getElementById('btn-user-profile-toggle').onclick = () => {
      openProfileModal(user);
    };

    document.getElementById('btn-logout').onclick = () => {
      API.setToken(null);
      API.setCurrentUserLocal(null);
      window.location.reload();
    };
  } else {
    container.innerHTML = `<button class="f4t-btn-signin" id="btn-header-signin">Sign In</button>`;
    document.getElementById('btn-header-signin').onclick = () => {
      openAuthModal('login');
    };
  }

  TokensVIPManager.updateHeaderDisplay();
}

// 3. WebRTC Manager Setup
function initWebRTC() {
  webrtc = new WebRTCManager(socket);

  webrtc.onSpeakingChange = (userId, isSpeaking) => {
    updateStageSpeakerUI(userId, isSpeaking);
  };
}

// 4. UI Listeners (Filters, Modals, Tabs)
function initUIEvents() {
  // Brand logo click -> Lobby view
  const brandLogo = document.getElementById('brand-logo-link');
  if (brandLogo) {
    brandLogo.onclick = (e) => {
      e.preventDefault();
      if (window.activeRoomData) {
        // Minimize active room to dock when returning to lobby
        LingauroDock.show(window.activeRoomData, window.activeRoomData.participants || []);
        showLobbyView();
      } else {
        showLobbyView();
      }
    };
  }

  // Create room button in header
  const btnCreateRoom = document.getElementById('btn-create-room-header');
  const modalCreate = document.getElementById('modal-create-room');
  const btnCloseCreate = document.getElementById('btn-close-create-room');
  const btnCancelCreate = document.getElementById('btn-cancel-create-room');
  const btnSubmitCreate = document.getElementById('btn-submit-create-room');

  if (btnCreateRoom && modalCreate) {
    btnCreateRoom.onclick = () => {
      modalCreate.style.display = 'flex';
    };
  }

  const closeCreateModal = () => {
    if (modalCreate) modalCreate.style.display = 'none';
  };
  if (btnCloseCreate) btnCloseCreate.onclick = closeCreateModal;
  if (btnCancelCreate) btnCancelCreate.onclick = closeCreateModal;

  if (btnSubmitCreate) {
    btnSubmitCreate.onclick = async () => {
      const title = document.getElementById('new-room-title').value.trim();
      const langSelect = document.getElementById('new-room-lang');
      const language = langSelect.value;
      const flag = langSelect.options[langSelect.selectedIndex].getAttribute('data-flag') || '🌐';
      const level = document.getElementById('new-room-level').value;
      const capacity = document.getElementById('new-room-capacity').value;
      const isVipOnly = document.getElementById('new-room-vip').checked;

      if (!title) {
        showToast('Please enter a room topic / title', 'error');
        return;
      }

      try {
        const res = await API.createRoom({
          title,
          language,
          flag,
          level,
          maxParticipants: capacity,
          isVipOnly
        });
        showToast('Room created! Joining now...', 'success');
        closeCreateModal();
        joinRoom(res.room.id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // Language Quick Chips
  document.querySelectorAll('#lang-quick-filters .f4t-lang-tag').forEach(tag => {
    tag.onclick = () => {
      document.querySelectorAll('#lang-quick-filters .f4t-lang-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      currentFilters.language = tag.getAttribute('data-lang');
      loadRooms();
    };
  });

  // Group Size Filter Buttons
  document.querySelectorAll('.f4t-size-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.f4t-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilters.size = btn.getAttribute('data-size');
      loadRooms();
    };
  });

  // Level Dropdown
  const levelSelect = document.getElementById('filter-level-select');
  if (levelSelect) {
    levelSelect.onchange = () => {
      currentFilters.level = levelSelect.value;
      loadRooms();
    };
  }

  // Search Input
  const searchInput = document.getElementById('search-rooms-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.oninput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilters.search = searchInput.value.trim();
        loadRooms();
      }, 300);
    };
  }

  // In-Room Sidebar Tab Switcher
  document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tabId = btn.getAttribute('data-tab');
      if (!tabId) return;

      document.querySelectorAll('.sidebar-tabs .sidebar-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.remove('active'));
      const activeContent = document.getElementById(tabId);
      if (activeContent) activeContent.classList.add('active');
    };
  });

  // Stage Controls Bar buttons
  const btnMic = document.getElementById('btn-ctl-mic');
  if (btnMic) {
    btnMic.onclick = () => {
      const isMuted = webrtc.toggleMute();
      btnMic.querySelector('#ctl-mic-icon').textContent = isMuted ? '🔇' : '🎙️';
      btnMic.classList.toggle('active', !isMuted);
    };
  }

  const btnCam = document.getElementById('btn-ctl-camera');
  if (btnCam) {
    btnCam.onclick = async () => {
      const isVideo = await webrtc.toggleVideo();
      btnCam.classList.toggle('active', isVideo);
    };
  }

  const btnScreen = document.getElementById('btn-ctl-screen');
  if (btnScreen) {
    btnScreen.onclick = async () => {
      const isSharing = await webrtc.toggleScreenShare();
      btnScreen.classList.toggle('active', isSharing);
    };
  }

  const btnToggleGames = document.getElementById('btn-toggle-games-tab');
  if (btnToggleGames) {
    btnToggleGames.onclick = () => {
      document.querySelector('[data-tab="tab-games"]').click();
    };
  }

  const btnToggleWb = document.getElementById('btn-toggle-wb-tab');
  if (btnToggleWb) {
    btnToggleWb.onclick = () => {
      document.querySelector('[data-tab="tab-whiteboard"]').click();
    };
  }

  const btnLeaveStage = document.getElementById('btn-ctl-leave');
  const btnLeaveHeader = document.getElementById('btn-leave-room-header');
  const leaveHandler = () => {
    if (window.activeRoomData) {
      leaveActiveRoom();
    }
  };
  if (btnLeaveStage) btnLeaveStage.onclick = leaveHandler;
  if (btnLeaveHeader) btnLeaveHeader.onclick = leaveHandler;

  // Minimize to dock button in room header (Lingauro feature)
  const btnMinimize = document.getElementById('btn-minimize-to-dock');
  if (btnMinimize) {
    btnMinimize.onclick = () => {
      if (window.activeRoomData) {
        LingauroDock.show(window.activeRoomData, window.activeRoomData.participants || []);
        showLobbyView();
        showToast('Call minimized into floating dock. You can browse lobby & friends freely!', 'info');
      }
    };
  }

  // Room Chat input & image attachment
  const chatInput = document.getElementById('room-chat-input');
  const btnSendChat = document.getElementById('btn-send-room-chat');
  const imgInput = document.getElementById('chat-image-input');

  const sendRoomChatHandler = () => {
    const text = chatInput.value.trim();
    if (!text || !window.activeRoomData) return;
    chatInput.value = '';

    const me = API.getCurrentUserLocal();
    socket.emit('send-room-message', {
      roomId: window.activeRoomData.id,
      sender: me,
      text,
      imageUrl: null
    });
  };

  if (btnSendChat && chatInput) {
    btnSendChat.onclick = sendRoomChatHandler;
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter') sendRoomChatHandler();
    };
  }

  if (imgInput) {
    imgInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file || !window.activeRoomData) return;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          showToast('Uploading image to room...', 'info');
          const res = await API.uploadImage(reader.result, file.name);
          const me = API.getCurrentUserLocal();
          socket.emit('send-room-message', {
            roomId: window.activeRoomData.id,
            sender: me,
            text: '',
            imageUrl: res.url
          });
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
      reader.readAsDataURL(file);
    };
  }

  // Socket chat message receiver
  if (socket) {
    socket.on('new-room-message', ({ message }) => {
      appendRoomChatMessage(message);
    });

    socket.on('participant-audio-state', ({ userId, isMuted, isSpeaking }) => {
      updateStageSpeakerUI(userId, isSpeaking);
      // Also update lobby card avatar halos if present
      updateLobbyAvatarSpeaker(userId, isSpeaking);
    });
  }

  // Image zoom close on click
  const zoomOverlay = document.getElementById('modal-image-zoom');
  if (zoomOverlay) {
    zoomOverlay.onclick = () => {
      zoomOverlay.style.display = 'none';
    };
  }
}

// 5. Lingauro Superpower Modules Init
function initLingauroFeatures() {
  LingauroDock.init(
    webrtc,
    (room) => { // onExpand
      showRoomView(room);
    },
    (room) => { // onLeave
      leaveActiveRoom();
    }
  );

  FriendsManager.init(socket);
  TokensVIPManager.init(socket);
}

// 6. Lobby Room Cards Loader & Exact Free4Talk Slot Renderer
async function loadRooms() {
  try {
    const data = await API.getRooms(currentFilters);
    cachedRooms = data.rooms || [];

    // Update live counts in header
    const roomsCountEl = document.getElementById('header-rooms-count');
    const usersCountEl = document.getElementById('header-users-count');
    if (roomsCountEl) roomsCountEl.textContent = `${data.totalCount} Live Groups`;
    if (usersCountEl) usersCountEl.textContent = `${data.activeTalkers} Talkers Online`;

    renderRoomCards(cachedRooms);
  } catch (err) {
    console.error('Error loading rooms:', err);
  }
}

function renderRoomCards(rooms) {
  const grid = document.getElementById('rooms-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (rooms.length === 0) {
    grid.innerHTML = `
      <div class="f4t-empty-state" style="grid-column: 1 / -1;">
        <div class="f4t-empty-icon">🎙️</div>
        <div class="f4t-empty-title">No conversation groups match your filter</div>
        <div class="f4t-empty-desc">Be the first to create a room for this language or topic and start chatting!</div>
        <button class="btn-create-group" onclick="document.getElementById('btn-create-room-header').click()">
          + Create a new group
        </button>
      </div>
    `;
    return;
  }

  rooms.forEach(room => {
    const card = document.createElement('div');
    card.className = `f4t-card ${room.isVipOnly ? 'vip-card' : ''}`;
    card.setAttribute('data-room-id', room.id);

    const participants = room.participants || [];
    const maxCapacity = room.maxParticipants || 4;
    const isFull = participants.length >= maxCapacity;

    // Build the Member Slots Grid (Free4Talk's signature look!)
    let slotsHtml = '';
    for (let i = 0; i < maxCapacity; i++) {
      if (i < participants.length) {
        const p = participants[i];
        slotsHtml += `
          <div class="f4t-slot-occupied" data-user-id="${p.id}">
            <div class="f4t-avatar-wrapper ${p.isSpeaking ? 'speaking' : ''}">
              <img src="${p.avatar}" class="f4t-slot-avatar" alt="${escapeHtml(p.name)}" />
              <span class="f4t-mic-indicator ${p.isMuted ? 'muted' : 'live'}">
                ${p.isMuted ? '🔇' : '🎙️'}
              </span>
            </div>
            <span class="f4t-slot-name">${escapeHtml(p.name)}</span>
            <span class="f4t-slot-flag">${p.flag || '🌐'}</span>
          </div>
        `;
      } else {
        slotsHtml += `
          <div class="f4t-slot-empty">
            <div class="f4t-slot-empty-circle">+</div>
            <span class="f4t-slot-empty-text">Open</span>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <!-- Card Header -->
      <div class="f4t-card-header">
        <div class="f4t-card-header-left">
          <span class="f4t-card-flag">${room.flag || '🌐'}</span>
          <span class="f4t-card-lang">${escapeHtml(room.language)}</span>
          <span class="f4t-level-badge ${room.level || 'any'}">${room.level || 'any'} level</span>
          ${room.isVipOnly ? '<span class="f4t-vip-pill">👑 VIP</span>' : ''}
        </div>
      </div>

      <!-- Card Topic Title -->
      <div class="f4t-card-title">${escapeHtml(room.title)}</div>

      <!-- Member Slots (Free4talk Grid) -->
      <div class="f4t-card-slots">
        ${slotsHtml}
      </div>

      <!-- Card Footer -->
      <div class="f4t-card-footer">
        <span class="f4t-capacity-badge">
          👥 ${participants.length} / ${maxCapacity} people
        </span>
        <button class="f4t-btn-join ${isFull ? 'full' : ''}" data-room-id="${room.id}">
          ${isFull ? 'Full' : 'Join and talk now!'}
        </button>
      </div>
    `;

    // Join button click
    const btnJoin = card.querySelector('.f4t-btn-join');
    btnJoin.onclick = (e) => {
      e.stopPropagation();
      if (!isFull) {
        joinRoom(room.id);
      } else {
        showToast('This room is currently full. Choose another or create your own!', 'info');
      }
    };

    grid.appendChild(card);
  });
}

function updateLobbyAvatarSpeaker(userId, isSpeaking) {
  const slot = document.querySelector(`.f4t-slot-occupied[data-user-id="${userId}"] .f4t-avatar-wrapper`);
  if (slot) {
    slot.classList.toggle('speaking', isSpeaking);
  }
}

// 7. Room Joining & Stage Flow
async function joinRoom(roomId) {
  try {
    showToast('Connecting to room stage...', 'info');
    const res = await API.joinRoom(roomId);
    window.activeRoomData = res.room;

    // Leave any previous floating dock
    LingauroDock.hide();

    // Show room view
    showRoomView(res.room);

    // Initialize WebRTC media
    const me = API.getCurrentUserLocal();
    webrtc.currentRoomId = roomId;
    webrtc.currentUser = me;
    await webrtc.initMedia(true, false);

    // Join room on Socket.IO
    socket.emit('join-room', { roomId, user: me });

    // Sync participants stage
    renderStageParticipants(res.room.participants || []);
    renderRoomMembersList(res.room.participants || []);

    // Load recent chat messages
    const chatContainer = document.getElementById('room-chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = '';
      (res.messages || []).forEach(m => appendRoomChatMessage(m));
    }

    // Init Lingauro In-Room Games
    LingauroGames.init(socket, roomId);

    showToast(`Joined ${res.room.title}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showRoomView(room) {
  document.getElementById('lobby-view').style.display = 'none';
  const roomView = document.getElementById('room-view');
  roomView.style.display = 'flex';

  document.getElementById('active-room-flag').textContent = room.flag || '🌐';
  document.getElementById('active-room-title').textContent = room.title;
  document.getElementById('active-room-lang').textContent = room.language;
  document.getElementById('active-room-capacity').textContent = `${room.participants ? room.participants.length : 1}/${room.maxParticipants} members`;

  const levelBadge = document.getElementById('active-room-level-badge');
  if (levelBadge) {
    levelBadge.className = `f4t-level-badge ${room.level || 'any'}`;
    levelBadge.textContent = `${room.level || 'any'} level`;
  }
}

function showLobbyView() {
  document.getElementById('room-view').style.display = 'none';
  document.getElementById('lobby-view').style.display = 'block';
  loadRooms();
}

async function leaveActiveRoom() {
  if (!window.activeRoomData) return;
  const roomId = window.activeRoomData.id;
  const me = API.getCurrentUserLocal();

  try {
    await API.leaveRoom(roomId);
  } catch (e) {}

  if (socket) {
    socket.emit('leave-room', { roomId, userId: me ? me.id : null });
  }

  webrtc.cleanup();
  LingauroDock.hide();
  window.activeRoomData = null;
  showLobbyView();
  showToast('Left conversation room', 'info');
}

// 8. In-Room Stage Participant Rendering
function renderStageParticipants(participants = []) {
  const stageGrid = document.getElementById('stage-participants-grid');
  if (!stageGrid) return;
  stageGrid.innerHTML = '';

  const me = API.getCurrentUserLocal();
  const list = participants.length > 0 ? participants : (me ? [me] : []);

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = `participant-stage-card ${p.isSpeaking ? 'speaking' : ''}`;
    card.setAttribute('data-stage-user-id', p.id);

    card.innerHTML = `
      <div class="stage-avatar-wrapper">
        <img src="${p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}" class="stage-avatar" />
      </div>

      <div class="stage-audio-bars">
        <span class="stage-audio-bar"></span>
        <span class="stage-audio-bar"></span>
        <span class="stage-audio-bar"></span>
        <span class="stage-audio-bar"></span>
      </div>

      <div class="stage-name-tag">
        <span class="stage-mic-badge">${p.isMuted ? '🔇' : '🎙️'}</span>
        <span>${escapeHtml(p.name)}</span>
        <span>${p.flag || p.nativeFlag || '🌐'}</span>
      </div>
    `;

    stageGrid.appendChild(card);
  });
}

function updateStageSpeakerUI(userId, isSpeaking) {
  const card = document.querySelector(`.participant-stage-card[data-stage-user-id="${userId}"]`);
  if (card) {
    card.classList.toggle('speaking', isSpeaking);
  }
}

function renderRoomMembersList(participants = []) {
  const container = document.getElementById('room-members-list');
  if (!container) return;
  container.innerHTML = '';

  const me = API.getCurrentUserLocal();

  participants.forEach(p => {
    const row = document.createElement('div');
    row.className = 'member-row-card';

    const isSelf = me && me.id === p.id;

    row.innerHTML = `
      <div class="member-row-left">
        <img src="${p.avatar}" class="member-row-avatar" />
        <div class="member-row-details">
          <span class="member-row-name">${escapeHtml(p.name)} ${p.isVip ? '👑' : ''}</span>
          <span class="member-row-meta">${p.nativeLang || 'English'} (${p.flag || '🌐'}) • ${p.level || 'Intermediate'}</span>
        </div>
      </div>
      <div class="member-row-actions">
        ${!isSelf ? `
          <button class="btn-member-tip" onclick="TokensVIPManager.tipParticipant('${p.id}', 10)">Tip 10 🪙</button>
          <button class="btn-cancel" style="padding:4px 8px; font-size:11px;" onclick="API.addFriend('${p.id}').then(() => showToast('Friend added!', 'success'))">+ Friend</button>
        ` : '<span style="font-size:11px; color:#2ecc71;">You</span>'}
      </div>
    `;

    container.appendChild(row);
  });
}

// 9. Room Chat Helpers
function appendRoomChatMessage(msg) {
  const container = document.getElementById('room-chat-messages');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'chat-msg';

  row.innerHTML = `
    <img src="${msg.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}" class="chat-msg-avatar" />
    <div class="chat-msg-body">
      <div class="chat-msg-header">
        <span class="chat-msg-author ${msg.isVip ? 'vip' : ''}">
          ${msg.isVip ? '👑 ' : ''}${escapeHtml(msg.senderName)} ${msg.senderFlag || ''}
        </span>
        <span class="chat-msg-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      ${msg.text ? `<div class="chat-msg-text">${escapeHtml(msg.text)}</div>` : ''}
      ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="chat-msg-image" onclick="zoomImage('${msg.imageUrl}')" />` : ''}
    </div>
  `;

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

// 10. Modals & Helpers
function openAuthModal(defaultTab = 'login') {
  const modal = document.getElementById('modal-auth');
  if (!modal) return;
  modal.style.display = 'flex';

  const tabLogin = document.getElementById('tab-auth-login');
  const tabReg = document.getElementById('tab-auth-register');
  const tabGuest = document.getElementById('tab-auth-guest');
  const formLogin = document.getElementById('form-auth-login');
  const formReg = document.getElementById('form-auth-register');
  const formGuest = document.getElementById('form-auth-guest');

  const switchTab = (tab) => {
    tabLogin.classList.toggle('active', tab === 'login');
    tabReg.classList.toggle('active', tab === 'register');
    tabGuest.classList.toggle('active', tab === 'guest');

    formLogin.style.display = tab === 'login' ? 'flex' : 'none';
    formReg.style.display = tab === 'register' ? 'flex' : 'none';
    formGuest.style.display = tab === 'guest' ? 'flex' : 'none';
  };

  tabLogin.onclick = () => switchTab('login');
  tabReg.onclick = () => switchTab('register');
  tabGuest.onclick = () => switchTab('guest');

  switchTab(defaultTab);

  document.getElementById('btn-close-auth').onclick = () => {
    modal.style.display = 'none';
  };

  formLogin.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      const res = await API.login(email, password);
      showToast(res.message, 'success');
      modal.style.display = 'none';
      renderHeaderUser(res.user);
      loadRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  formReg.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const langSelect = document.getElementById('reg-native-lang');
    const nativeLang = langSelect.value;
    const nativeFlag = langSelect.options[langSelect.selectedIndex].getAttribute('data-flag') || '🌐';

    try {
      const res = await API.register({ name, email, password, nativeLang, nativeFlag });
      showToast(res.message, 'success');
      modal.style.display = 'none';
      renderHeaderUser(res.user);
      loadRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  document.getElementById('btn-submit-guest').onclick = async () => {
    const name = document.getElementById('guest-name').value;
    try {
      const res = await API.guestLogin(name);
      showToast(res.message, 'success');
      modal.style.display = 'none';
      renderHeaderUser(res.user);
      loadRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

function openProfileModal(user) {
  const modal = document.getElementById('modal-profile');
  if (!modal) return;

  document.getElementById('profile-name').value = user.name || '';
  document.getElementById('profile-avatar').value = user.avatar || '';
  document.getElementById('profile-bio').value = user.bio || '';
  const nativeSelect = document.getElementById('profile-native-lang');
  if (nativeSelect && user.nativeLang) nativeSelect.value = user.nativeLang;

  modal.style.display = 'flex';

  const closeModal = () => modal.style.display = 'none';
  document.getElementById('btn-close-profile').onclick = closeModal;
  document.getElementById('btn-cancel-profile').onclick = closeModal;

  document.getElementById('btn-save-profile').onclick = async () => {
    const name = document.getElementById('profile-name').value.trim();
    const avatar = document.getElementById('profile-avatar').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();
    const nativeLang = nativeSelect.value;
    const nativeFlag = nativeSelect.options[nativeSelect.selectedIndex].getAttribute('data-flag') || '🌐';

    try {
      const updated = await API.updateProfile({ name, avatar, bio, nativeLang, nativeFlag });
      showToast('Profile updated!', 'success');
      closeModal();
      renderHeaderUser(updated);
      loadRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

function zoomImage(url) {
  const overlay = document.getElementById('modal-image-zoom');
  const img = document.getElementById('zoomed-image');
  if (overlay && img) {
    img.src = url;
    overlay.style.display = 'flex';
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `f4t-toast ${type}`;
  toast.textContent = msg;

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
