import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authApi } from './api/authApi';
import useAuthStore from './stores/authStore';
import useThemeStore from './stores/themeStore';
import useChatStore from './stores/chatStore';
import useAiStateStore from './stores/aiStateStore';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AiTest from './pages/AiTest';
import Distributions from './pages/Distributions';

// Создаём QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Защищённый роут
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        <div className="text-xl text-gray-600 dark:text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  const { setUser, setLoading } = useAuthStore();
  const { isDark, setTheme } = useThemeStore();
  const loadUserAiData = useAiStateStore((state) => state.loadUserAiData);

  // Проверяем авторизацию при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await authApi.getCurrentUser();
        setUser(user);
        
        // Загружаем AI статусы всех аккаунтов пользователя
        if (user) {
          await loadUserAiData();
        }
      } catch (error) {
        console.log('Not authenticated');
        setLoading(false);
      }
    };

    checkAuth();
  }, [setUser, setLoading, loadUserAiData]);

  // Применяем тему при загрузке
  useEffect(() => {
    setTheme(isDark);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-test"
              element={
                <ProtectedRoute>
                  <AiTest />
                </ProtectedRoute>
              }
            />
            <Route
              path="/distributions"
              element={
                <ProtectedRoute>
                  <Distributions />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </QueryClientProvider>
  );
}

export default App;
