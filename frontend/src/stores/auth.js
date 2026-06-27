import { defineStore } from 'pinia';
import { auth } from '@/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin'
  },

  actions: {
    async login(username, password) {
      const data = await auth.login(username, password);
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
    },

    async logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
    },

    async fetchCurrentUser() {
      if (this.token) {
        try {
          this.user = await auth.getCurrentUser();
        } catch (error) {
          this.logout();
        }
      }
    }
  }
});
