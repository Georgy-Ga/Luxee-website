import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import useAuthStore from '../stores/authStore';
import useThemeStore from '../stores/themeStore';
import { Input, Button, Card, Alert, IconButton } from '../components/ui';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const { isDark, toggleTheme } = useThemeStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { user } = await authApi.login(email, password);
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      
      // Обработка разных типов ошибок
      let errorMessage = 'Ошибка входа';
      
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        errorMessage = 'Не удалось подключиться к серверу. Проверьте подключение к сети.';
      } else if (err.response) {
        // Сервер ответил с ошибкой
        const data = err.response.data;
        errorMessage = data.message || data.error || `Ошибка ${err.response.status}`;
      } else if (err.request) {
        // Запрос был отправлен, но ответа не получено
        errorMessage = 'Сервер не отвечает. Проверьте что backend запущен.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg transition-colors duration-200">
      {/* Кнопка смены темы */}
      <IconButton
        icon={isDark ? '☀️' : '🌙'}
        onClick={toggleTheme}
        className="absolute top-4 right-4"
        variant="secondary"
        aria-label="Toggle theme"
      />

      <Card className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          Вход в систему
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="email"
            label="Email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isLoading}
          />

          <Input
            id="password"
            label="Пароль"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            }
          />

          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Login;
