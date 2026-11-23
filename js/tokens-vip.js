/**
 * Timepass Talk - Token Economy & VIP Membership Controller
 * Handles token balance, daily claims, in-room tipping & VIP upgrades
 */

const TokensVIPManager = {
  socket: null,

  init(socket) {
    this.socket = socket;
    this.setupListeners();
    this.updateHeaderDisplay();

    if (this.socket) {
      this.socket.on('room-tip-celebration', ({ sender, receiver, amount, note }) => {
        this.triggerCelebrationEffect(sender, receiver, amount);
      });
    }
  },

  setupListeners() {
    const btnClaimHeader = document.getElementById('btn-claim-daily-header');
    const btnOpenVip = document.getElementById('btn-open-vip');
    const modalVip = document.getElementById('modal-vip');
    const btnCloseVip = document.getElementById('btn-close-vip');
    const btnCancelVip = document.getElementById('btn-cancel-vip');
    const btnConfirmVip = document.getElementById('btn-confirm-upgrade-vip');

    if (btnClaimHeader) {
      btnClaimHeader.onclick = async (e) => {
        e.stopPropagation();
        try {
          const res = await API.claimDailyTokens();
          showToast(res.message, 'success');
          this.updateHeaderDisplay();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    if (btnOpenVip && modalVip) {
      btnOpenVip.onclick = () => {
        const u = API.getCurrentUserLocal();
        const balEl = document.getElementById('vip-modal-balance');
        if (balEl && u) balEl.textContent = `🪙 ${u.tokens || 0} Tokens`;
        modalVip.style.display = 'flex';
      };
    }

    const closeVipModal = () => {
      if (modalVip) modalVip.style.display = 'none';
    };

    if (btnCloseVip) btnCloseVip.onclick = closeVipModal;
    if (btnCancelVip) btnCancelVip.onclick = closeVipModal;

    if (btnConfirmVip) {
      btnConfirmVip.onclick = async () => {
        try {
          const res = await API.upgradeVip();
          showToast(res.message, 'success');
          closeVipModal();
          this.updateHeaderDisplay();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }
  },

  updateHeaderDisplay() {
    const user = API.getCurrentUserLocal();
    const valEl = document.getElementById('header-tokens-val');
    if (valEl) {
      valEl.textContent = user ? (user.tokens || 0) : '0';
    }
  },

  async tipParticipant(toUserId, amount = 10, note = 'Great speaking!') {
    try {
      const res = await API.tipUser(toUserId, amount, note, window.activeRoomData ? window.activeRoomData.id : null);
      showToast(res.message, 'success');
      this.updateHeaderDisplay();

      if (this.socket && window.activeRoomData) {
        const me = API.getCurrentUserLocal();
        this.socket.emit('send-room-tip', {
          roomId: window.activeRoomData.id,
          sender: me,
          receiver: { id: toUserId, name: res.receiverName },
          amount,
          note
        });
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  triggerCelebrationEffect(sender, receiver, amount) {
    const bubble = document.createElement('div');
    bubble.className = 'tip-celebration-bubble';
    bubble.innerHTML = `🪙 <strong>${sender.name}</strong> tipped <strong>${amount} tokens</strong> to ${receiver.name}! 🎉`;
    document.body.appendChild(bubble);

    setTimeout(() => {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
    }, 2200);
  }
};
