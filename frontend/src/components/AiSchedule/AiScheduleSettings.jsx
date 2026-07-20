import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import {
	getScheduleStatus,
	updateScheduleSettings,
} from '../../api/aiScheduleApi';
import { Settings } from '../ui/Icons';
import { useSocket } from '../../contexts/SocketContext';

/**
 * Кнопка переключения режима работы ИИ: 24/7 или по интервалам
 */
const AiScheduleSettings = ({ userId, userEmail }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	// Разделяем на часы и минуты для работы
	const [workHours, setWorkHours] = useState(0);
	const [workMinutes, setWorkMinutes] = useState(0);

	// Разделяем на часы и минуты для отдыха
	const [restHours, setRestHours] = useState(0);
	const [restMinutes, setRestMinutes] = useState(0);

	const [schedule, setSchedule] = useState({
		enabled: false,
		currentState: 'disabled',
		nextToggleTime: null,
	});

	// Refs для input элементов
	const workHoursRef = useRef(null);
	const workMinutesRef = useRef(null);
	const restHoursRef = useRef(null);
	const restMinutesRef = useRef(null);

	// WebSocket подключение
	const { socket, isConnected } = useSocket();

	// Загрузка статуса при монтировании
	useEffect(() => {
		loadSchedule();
	}, [userId]);

	// Подписка на WebSocket события изменения расписания
	useEffect(() => {
		if (!socket || !isConnected) {
			return;
		}

		const handleScheduleChanged = data => {
			console.log('[AI Schedule] Received schedule change:', data);

			// Обновляем только если это наш пользователь
			if (data.userId === userId) {
				// Обновляем часы/минуты только если пришли settings
				if (data.settings) {
					const workTotalMinutes = data.settings.workMinutes || 0;
					const restTotalMinutes = data.settings.restMinutes || 0;

					setWorkHours(Math.floor(workTotalMinutes / 60));
					setWorkMinutes(Math.round(workTotalMinutes % 60));

					setRestHours(Math.floor(restTotalMinutes / 60));
					setRestMinutes(Math.round(restTotalMinutes % 60));
				}

				// Определяем enabled по mode (scheduled = включено, always = 24/7)
				const isEnabled = data.mode === 'scheduled';

				setSchedule({
					enabled: isEnabled,
					currentState: data.currentState ?? 'disabled',
					nextToggleTime: data.nextToggleTime ?? null,
				});

				console.log(
					`[AI Schedule] ✓ Updated from WebSocket: ${isEnabled ? 'Interval' : '24/7'}`,
				);
			}
		};

		socket.on('ai:schedule:changed', handleScheduleChanged);

		return () => {
			socket.off('ai:schedule:changed', handleScheduleChanged);
		};
	}, [socket, isConnected, userId]);

	// Добавляем обработчики wheel с {passive: false}
	useEffect(() => {
		const handleWheelWorkHours = e => {
			e.preventDefault();
			const delta = e.deltaY < 0 ? 1 : -1;
			setWorkHours(prev => Math.max(0, Math.min(23, prev + delta)));
		};

		const handleWheelWorkMinutes = e => {
			e.preventDefault();
			const delta = e.deltaY < 0 ? 1 : -1;
			setWorkMinutes(prev => Math.max(0, Math.min(59, prev + delta)));
		};

		const handleWheelRestHours = e => {
			e.preventDefault();
			const delta = e.deltaY < 0 ? 1 : -1;
			setRestHours(prev => Math.max(0, Math.min(23, prev + delta)));
		};

		const handleWheelRestMinutes = e => {
			e.preventDefault();
			const delta = e.deltaY < 0 ? 1 : -1;
			setRestMinutes(prev => Math.max(0, Math.min(59, prev + delta)));
		};

		const workHoursEl = workHoursRef.current;
		const workMinutesEl = workMinutesRef.current;
		const restHoursEl = restHoursRef.current;
		const restMinutesEl = restMinutesRef.current;

		if (workHoursEl)
			workHoursEl.addEventListener('wheel', handleWheelWorkHours, {
				passive: false,
			});
		if (workMinutesEl)
			workMinutesEl.addEventListener('wheel', handleWheelWorkMinutes, {
				passive: false,
			});
		if (restHoursEl)
			restHoursEl.addEventListener('wheel', handleWheelRestHours, {
				passive: false,
			});
		if (restMinutesEl)
			restMinutesEl.addEventListener('wheel', handleWheelRestMinutes, {
				passive: false,
			});

		return () => {
			if (workHoursEl)
				workHoursEl.removeEventListener('wheel', handleWheelWorkHours);
			if (workMinutesEl)
				workMinutesEl.removeEventListener('wheel', handleWheelWorkMinutes);
			if (restHoursEl)
				restHoursEl.removeEventListener('wheel', handleWheelRestHours);
			if (restMinutesEl)
				restMinutesEl.removeEventListener('wheel', handleWheelRestMinutes);
		};
	}, [isOpen]);

	const loadSchedule = async () => {
		try {
			console.log('[AI Schedule] Loading schedule from API...');
			const data = await getScheduleStatus(userId);
			console.log('[AI Schedule] Received from API:', {
				enabled: data.enabled,
				workMinutes: data.workMinutes,
				restMinutes: data.restMinutes,
			});

			// Конвертируем минуты в часы и минуты
			const workTotalMinutes = data.workMinutes || 0;
			const restTotalMinutes = data.restMinutes || 0;

			setWorkHours(Math.floor(workTotalMinutes / 60));
			setWorkMinutes(Math.round(workTotalMinutes % 60));

			setRestHours(Math.floor(restTotalMinutes / 60));
			setRestMinutes(Math.round(restTotalMinutes % 60));

			setSchedule({
				enabled: data.enabled ?? false,
				currentState: data.currentState ?? 'disabled',
				nextToggleTime: data.nextToggleTime ?? null,
			});
			
			console.log('[AI Schedule] State updated from API:', {
				enabled: data.enabled ?? false,
			});
		} catch (error) {
			console.error('[AI Schedule] Failed to load:', error);
		}
	};

	// Валидация: проверка что хотя бы одно значение > 0
	const validateSettings = () => {
		const totalWork = workHours * 60 + workMinutes;
		const totalRest = restHours * 60 + restMinutes;

		if (totalWork <= 0) {
			return 'Время работы должно быть больше 0';
		}

		if (totalRest <= 0) {
			return 'Время отдыха должно быть больше 0';
		}

		return null;
	};

	// Переключение режима (НЕ открывает настройки!)
	const toggleMode = async () => {
		if (loading) return;

		setLoading(true);
		setError('');
		try {
			const newEnabled = !schedule.enabled;

			// Если включаем, проверяем что настройки валидны
			if (newEnabled) {
				const validationError = validateSettings();
				if (validationError) {
					setError(validationError);
					setIsOpen(true); // Открываем модалку чтобы показать ошибку
					setLoading(false);
					return;
				}
			}

			const totalWorkMinutes = workHours * 60 + workMinutes;
			const totalRestMinutes = restHours * 60 + restMinutes;

			// Отправляем запрос, но НЕ обновляем state - это сделает WebSocket
			await updateScheduleSettings(userId, {
				enabled: newEnabled,
				workMinutes: totalWorkMinutes,
				restMinutes: totalRestMinutes,
			});

			console.log(
				`[AI Schedule] Mode toggle requested: ${newEnabled ? 'Interval' : '24/7'}`,
			);
		} catch (error) {
			console.error('[AI Schedule] Failed to toggle:', error);
			setError(error.response?.data?.error || 'Ошибка при переключении режима');
		} finally {
			setLoading(false);
		}
	};

	// Сохранение настроек
	const handleSave = async () => {
		setError('');

		const validationError = validateSettings();
		if (validationError) {
			setError(validationError);
			return;
		}

		setLoading(true);
		try {
			const totalWorkMinutes = workHours * 60 + workMinutes;
			const totalRestMinutes = restHours * 60 + restMinutes;

			// Отправляем запрос, но НЕ обновляем state - это сделает WebSocket
			await updateScheduleSettings(userId, {
				enabled: schedule.enabled,
				workMinutes: totalWorkMinutes,
				restMinutes: totalRestMinutes,
			});

			setIsOpen(false);
			console.log('[AI Schedule] Settings save requested');
		} catch (error) {
			console.error('[AI Schedule] Failed to save:', error);
			setError(error.response?.data?.error || 'Ошибка при сохранении настроек');
		} finally {
			setLoading(false);
		}
	};

	// Быстрые пресеты
	const applyPreset = (hours, restH) => {
		setWorkHours(hours);
		setWorkMinutes(0);
		setRestHours(restH);
		setRestMinutes(0);
		setError('');
	};

	// Обработчик ввода - только целые числа
	const handleIntegerInput = (value, setter, max) => {
		if (value === '') {
			setter(0);
			return;
		}

		const num = parseInt(value, 10);
		if (isNaN(num) || num < 0) {
			setter(0);
		} else if (num > max) {
			setter(max);
		} else {
			setter(num);
		}
	};

	const formatTime = (hours, minutes) => {
		if (hours === 0 && minutes === 0) return '0м';
		if (hours === 0) return `${minutes}м`;
		if (minutes === 0) return `${hours}ч`;
		return `${hours}ч ${minutes}м`;
	};

	const buttonBaseClass = `
    flex items-center gap-1 px-3 py-1.5 rounded-lg
    transition-all duration-200 font-medium text-sm
    disabled:opacity-50 disabled:cursor-not-allowed
    ${
			schedule.enabled
				? 'border-2 border-pink-500 bg-pink-500/10 text-white'
				: 'border border-gray-600 dark:border-gray-600 text-white hover:border-purple dark:hover:border-accent-light'
		}
  `;

	return (
		<div className='relative flex items-center'>
			{/* Составная кнопка: режим + настройки */}
			<div className='flex items-center rounded-lg overflow-hidden'>
				{/* Левая часть: переключение режима */}
				<button
					onClick={toggleMode}
					disabled={loading}
					className={buttonBaseClass}
					title={
						schedule.enabled
							? 'Переключить на режим 24/7'
							: 'Включить интервалы работы/отдыха'
					}
				>
					<span className='text-white whitespace-nowrap'>
						{schedule.enabled ? 'Интервал' : '24/7'}
					</span>
				</button>

				{/* Разделитель */}
				<div
					className={`w-px h-6 ${schedule.enabled ? 'bg-pink-500' : 'bg-gray-600'}`}
				/>

				{/* Правая часть: открытие настроек */}
				<button
					onClick={() => setIsOpen(!isOpen)}
					disabled={loading}
					className={`
            px-2 py-1.5 transition-all duration-200
            ${
							schedule.enabled
								? 'border-2 border-l-0 border-pink-500 bg-pink-500/10 hover:bg-pink-500/20'
								: 'border border-l-0 border-gray-600 hover:border-purple dark:hover:border-accent-light hover:bg-gray-700/30'
						}
            rounded-r-lg
          `}
					title='Настройки интервалов'
				>
					<Settings className='w-4 h-4 text-white' />
				</button>
			</div>

			{/* Модальное окно настроек */}
			{isOpen && (
				<>
					{/* Overlay */}
					<div
						className='fixed inset-0 bg-black/50 z-[100]'
						onClick={() => setIsOpen(false)}
					/>

					{/* Модалка */}
					<div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-2xl'>
						<div className='card p-6 mx-4 max-h-[90vh] overflow-y-auto'>
							{/* Заголовок */}
							<div className='flex items-center justify-between mb-6'>
								<div>
									<h3 className='text-xl font-bold text-white'>
										Интервалы работы ИИ
									</h3>
									<p className='text-sm text-gray-400 mt-1'>{userEmail}</p>
								</div>
								<button
									onClick={() => setIsOpen(false)}
									className='text-gray-400 hover:text-white transition-colors text-2xl'
								>
									×
								</button>
							</div>

							{/* Ошибка */}
							{error && (
								<div className='mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm'>
									⚠️ {error}
								</div>
							)}

							{/* Быстрые пресеты */}
							<div className='mb-6'>
								<label className='block text-sm font-medium text-gray-300 mb-3'>
									Быстрые настройки:
								</label>
								<div className='grid grid-cols-3 gap-3'>
									<button
										onClick={() => applyPreset(8, 16)}
										className='btn-outline py-3 text-sm hover:bg-purple/20'
									>
										<div className='text-white font-medium'>8ч / 16ч</div>
										<div className='text-xs text-gray-400 mt-1'>
											Работа днём
										</div>
									</button>
									<button
										onClick={() => applyPreset(12, 12)}
										className='btn-outline py-3 text-sm hover:bg-purple/20'
									>
										<div className='text-white font-medium'>12ч / 12ч</div>
										<div className='text-xs text-gray-400 mt-1'>
											Половина дня
										</div>
									</button>
									<button
										onClick={() => applyPreset(16, 8)}
										className='btn-outline py-3 text-sm hover:bg-purple/20'
									>
										<div className='text-white font-medium'>16ч / 8ч</div>
										<div className='text-xs text-gray-400 mt-1'>Почти 24/7</div>
									</button>
								</div>
							</div>

							{/* Настройка времени работы */}
							<div className='mb-6'>
								<label className='block text-sm font-medium text-gray-300 mb-3'>
									⚡ Время работы ИИ
								</label>
								<div className='bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl p-4'>
									<div className='flex items-center gap-4 mb-3'>
										{/* Часы */}
										<div className='flex-1'>
											<label className='block text-xs text-gray-400 mb-1 text-center'>
												Часы
											</label>
											<div className='relative'>
												<input
													ref={workHoursRef}
													type='number'
													min='0'
													max='23'
													value={workHours}
													onChange={e =>
														handleIntegerInput(e.target.value, setWorkHours, 23)
													}
													className='w-full text-2xl py-3 px-4 text-center font-bold bg-gray-800/50 border-2 border-green-500/50 focus:border-green-400 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
													placeholder='0'
												/>
												<div className='absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5'>
													<button
														type='button'
														onClick={() =>
															setWorkHours(Math.min(23, workHours + 1))
														}
														className='w-6 h-6 flex items-center justify-center text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors'
													>
														▲
													</button>
													<button
														type='button'
														onClick={() =>
															setWorkHours(Math.max(0, workHours - 1))
														}
														className='w-6 h-6 flex items-center justify-center text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors'
													>
														▼
													</button>
												</div>
											</div>
										</div>

										{/* Разделитель */}
										<div className='text-2xl text-green-400 font-bold mt-6'>
											:
										</div>

										{/* Минуты */}
										<div className='flex-1'>
											<label className='block text-xs text-gray-400 mb-1 text-center'>
												Минуты
											</label>
											<div className='relative'>
												<input
													ref={workMinutesRef}
													type='number'
													min='0'
													max='59'
													value={workMinutes}
													onChange={e =>
														handleIntegerInput(
															e.target.value,
															setWorkMinutes,
															59,
														)
													}
													className='w-full text-2xl py-3 px-4 text-center font-bold bg-gray-800/50 border-2 border-green-500/50 focus:border-green-400 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
													placeholder='0'
												/>
												<div className='absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5'>
													<button
														type='button'
														onClick={() =>
															setWorkMinutes(Math.min(59, workMinutes + 1))
														}
														className='w-6 h-6 flex items-center justify-center text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors'
													>
														▲
													</button>
													<button
														type='button'
														onClick={() =>
															setWorkMinutes(Math.max(0, workMinutes - 1))
														}
														className='w-6 h-6 flex items-center justify-center text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors'
													>
														▼
													</button>
												</div>
											</div>
										</div>
									</div>

									<p className='text-sm text-gray-300 text-center mt-3'>
										Как долго ИИ будет активен и отвечать на сообщения
									</p>
								</div>
							</div>

							{/* Настройка времени отдыха */}
							<div className='mb-6'>
								<label className='block text-sm font-medium text-gray-300 mb-3'>
									💤 Время отдыха ИИ
								</label>
								<div className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-xl p-4'>
									<div className='flex items-center gap-4 mb-3'>
										{/* Часы */}
										<div className='flex-1'>
											<label className='block text-xs text-gray-400 mb-1 text-center'>
												Часы
											</label>
											<div className='relative'>
												<input
													ref={restHoursRef}
													type='number'
													min='0'
													max='23'
													value={restHours}
													onChange={e =>
														handleIntegerInput(e.target.value, setRestHours, 23)
													}
													className='w-full text-2xl py-3 px-4 text-center font-bold bg-gray-800/50 border-2 border-blue-500/50 focus:border-blue-400 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
													placeholder='0'
												/>
												<div className='absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5'>
													<button
														type='button'
														onClick={() =>
															setRestHours(Math.min(23, restHours + 1))
														}
														className='w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors'
													>
														▲
													</button>
													<button
														type='button'
														onClick={() =>
															setRestHours(Math.max(0, restHours - 1))
														}
														className='w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors'
													>
														▼
													</button>
												</div>
											</div>
										</div>

										{/* Разделитель */}
										<div className='text-2xl text-blue-400 font-bold mt-6'>
											:
										</div>

										{/* Минуты */}
										<div className='flex-1'>
											<label className='block text-xs text-gray-400 mb-1 text-center'>
												Минуты
											</label>
											<div className='relative'>
												<input
													ref={restMinutesRef}
													type='number'
													min='0'
													max='59'
													value={restMinutes}
													onChange={e =>
														handleIntegerInput(
															e.target.value,
															setRestMinutes,
															59,
														)
													}
													className='w-full text-2xl py-3 px-4 text-center font-bold bg-gray-800/50 border-2 border-blue-500/50 focus:border-blue-400 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
													placeholder='0'
												/>
												<div className='absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5'>
													<button
														type='button'
														onClick={() =>
															setRestMinutes(Math.min(59, restMinutes + 1))
														}
														className='w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors'
													>
														▲
													</button>
													<button
														type='button'
														onClick={() =>
															setRestMinutes(Math.max(0, restMinutes - 1))
														}
														className='w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors'
													>
														▼
													</button>
												</div>
											</div>
										</div>
									</div>

									<p className='text-sm text-gray-300 text-center mt-3'>
										Как долго ИИ будет неактивен (пауза между циклами)
									</p>
								</div>
							</div>

							{/* Текущий статус */}
							{schedule.enabled && schedule.currentState !== 'disabled' && (
								<div className='mb-6 p-4 rounded-lg bg-purple/10 border border-purple/30'>
									<div className='flex items-center gap-2 mb-2'>
										<span className='text-lg'>
											{schedule.currentState === 'working' ? '⚡' : '💤'}
										</span>
										<span className='text-white font-medium'>
											Сейчас:{' '}
											{schedule.currentState === 'working'
												? 'Работает'
												: 'Отдыхает'}
										</span>
									</div>
									{schedule.nextToggleTime && (
										<p className='text-sm text-gray-300'>
											Следующее переключение:{' '}
											{new Date(schedule.nextToggleTime).toLocaleString(
												'ru-RU',
											)}
										</p>
									)}
								</div>
							)}

							{/* Кнопки действий */}
							<div className='flex gap-3'>
								<button
									onClick={handleSave}
									disabled={loading}
									className='btn-primary flex-1 py-3 text-lg font-semibold'
								>
									{loading ? 'Сохранение...' : '💾 Сохранить'}
								</button>
								<button
									onClick={() => setIsOpen(false)}
									className='px-8 py-3 rounded-lg border-2 border-gray-600 bg-gray-700/30 hover:bg-gray-700/50 text-white font-semibold transition-all duration-200 hover:border-gray-500'
								>
									✕ Отмена
								</button>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
};

AiScheduleSettings.propTypes = {
	userId: PropTypes.string.isRequired,
	userEmail: PropTypes.string.isRequired,
};

export default AiScheduleSettings;
