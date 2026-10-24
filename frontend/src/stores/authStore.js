import { create } from 'zustand';
import Cookies from 'js-cookie';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  sessionId: null,
  deviceId: null,

  setUser: (user, session = {}) => set({
    user,
    isAuthenticated: !!user,
    isLoading: false,
    ...(session.sessionId !== undefined ? { sessionId: session.sessionId } : {}),
    ...(session.deviceId !== undefined ? { deviceId: session.deviceId } : {}),
  }),
  
  logout: () => {
    Cookies.remove('accessToken');
    set({ user: null, isAuthenticated: false, sessionId: null });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));

export default useAuthStore;
