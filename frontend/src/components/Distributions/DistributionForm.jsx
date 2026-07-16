import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { distributionApi } from '../../api/distributionApi';
import useDistributionStore from '../../stores/distributionStore';
import { Button, Card, Input, Textarea } from '../ui';
import { toast } from 'react-hot-toast';

const DistributionForm = ({ accountId, account }) => {
  const addToQueue = useDistributionStore((state) => state.addToQueue);

  // State для аутентификации
  const [authStatus, setAuthStatus] = useState(null); // null | 'authenticating' | 'authenticated' | 'error'
  const [authError, setAuthError] = useState(null);

  // Мутация для аутентификации аккаунта
  const authenticateMutation = useMutation({
    mutationFn: async () => {
      console.log('[DistributionForm] 🔐 Аутентификация аккаунта:', accountId);
      return await distributionApi.authenticateAccount(accountId);
    },
    onSuccess: (data) => {
      console.log('[DistributionForm] ✅ Аккаунт авторизован:', data);
      setAuthStatus('authenticated');
      setAuthError(null);
      toast.success(`Аккаунт авторизован! Найдено профилей: ${data.profiles_count || 0}`);
      
      // Сохраняем статус в localStorage
      const savedStatuses = JSON.parse(localStorage.getItem('luxee_auth_status') || '{}');
      savedStatuses[accountId] = 'authenticated';
      localStorage.setItem('luxee_auth_status', JSON.stringify(savedStatuses));
    },
    onError: (error) => {
      console.error('[DistributionForm] ❌ Ошибка аутентификации:', error);
      setAuthStatus('error');
      setAuthError(error.response?.data?.error || error.message);
      toast.error('Ошибка аутентификации аккаунта');
    },
  });

  // Профили - загружаем только после успешной аутентификации
  const { data: profilesData, isLoading: isLoadingProfiles, error: profilesError, refetch: refetchProfiles } = useQuery({
    queryKey: ['spambot-profiles', accountId],
    queryFn: async () => {
      console.log('[DistributionForm] 🔄 Загрузка профилей из spambot для аккаунта:', accountId);
      try {
        const data = await distributionApi.getAccountProfiles(accountId);
        console.log('[DistributionForm] ✅ Профили загружены:', data);
        return data;
      } catch (error) {
        console.error('[DistributionForm] ❌ Ошибка загрузки профилей:', error);
        
        // Если требуется аутентификация - сбрасываем статус
        if (error.response?.data?.needsAuthentication) {
          setAuthStatus(null);
          const savedStatuses = JSON.parse(localStorage.getItem('luxee_auth_status') || '{}');
          delete savedStatuses[accountId];
          localStorage.setItem('luxee_auth_status', JSON.stringify(savedStatuses));
        }
        
        throw error;
      }
    },
    enabled: !!accountId && authStatus === 'authenticated',
  });

  // Проверка статуса аутентификации при монтировании
  useEffect(() => {
    if (!accountId) return;

    // Проверяем localStorage
    const savedStatuses = JSON.parse(localStorage.getItem('luxee_auth_status') || '{}');
    if (savedStatuses[accountId] === 'authenticated') {
      console.log('[DistributionForm] ℹ️ Аккаунт помечен как авторизованный (localStorage)');
      setAuthStatus('authenticated');
    }
    // НЕ запускаем автоматическую аутентификацию!
    // Пользователь должен нажать кнопку "Авторизовать"
  }, [accountId]);

  // Функция для ручной авторизации
  const handleAuthenticate = () => {
    console.log('[DistributionForm] 🔐 Ручная авторизация аккаунта:', accountId);
    setAuthStatus('authenticating');
    authenticateMutation.mutate();
  };

  // State формы
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [chatCondition, setChatCondition] = useState('all');
  const [userType, setUserType] = useState('all');
  const [specificUsers, setSpecificUsers] = useState('');
  const [exclude, setExclude] = useState('');
  const [limit, setLimit] = useState('100');
  const [filterUpdateLimit, setFilterUpdateLimit] = useState('50');
  const [maxTimeMinutes, setMaxTimeMinutes] = useState('180');
  
  // Сообщения
  const [messageType, setMessageType] = useState('chat');
  const [messages, setMessages] = useState([{ text: '', interval: 0 }]);
  
  // Mail
  const [mailTitle, setMailTitle] = useState('');
  const [mailText, setMailText] = useState('');
  const [mailImages, setMailImages] = useState('');

  // Выбираем первый профиль по умолчанию
  useEffect(() => {
    console.log('[DistributionForm] 📊 profilesData:', profilesData);
    console.log('[DistributionForm] 📊 selectedProfileId:', selectedProfileId);
    
    // Spambot возвращает {success, luxee_account_id, profiles: []}
    const profiles = profilesData?.profiles || [];
    if (profiles.length > 0 && !selectedProfileId) {
      const firstProfileId = profiles[0].uid;
      console.log('[DistributionForm] ✅ Выбран первый профиль:', firstProfileId);
      setSelectedProfileId(firstProfileId);
    }
  }, [profilesData, selectedProfileId]);

  // Spambot возвращает {success, luxee_account_id, profiles: []}
  const profiles = profilesData?.profiles || [];
  const selectedProfile = profiles.find((p) => p.uid === selectedProfileId);

  // Добавить сообщение
  const addMessage = () => {
    if (messages.length >= 7) {
      toast.error('Максимум 7 сообщений!');
      return;
    }
    setMessages([...messages, { text: '', interval: 1 }]);
  };

  // Удалить сообщение
  const removeMessage = (index) => {
    setMessages(messages.filter((_, i) => i !== index));
  };

  // Обновить сообщение
  const updateMessage = (index, field, value) => {
    const newMessages = [...messages];
    newMessages[index][field] = value;
    setMessages(newMessages);
  };

  // Валидация и добавление в очередь
  const handleAddToQueue = () => {
    // Валидация профиля
    if (!selectedProfile) {
      toast.error('Выберите профиль!');
      return;
    }

    // Валидация лимитов
    const limitNum = parseInt(limit);
    const filterUpdateLimitNum = parseInt(filterUpdateLimit);
    const maxTimeNum = parseInt(maxTimeMinutes);

    if (!limitNum || limitNum <= 0) {
      toast.error('Лимит должен быть больше 0!');
      return;
    }
    if (!filterUpdateLimitNum || filterUpdateLimitNum <= 0) {
      toast.error('Обновление списка должно быть больше 0!');
      return;
    }
    if (!maxTimeNum || maxTimeNum <= 0) {
      toast.error('Максимальное время должно быть больше 0!');
      return;
    }

    // Парсим specific users
    let specificUsersList = [];
    if (userType === 'specific') {
      if (!specificUsers.trim()) {
        toast.error('Введите список пользователей!');
        return;
      }
      try {
        specificUsersList = specificUsers
          .split(',')
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id));
        if (specificUsersList.length === 0) {
          toast.error('Неверный формат списка пользователей!');
          return;
        }
      } catch {
        toast.error('Ошибка парсинга списка пользователей!');
        return;
      }
    }

    // Парсим exclude
    const excludeList = exclude
      .split(',')
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));

    // Подготовка конфига
    const config = {
      luxeeAccountId: accountId,
      profile: {
        uid: selectedProfile.uid,
        name: selectedProfile.name,
        age: selectedProfile.age,
        location: selectedProfile.location,
        image_url: selectedProfile.image_url,
        owner_uid: selectedProfile.owner_uid,
        apps: selectedProfile.apps,
        is_disabled: selectedProfile.is_disabled,
      },
      only_empty_chat: chatCondition === 'empty',
      only_not_empty_chat: chatCondition === 'not_empty',
      purchased: userType === 'paid' || userType === 'all',
      free: userType === 'free' || userType === 'all',
      specific_users: specificUsersList,
      exclude: excludeList,
      limit: limitNum,
      filter_update_limit: filterUpdateLimitNum,
      max_time_minutes: maxTimeNum,
    };

    // Добавляем сообщения или mail
    if (messageType === 'chat') {
      // Валидация chat сообщений
      const validMessages = messages.filter((m) => m.text.trim());
      if (validMessages.length === 0) {
        toast.error('Добавьте хотя бы одно сообщение!');
        return;
      }
      config.messages = validMessages.map((m) => ({
        text: m.text.trim(),
        interval: parseInt(m.interval) || 0,
      }));
    } else {
      // Валидация mail
      if (!mailTitle.trim()) {
        toast.error('Введите заголовок письма!');
        return;
      }
      if (!mailText.trim()) {
        toast.error('Введите текст письма!');
        return;
      }
      if (mailText.length < 150 || mailText.length > 3500) {
        toast.error(`Текст письма должен быть от 150 до 3500 символов! (сейчас: ${mailText.length})`);
        return;
      }

      const imagesList = mailImages
        .split(',')
        .map((n) => parseInt(n.trim()))
        .filter((n) => !isNaN(n));

      config.mail_message = {
        title: mailTitle.trim(),
        text: mailText.trim(),
        pictures_number: imagesList,
      };
    }

    // Добавляем в очередь
    addToQueue(config);
    toast.success(`Рассылка добавлена (${selectedProfile.name})`);

    // Сбрасываем форму сообщений
    if (messageType === 'chat') {
      setMessages([{ text: '', interval: 0 }]);
    } else {
      setMailTitle('');
      setMailText('');
      setMailImages('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Кнопка авторизации (когда НЕ авторизован) */}
      {!authStatus && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔐</span>
            <div className="flex-1">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                Авторизация требуется
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Нажмите кнопку для авторизации аккаунта в spambot и загрузки профилей
              </p>
            </div>
            <Button
              onClick={handleAuthenticate}
              variant="primary"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Авторизовать
            </Button>
          </div>
        </Card>
      )}

      {/* Индикатор аутентификации */}
      {authStatus === 'authenticating' && (
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <div>
              <p className="font-semibold text-purple-900 dark:text-purple-100">
                🔐 Авторизация аккаунта в spambot...
              </p>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Создаём браузерный контекст и загружаем профили (до 60 сек)
              </p>
            </div>
          </div>
        </Card>
      )}

      {authStatus === 'authenticated' && profilesData && (
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                Аккаунт авторизован
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Найдено профилей: {profiles.length}
              </p>
            </div>
          </div>
        </Card>
      )}

      {authStatus === 'error' && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <div className="flex-1">
              <p className="font-semibold text-red-900 dark:text-red-100">
                Ошибка аутентификации
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {authError || 'Не удалось авторизовать аккаунт'}
              </p>
            </div>
            <Button
              onClick={() => {
                setAuthStatus('authenticating');
                authenticateMutation.mutate();
              }}
              variant="secondary"
              size="sm"
            >
              Повторить
            </Button>
          </div>
        </Card>
      )}

      {/* Выбор профиля */}
      <Card>
        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
          Профиль для рассылки
        </h3>
        
        {authStatus === 'authenticating' || authStatus === null ? (
          <div className="text-center py-2 text-purple-600 dark:text-purple-400">
            ⏳ Ожидание аутентификации...
          </div>
        ) : isLoadingProfiles ? (
          <div className="text-center py-2 text-gray-500 dark:text-gray-400">
            Загрузка профилей...
          </div>
        ) : profilesError ? (
          <div className="text-center py-2 text-red-500">
            Ошибка загрузки профилей
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-2 text-gray-500 dark:text-gray-400">
            Нет доступных профилей для этого аккаунта
          </div>
        ) : (
          <select
            value={selectedProfileId || ''}
            onChange={(e) => {
              console.log('[DistributionForm] 🔄 Выбран профиль:', e.target.value);
              setSelectedProfileId(e.target.value);
            }}
            className="w-full px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 dark:text-gray-100 font-medium"
          >
            {profiles.map((profile) => (
              <option 
                key={profile.uid} 
                value={profile.uid}
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {profile.name} ({profile.age}, {profile.location})
              </option>
            ))}
          </select>
        )}
      </Card>

      {/* Настройки рассылки */}
      <Card>
        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
          Настройки рассылки
        </h3>

        {/* Условие чата */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Отправлять только если:
          </label>
          <div className="space-y-2">
            {[
              { value: 'empty', label: 'Не отправляли ранее' },
              { value: 'not_empty', label: 'Уже отправляли' },
              { value: 'all', label: 'Отправлять всем' },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  value={option.value}
                  checked={chatCondition === option.value}
                  onChange={(e) => setChatCondition(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Тип пользователя */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Тип пользователя:
          </label>
          <div className="space-y-2">
            {[
              { value: 'paid', label: 'Оплаченный' },
              { value: 'free', label: 'Бесплатный' },
              { value: 'all', label: 'Все' },
              { value: 'specific', label: 'Конкретные пользователи' },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  value={option.value}
                  checked={userType === option.value}
                  onChange={(e) => setUserType(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Конкретные пользователи (если выбрано) */}
        {userType === 'specific' && (
          <div className="mb-4">
            <Textarea
              label="Список пользователей (ID через запятую)"
              value={specificUsers}
              onChange={(e) => setSpecificUsers(e.target.value)}
              rows={2}
              placeholder="1234, 5678, 9012"
            />
          </div>
        )}

        {/* Исключения */}
        <div className="mb-4">
          <Textarea
            label="Исключать по ID (через запятую)"
            value={exclude}
            onChange={(e) => setExclude(e.target.value)}
            rows={2}
            placeholder="1234, 5678, 9012"
          />
        </div>

        {/* Лимиты */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Лимит на рассылку"
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            min="1"
          />
          <Input
            label="Обновлять список после"
            type="number"
            value={filterUpdateLimit}
            onChange={(e) => setFilterUpdateLimit(e.target.value)}
            min="1"
          />
          <Input
            label="Макс. время (мин.)"
            type="number"
            value={maxTimeMinutes}
            onChange={(e) => setMaxTimeMinutes(e.target.value)}
            min="1"
          />
        </div>
      </Card>

      {/* Сообщения */}
      <Card>
        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
          Сообщения
        </h3>

        {/* Тип сообщения */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Тип сообщения
          </label>
          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white transition-colors border-gray-300 dark:border-gray-600 focus:ring-purple dark:focus:ring-accent focus:outline-none focus:ring-2"
          >
            <option value="chat" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Chat</option>
            <option value="mail" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Mail</option>
          </select>
        </div>

        {/* Chat сообщения */}
        {messageType === 'chat' && (
          <div className="space-y-3">
            {messages.map((msg, index) => (
              <div key={index} className="flex gap-2">
                {index > 0 && (
                  <Input
                    type="number"
                    value={msg.interval}
                    onChange={(e) => updateMessage(index, 'interval', e.target.value)}
                    min="0"
                    max="100"
                    className="w-20"
                    placeholder="Сек"
                  />
                )}
                <Textarea
                  value={msg.text}
                  onChange={(e) => updateMessage(index, 'text', e.target.value)}
                  rows={2}
                  placeholder="Текст сообщения"
                  className="flex-1"
                />
                {index > 0 && (
                  <button
                    onClick={() => removeMessage(index)}
                    className="px-3 text-red-500 hover:text-red-700"
                  >
                    ✖
                  </button>
                )}
              </div>
            ))}
            {messages.length < 7 && (
              <Button onClick={addMessage} variant="secondary" size="sm">
                + Добавить сообщение
              </Button>
            )}
          </div>
        )}

        {/* Mail */}
        {messageType === 'mail' && (
          <div className="space-y-3">
            <Textarea
              label="Заголовок"
              value={mailTitle}
              onChange={(e) => setMailTitle(e.target.value)}
              rows={2}
            />
            <Textarea
              label={`Текст (${mailText.length}/3500, мин. 150)`}
              value={mailText}
              onChange={(e) => setMailText(e.target.value)}
              rows={6}
            />
            <Input
              label="Картинки (номера через запятую)"
              value={mailImages}
              onChange={(e) => setMailImages(e.target.value)}
              placeholder="1, 2, 3"
            />
          </div>
        )}
      </Card>

      {/* Кнопка добавления */}
      <Button onClick={handleAddToQueue} fullWidth className="h-12 text-lg">
        Добавить в очередь →
      </Button>
    </div>
  );
};

export default DistributionForm;
