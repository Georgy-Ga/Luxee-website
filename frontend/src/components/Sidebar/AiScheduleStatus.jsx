import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { getScheduleStatus } from '../../api/aiScheduleApi';
import useAuthStore from '../../stores/authStore';

/**
 * Компактный статус расписания AI для аккаунта
 * Показывается под информацией об аккаунте
 */
const AiScheduleStatus = ({ accountId }) => {
	const [schedule, setSchedule] = useState(null);
	const [loading, setLoading] = useState(true);
	const { socket, isConnected } = useSocket();
	const userId = useAuthStore(state => state.user?._id);

	// Загрузка расписания при монтировании
	useEffect(() => {
		console.log('[AI Schedule Status] Mount/Update', { accountId, userId });
		loadSchedule();
	}, [userId]); // accountId не нужен - расписание общее для пользователя

	// Подписка на WebSocket события
	useEffect(() => {
		if (!socket || !isConnected || !userId) {
			return;
		}

		const handleScheduleChanged = data => {
			// Обновляем только если это наш пользователь
			if (data.userId === userId) {
				const isEnabled = data.mode === 'scheduled';

				setSchedule({
					enabled: isEnabled,
					currentState: data.currentState ?? 'disabled',
					nextToggleTime: data.nextToggleTime ?? null,
				});
			}
		};

		socket.on('ai:schedule:changed', handleScheduleChanged);

		return () => {
			socket.off('ai:schedule:changed', handleScheduleChanged);
		};
	}, [socket, isConnected, userId]);

	const loadSchedule = async () => {
		if (!userId) {
			console.log('[AI Schedule Status] No userId, skipping load');
			return;
		}

		try {
			setLoading(true);
			console.log('[AI Schedule Status] Loading schedule for userId:', userId);
			const data = await getScheduleStatus(userId);
			console.log('[AI Schedule Status] Received data:', data);

			setSchedule({
				enabled: data.enabled ?? false,
				currentState: data.currentState ?? 'disabled',
				nextToggleTime: data.nextToggleTime ?? null,
			});
		} catch (error) {
			console.error('[AI Schedule Status] Failed to load:', error);
		} finally {
			setLoading(false);
		}
	};

	// Не показываем если расписание не включено
	if (loading || !schedule || !schedule.enabled) {
		console.log('[AI Schedule Status] Not rendering:', { loading, schedule, enabled: schedule?.enabled });
		return null;
	}

	// Не показываем если выключено
	if (schedule.currentState === 'disabled') {
		console.log('[AI Schedule Status] State is disabled, not rendering');
		return null;
	}

	console.log('[AI Schedule Status] ✅ Rendering status:', schedule);

	const isWorking = schedule.currentState === 'working';
	const emoji = isWorking ? '⚡' : '💤';
	const text = isWorking ? 'Работает' : 'Отдыхает';
	const color = isWorking ? 'text-green-400' : 'text-blue-400';

	return (
		<div className='mt-1 px-2 py-1 rounded bg-gray-800/50 border border-gray-700'>
			<div className='flex items-center gap-1.5'>
				<span className='text-sm'>{emoji}</span>
				<span className={`text-[10px] lg:text-xs font-medium ${color}`}>
					{text}
				</span>
				{schedule.nextToggleTime && (
					<span className='text-[9px] lg:text-[10px] text-gray-500'>
						до {new Date(schedule.nextToggleTime).toLocaleTimeString('ru-RU', {
							hour: '2-digit',
							minute: '2-digit',
						})}
					</span>
				)}
			</div>
		</div>
	);
};

AiScheduleStatus.propTypes = {
	accountId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
		.isRequired,
};

export default AiScheduleStatus;
