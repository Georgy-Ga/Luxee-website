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
	// ❌ НЕ добавлять socket в зависимости - это вызывает бесконечный цикл!
	useEffect(() => {
		const token = Cookies.get('accessToken');
		
		if (!token) {
			console.log('[Socket] No token found, skipping connection');
			return;
		}

		// Если уже есть подключение - не создаем новое
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
  
  		// Если это IP адрес или localhost - используем :5001
  		// Паттерн: localhost, 127.0.0.1, или любой IP (xxx.xxx.xxx.xxx)
  		const isIpOrLocalhost = 
    			hostname === 'localhost' ||
    			hostname === '127.0.0.1' ||
    			/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  
  		if (isIpOrLocalhost) {
    			return `${protocol}//${hostname}:5001`;
  		}
  
  		// Production с доменом - используем nginx (без порта)
  		return `${protocol}//${hostname}`;
	};

	const serverUrl = getSocketUrl();

		console.log('[Socket] Connecting to:', serverUrl);

		const newSocket = io(serverUrl, {
			auth: { token },
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 10000,
			reconnectionAttempts: Infinity,
		});

		// Обработчики событий
		newSocket.on('connect', () => {
			console.log('[Socket] ✓ Connected:', newSocket.id);
			setIsConnected(true);
			setConnectionError(null);
			setReconnectAttempt(0);
		});

		newSocket.on('disconnect', (reason) => {
			console.log('[Socket] ✗ Disconnected:', reason);
			setIsConnected(false);
			
			if (reason === 'io server disconnect') {
				console.log('[Socket] Server closed connection, will not reconnect automatically');
			} else {
				console.log('[Socket] Will attempt to reconnect...');
			}
		});

		newSocket.on('connect_error', (error) => {
			setReconnectAttempt((prev) => prev + 1);
			console.error(`[Socket] Connection error (attempt ${prev + 1}):`, error.message);
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

		// Cleanup при размонтировании
		return () => {
			console.log('[Socket] Cleaning up connection');
			newSocket.close();
			setSocket(null);
		};
	}, []); // ✅ Пустой массив - подключаемся только один раз при монтировании!

	// Отключение при выходе (отсутствие токена)
	useEffect(() => {
		const token = Cookies.get('accessToken');
		
		if (!token && socket) {
			console.log('[Socket] No token, disconnecting...');
			socket.close();
			setSocket(null);
			setIsConnected(false);
		}
	}, []); // Мониторим токен вручную через интервал или события, а не через useEffect

	const value = {
		socket,
		isConnected,
		connectionError,
		reconnectAttempt,
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
