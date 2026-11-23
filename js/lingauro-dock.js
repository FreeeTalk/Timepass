/**
 * Timepass Talk - Lingauro Minimized Call Dock
 * Allows users to minimize active rooms into a persistent floating dock
 * so they can browse lobby rooms or chat with friends while staying connected.
 */

const LingauroDock = {
  activeRoom: null,
  webrtcManager: null,
  onExpand: null,
  onLeave: null,

  init(webrtcManager, onExpand, onLeave) {
    this.webrtcManager = webrtcManager;
    this.onExpand = onExpand;
    this.onLeave = onLeave;

    const dock = document.getElementById('floating-dock');
    const btnExpand = document.getElementById('btn-dock-expand');
    const btnLeave = document.getElementById('btn-dock-leave');
    const btnMic = document.getElementById('btn-dock-mic');
    const btnCam = document.getElementById('btn-dock-cam');
    const dockTrigger = document.getElementById('dock-expand-trigger');

    if (btnExpand) btnExpand.onclick = () => this.expand();
    if (dockTrigger) dockTrigger.onclick = () => this.expand();
    if (btnLeave) btnLeave.onclick = () => this.leave();

    if (btnMic) {
      btnMic.onclick = () => {
        if (this.webrtcManager) {
          const isMuted = this.webrtcManager.toggleMute();
          btnMic.innerHTML = isMuted ? '🔇' : '🎙️';
          btnMic.classList.toggle('active', !isMuted);

          // Sync main room stage mic button
          const mainMicIcon = document.getElementById('ctl-mic-icon');
          if (mainMicIcon) mainMicIcon.textContent = isMuted ? '🔇' : '🎙️';
        }
      };
    }

    if (btnCam) {
      btnCam.onclick = async () => {
        if (this.webrtcManager) {
          const isVideo = await this.webrtcManager.toggleVideo();
          btnCam.classList.toggle('active', isVideo);
        }
      };
    }
  },

  show(room, participants = []) {
    this.activeRoom = room;
    const dock = document.getElementById('floating-dock');
    if (!dock) return;

    const flagEl = document.getElementById('dock-room-flag');
    const titleEl = document.getElementById('dock-room-title');
    const avatarsList = document.getElementById('dock-avatars-list');

    if (flagEl) flagEl.textContent = room.flag || '🌐';
    if (titleEl) titleEl.textContent = room.title || 'Conversation Room';

    this.updateAvatars(participants);
    dock.style.display = 'flex';
  },

  updateAvatars(participants = []) {
    const avatarsList = document.getElementById('dock-avatars-list');
    if (!avatarsList) return;

    avatarsList.innerHTML = '';
    participants.slice(0, 4).forEach(p => {
      const img = document.createElement('img');
      img.src = p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
      img.className = 'dock-avatar' + (p.isSpeaking ? ' speaking' : '');
      img.title = p.name;
      avatarsList.appendChild(img);
    });
  },

  hide() {
    const dock = document.getElementById('floating-dock');
    if (dock) dock.style.display = 'none';
    this.activeRoom = null;
  },

  expand() {
    this.hide();
    if (this.onExpand && this.activeRoom) {
      this.onExpand(this.activeRoom);
    }
  },

  leave() {
    this.hide();
    if (this.onLeave && this.activeRoom) {
      this.onLeave(this.activeRoom);
    }
  }
};
