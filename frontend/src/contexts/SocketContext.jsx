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

		const serverUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

		console.log('[Socket] Connecting to:', serverUrl);

		const newSocket = io(serverUrl, {
			auth: { token },
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			reconnectionAttempts: 5,
		});

		// Обработчики событий
		newSocket.on('connect', () => {
			console.log('[Socket] ✓ Connected:', newSocket.id);
			setIsConnected(true);
			setConnectionError(null);
		});

		newSocket.on('disconnect', (reason) => {
			console.log('[Socket] ✗ Disconnected:', reason);
			setIsConnected(false);
		});

		newSocket.on('connect_error', (error) => {
			console.error('[Socket] Connection error:', error.message);
			setConnectionError(error.message);
			setIsConnected(false);
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
