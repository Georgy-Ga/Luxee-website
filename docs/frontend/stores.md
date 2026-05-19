# FRONTEND STORES (Zustand)

> **Управление состоянием приложения**  
> **Обновлено:** 10.05.2026

---

## 🗃️ STORES

### authStore.js
**Путь:** `frontend/src/stores/authStore.js`  
**Назначение:** Управление авторизацией

**Состояние:**
```javascript
{
  user: null | { id, email, role },
  isAuth: false,
  isLoading: true
}
```

**Методы:**
- `setAuth(user)` - установить пользователя
- `logout()` - выход из системы
- `checkAuth()` - проверка авторизации при загрузке

---

### chatStore.js
**Путь:** `frontend/src/stores/chatStore.js`  
**Назначение:** Управление чатами и AI

**Состояние:**
```javascript
{
  selectedAccount: null | { id, email },
  selectedProfile: null | { uid, username, avatar },
  selectedChat: null | { chatId, memberUid, memberUsername, memberAvatar },
  aiEnabled: false,
  aiEnabledByAccount: {}
}
```

**Методы:**
- `selectAccount(account)` - выбрать аккаунт
- `selectProfile(profile)` - выбрать профиль
- `selectChat(chat)` - выбрать чат
- `toggleAi()` - переключить AI глобально
- `toggleAiForAccount(accountId)` - переключить AI для аккаунта

---

### themeStore.js
**Путь:** `frontend/src/stores/themeStore.js`  
**Назначение:** Управление темой

**Состояние:**
```javascript
{
  theme: 'light' | 'dark'
}
```

**Методы:**
- `toggleTheme()` - переключить тему
- `setTheme(theme)` - установить тему

---

**Последнее обновление:** 10.05.2026  
**Версия:** 1.0
