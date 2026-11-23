/**
 * Timepass Talk - API Service
 * Handles all REST endpoints with JWT authorization
 */

const API = {
  baseUrl: window.location.origin,

  getToken() {
    return localStorage.getItem('timepass_talk_jwt');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('timepass_talk_jwt', token);
    } else {
      localStorage.removeItem('timepass_talk_jwt');
    }
  },

  getCurrentUserLocal() {
    try {
      const u = localStorage.getItem('timepass_talk_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setCurrentUserLocal(user) {
    if (user) {
      localStorage.setItem('timepass_talk_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('timepass_talk_user');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error occurred');
      }
      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  },

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    this.setCurrentUserLocal(data.user);
    return data;
  },

  async register(userData) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    this.setToken(data.token);
    this.setCurrentUserLocal(data.user);
    return data;
  },

  async guestLogin(name) {
    const data = await this.request('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    this.setToken(data.token);
    this.setCurrentUserLocal(data.user);
    return data;
  },

  async getMe() {
    const data = await this.request('/api/auth/me');
    if (data.user) {
      this.setCurrentUserLocal(data.user);
    }
    return data.user;
  },

  async updateProfile(updates) {
    const data = await this.request('/api/auth/update-profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    if (data.user) {
      this.setCurrentUserLocal(data.user);
    }
    return data.user;
  },

  async claimDailyTokens() {
    const data = await this.request('/api/auth/claim-daily', { method: 'POST' });
    const user = this.getCurrentUserLocal();
    if (user && data.tokens) {
      user.tokens = data.tokens;
      this.setCurrentUserLocal(user);
    }
    return data;
  },

  async upgradeVip() {
    const data = await this.request('/api/auth/upgrade-vip', { method: 'POST' });
    if (data.user) {
      this.setCurrentUserLocal(data.user);
    }
    return data;
  },

  // Rooms
  async getRooms(filters = {}) {
    const params = new URLSearchParams();
    if (filters.language && filters.language !== 'all') params.set('language', filters.language);
    if (filters.level && filters.level !== 'any') params.set('level', filters.level);
    if (filters.size && filters.size !== 'all') params.set('size', filters.size);
    if (filters.search) params.set('search', filters.search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return await this.request(`/api/rooms${qs}`);
  },

  async getRoomDetails(id) {
    return await this.request(`/api/rooms/${id}`);
  },

  async createRoom(roomData) {
    return await this.request('/api/rooms/create', {
      method: 'POST',
      body: JSON.stringify(roomData)
    });
  },

  async joinRoom(id) {
    return await this.request(`/api/rooms/${id}/join`, { method: 'POST' });
  },

  async leaveRoom(id) {
    return await this.request(`/api/rooms/${id}/leave`, { method: 'POST' });
  },

  // Upload
  async uploadImage(base64Data, filename) {
    return await this.request('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: base64Data, filename })
    });
  },

  // Friends & DMs
  async getFriends() {
    return await this.request('/api/friends');
  },

  async addFriend(friendId, email) {
    return await this.request('/api/friends/add', {
      method: 'POST',
      body: JSON.stringify({ friendId, email })
    });
  },

  async getDirectMessages(friendId) {
    return await this.request(`/api/friends/messages/${friendId}`);
  },

  async sendDirectMessage(friendId, text, imageUrl) {
    return await this.request(`/api/friends/messages/${friendId}`, {
      method: 'POST',
      body: JSON.stringify({ text, imageUrl })
    });
  },

  // Tokens & Tipping
  async tipUser(toUserId, amount, note, roomId) {
    return await this.request('/api/tokens/tip', {
      method: 'POST',
      body: JSON.stringify({ toUserId, amount, note, roomId })
    });
  }
};
