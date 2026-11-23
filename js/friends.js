/**
 * Timepass Talk - Friends & Direct Messaging Module
 * Drawer UI, Presence, 1-on-1 Direct Chat & Image Sharing
 */

const FriendsManager = {
  socket: null,
  activeFriend: null,
  friendsList: [],

  init(socket) {
    this.socket = socket;
    this.setupListeners();
    this.loadFriends();

    if (this.socket) {
      this.socket.on('direct-msg-received', ({ message, sender }) => {
        if (this.activeFriend && this.activeFriend.id === message.senderId) {
          this.appendDirectMessage(message, false);
        } else {
          showToast(`💬 New message from ${sender.name}`);
          const badge = document.getElementById('friends-badge');
          if (badge) {
            badge.style.display = 'inline-block';
            badge.textContent = (parseInt(badge.textContent || '0', 10) + 1).toString();
          }
        }
      });
    }
  },

  setupListeners() {
    const btnOpen = document.getElementById('btn-open-friends');
    const drawerBackdrop = document.getElementById('drawer-friends');
    const btnClose = document.getElementById('btn-close-friends-drawer');
    const btnAdd = document.getElementById('btn-add-friend');
    const inputSearch = document.getElementById('search-friend-input');
    const btnBack = document.getElementById('btn-back-to-friends-list');
    const btnSendDm = document.getElementById('btn-send-dm');
    const dmInput = document.getElementById('dm-chat-input');
    const dmImgInput = document.getElementById('dm-image-input');
    const btnInvite = document.getElementById('btn-invite-friend-room');

    if (btnOpen && drawerBackdrop) {
      btnOpen.onclick = () => {
        drawerBackdrop.style.display = 'flex';
        this.loadFriends();
        const badge = document.getElementById('friends-badge');
        if (badge) badge.style.display = 'none';
      };
    }

    if (btnClose && drawerBackdrop) {
      btnClose.onclick = () => {
        drawerBackdrop.style.display = 'none';
        this.closeDirectChat();
      };
    }

    if (btnAdd && inputSearch) {
      btnAdd.onclick = async () => {
        const val = inputSearch.value.trim();
        if (!val) return;
        try {
          const res = await API.addFriend(null, val);
          showToast(`Added ${res.friend ? res.friend.name : 'friend'}!`, 'success');
          inputSearch.value = '';
          this.loadFriends();
        } catch (e) {
          showToast(e.message, 'error');
        }
      };
    }

    if (btnBack) {
      btnBack.onclick = () => this.closeDirectChat();
    }

    if (btnSendDm && dmInput) {
      const sendHandler = async () => {
        const text = dmInput.value.trim();
        if (!text || !this.activeFriend) return;
        dmInput.value = '';

        try {
          const res = await API.sendDirectMessage(this.activeFriend.id, text, null);
          this.appendDirectMessage(res.message, true);

          if (this.socket) {
            const me = API.getCurrentUserLocal();
            this.socket.emit('send-direct-msg', {
              sender: me,
              receiverId: this.activeFriend.id,
              text,
              imageUrl: null
            });
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      btnSendDm.onclick = sendHandler;
      dmInput.onkeydown = (e) => {
        if (e.key === 'Enter') sendHandler();
      };
    }

    // Image sending in DM
    if (dmImgInput) {
      dmImgInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !this.activeFriend) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            showToast('Uploading image...', 'info');
            const uploadRes = await API.uploadImage(reader.result, file.name);
            const res = await API.sendDirectMessage(this.activeFriend.id, '', uploadRes.url);
            this.appendDirectMessage(res.message, true);

            if (this.socket) {
              const me = API.getCurrentUserLocal();
              this.socket.emit('send-direct-msg', {
                sender: me,
                receiverId: this.activeFriend.id,
                text: '',
                imageUrl: uploadRes.url
              });
            }
          } catch (err) {
            showToast(err.message, 'error');
          }
        };
        reader.readAsDataURL(file);
      };
    }

    // Invite to Room
    if (btnInvite) {
      btnInvite.onclick = () => {
        if (!window.activeRoomData) {
          showToast('You are not currently inside a room to invite friends.', 'error');
          return;
        }
        const inviteText = `Hey! Join me in my practice room: "${window.activeRoomData.title}" (${window.activeRoomData.flag} ${window.activeRoomData.language})`;
        API.sendDirectMessage(this.activeFriend.id, inviteText, null).then(res => {
          this.appendDirectMessage(res.message, true);
          showToast('Sent room invitation!', 'success');
        });
      };
    }
  },

  async loadFriends() {
    const listEl = document.getElementById('friends-list-container');
    if (!listEl) return;

    try {
      const data = await API.getFriends();
      this.friendsList = data.friends || [];
      this.renderFriendsList();
    } catch (e) {
      console.warn('Failed to fetch friends:', e);
    }
  },

  renderFriendsList() {
    const listEl = document.getElementById('friends-list-container');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.friendsList.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:30px 10px; color:#78909c; font-size:13px;">
          No friends yet. Add a fellow language learner using the box above!
        </div>
      `;
      return;
    }

    this.friendsList.forEach(f => {
      const card = document.createElement('div');
      card.className = 'friend-item-card';

      const statusDotClass = f.currentRoom ? 'in-room' : (f.isOnline ? 'online' : '');
      const statusText = f.currentRoom ? `In room: ${f.currentRoom.flag} ${f.currentRoom.title}` : (f.isOnline ? 'Online' : 'Offline');

      card.innerHTML = `
        <div class="friend-item-left">
          <div class="friend-avatar-wrap">
            <img src="${f.avatar}" class="friend-avatar" />
            <span class="friend-status-dot ${statusDotClass}"></span>
          </div>
          <div class="friend-info">
            <span class="friend-name">${f.name} ${f.nativeFlag || '🌐'}</span>
            <span class="friend-status-text">${statusText}</span>
          </div>
        </div>
        <div>
          <button class="btn-create-group" style="padding:4px 10px; font-size:11.5px;">Chat 💬</button>
        </div>
      `;

      card.onclick = () => this.openDirectChat(f);
      listEl.appendChild(card);
    });
  },

  async openDirectChat(friend) {
    this.activeFriend = friend;
    const listEl = document.getElementById('friends-list-container');
    const chatView = document.getElementById('direct-chat-container');
    const avatarEl = document.getElementById('dm-friend-avatar');
    const nameEl = document.getElementById('dm-friend-name');
    const statusEl = document.getElementById('dm-friend-status');

    if (listEl) listEl.style.display = 'none';
    if (chatView) chatView.style.display = 'flex';

    if (avatarEl) avatarEl.src = friend.avatar;
    if (nameEl) nameEl.textContent = friend.name;
    if (statusEl) {
      statusEl.textContent = friend.currentRoom ? `In room: ${friend.currentRoom.flag} ${friend.currentRoom.title}` : 'Online';
    }

    // Load message history
    try {
      const data = await API.getDirectMessages(friend.id);
      const box = document.getElementById('direct-messages-box');
      if (box) {
        box.innerHTML = '';
        (data.messages || []).forEach(m => {
          const isMine = m.senderId !== friend.id;
          this.appendDirectMessage(m, isMine);
        });
      }
    } catch (e) {
      console.warn('Error loading DMs:', e);
    }
  },

  closeDirectChat() {
    this.activeFriend = null;
    const listEl = document.getElementById('friends-list-container');
    const chatView = document.getElementById('direct-chat-container');
    if (listEl) listEl.style.display = 'flex';
    if (chatView) chatView.style.display = 'none';
  },

  appendDirectMessage(msg, isMine) {
    const box = document.getElementById('direct-messages-box');
    if (!box) return;

    const bubble = document.createElement('div');
    bubble.className = `dm-bubble ${isMine ? 'mine' : 'theirs'}`;

    if (msg.imageUrl) {
      bubble.innerHTML = `
        ${msg.text ? `<div>${escapeHtml(msg.text)}</div>` : ''}
        <img src="${msg.imageUrl}" class="dm-image" onclick="zoomImage('${msg.imageUrl}')" />
      `;
    } else {
      bubble.textContent = msg.text;
    }

    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;
  }
};
