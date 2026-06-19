/**
 * Socket.io Context для real-time синхронизации AI статусов
 * Предоставляет WebSocket соединение для всех компонентов
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import Cookies from 'js-cookie';

const SocketContext = createContext(null);

/**
 * Provider для Socket.io соединения
 * Автоматически подключается при наличии токена
 */
export const SocketProvider = ({ children }) => {
	const [socket, setSocket] = useState(null);
	const [isConnected, setIsConnected] = useState(false);
	const [connectionError, setConnectionError] = useState(null);
	const [reconnectAttempt, setReconnectAttempt] = useState(0);

	// Инициализация Socket соединения
	const connectSocket = useCallback(() => {
		const token = Cookies.get('accessToken');
		
		if (!token) {
			console.log('[Socket] No token found, skipping connection');
			return;
		}

		if (socket?.connected) {
			console.log('[Socket] Already connected');
			return;
		}

		const getSocketUrl = () => {
  		if (import.meta.env.VITE_API_URL) {
    			return import.meta.env.VITE_API_URL.replace('/api', '');
		}
  
		const hostname = window.location.hostname;
  		const protocol = window.location.protocol;
  
  		// Локальная разработка
  		if (hostname === 'localhost' || hostname.startsWith('192.168')) {
    			return `${protocol}//${hostname}:5000`;
  		}
  
  		// Production
  		return `${protocol}//${hostname}`;
	};

	const serverUrl = getSocketUrl();

		console.log('[Socket] Connecting to:', serverUrl);

		const newSocket = io(serverUrl, {
			auth: { token },
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 10000, // Увеличен макс интервал до 10 сек
			reconnectionAttempts: Infinity, // Бесконечные попытки переподключения
		});

		// Обработчики событий
		newSocket.on('connect', () => {
			console.log('[Socket] ✓ Connected:', newSocket.id);
			setIsConnected(true);
			setConnectionError(null);
			setReconnectAttempt(0); // Сброс счётчика попыток при успешном подключении
		});

		newSocket.on('disconnect', (reason) => {
			console.log('[Socket] ✗ Disconnected:', reason);
			setIsConnected(false);
			
			// Показываем разные сообщения в зависимости от причины
			if (reason === 'io server disconnect') {
				console.log('[Socket] Server closed connection, will not reconnect automatically');
			} else {
				console.log('[Socket] Will attempt to reconnect...');
			}
		});

		newSocket.on('connect_error', (error) => {
			setReconnectAttempt((prev) => prev + 1);
			const attemptNumber = reconnectAttempt + 1;
			console.error(`[Socket] Connection error (attempt ${attemptNumber}):`, error.message);
			setConnectionError(error.message);
			setIsConnected(false);
		});

		newSocket.on('reconnect_attempt', (attemptNumber) => {
			console.log(`[Socket] 🔄 Reconnect attempt ${attemptNumber}...`);
		});

		newSocket.on('reconnect', (attemptNumber) => {
			console.log(`[Socket] ✓ Reconnected after ${attemptNumber} attempts`);
			setReconnectAttempt(0);
		});

		newSocket.on('reconnect_failed', () => {
			console.error('[Socket] ❌ Reconnection failed after all attempts');
		});

		newSocket.on('error', (error) => {
			console.error('[Socket] Error:', error);
			setConnectionError(error.message || 'Unknown error');
		});

		setSocket(newSocket);

		return () => {
			console.log('[Socket] Cleaning up connection');
			newSocket.close();
		};
	}, [socket]);

	// Отключение Socket соединения
	const disconnectSocket = useCallback(() => {
		if (socket) {
			console.log('[Socket] Disconnecting...');
			socket.close();
			setSocket(null);
			setIsConnected(false);
			setConnectionError(null);
		}
	}, [socket]);

	// Подключаемся при монтировании компонента
	useEffect(() => {
		const cleanup = connectSocket();
		return cleanup;
	}, []);

	// Переподключение при изменении токена
	useEffect(() => {
		const token = Cookies.get('accessToken');
		
		if (token && !socket) {
			connectSocket();
		} else if (!token && socket) {
			disconnectSocket();
		}
	}, [socket, connectSocket, disconnectSocket]);

	const value = {
		socket,
		isConnected,
		connectionError,
		reconnectAttempt,
		connectSocket,
		disconnectSocket,
	};

	return (
		<SocketContext.Provider value={value}>
			{children}
		</SocketContext.Provider>
	);
};

/**
 * Hook для использования Socket.io соединения
 * @returns {Object} - { socket, isConnected, connectionError, connectSocket, disconnectSocket }
 */
export const useSocket = () => {
	const context = useContext(SocketContext);
	
	if (!context) {
		throw new Error('useSocket must be used within SocketProvider');
	}
	
	return context;
};

export default SocketContext;
