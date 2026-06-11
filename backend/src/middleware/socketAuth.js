/**
 * Middleware для аутентификации Socket.io соединений
 * Проверяет JWT токен и привязывает userId к socket
 */

import jwt from 'jsonwebtoken';

/**
 * Middleware для аутентификации socket соединения
 * Проверяет JWT токен из handshake.auth или handshake.headers
 * 
 * @param {Socket} socket - Socket.io socket
 * @param {Function} next - Callback для продолжения или отклонения соединения
 */
export const socketAuthMiddleware = (socket, next) => {
	try {
		// Получаем токен из auth или headers
		let token = socket.handshake.auth?.token;
		
		if (!token) {
			// Попробовать получить из headers (Bearer token)
			const authHeader = socket.handshake.headers?.authorization;
			if (authHeader && authHeader.startsWith('Bearer ')) {
				token = authHeader.substring(7);
			}
		}

		if (!token) {
			console.log('[Socket Auth] No token provided');
			return next(new Error('Authentication error: No token provided'));
		}

		// Проверяем токен
		const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
		
		if (!decoded || !decoded.id) {
			console.log('[Socket Auth] Invalid token payload');
			return next(new Error('Authentication error: Invalid token'));
		}

		// Привязываем userId и role к socket
		socket.userId = decoded.id;
		socket.userRole = decoded.role || 'user';
		
		console.log(`[Socket Auth] ✓ User authenticated: ${socket.userId} (${socket.userRole})`);
		
		next();
	} catch (error) {
		console.error('[Socket Auth] Authentication failed:', error.message);
		
		if (error.name === 'TokenExpiredError') {
			return next(new Error('Authentication error: Token expired'));
		}
		if (error.name === 'JsonWebTokenError') {
			return next(new Error('Authentication error: Invalid token'));
		}
		
		next(new Error('Authentication error: ' + error.message));
	}
};

export default socketAuthMiddleware;
