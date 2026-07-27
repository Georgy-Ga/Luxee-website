import { useState, useEffect } from 'react';

/**
 * Форма конфигурации рассылки
 * ОБНОВЛЕНО: Полное соответствие с оригинальным GUI spambot
 */
const DistributionForm = ({ profile, account, onSubmit, loading }) => {
	const [distributionType, setDistributionType] = useState('chat');
	const [messages, setMessages] = useState([{ text: '', interval: 0 }]);
	const [mailTitle, setMailTitle] = useState('');
	const [mailText, setMailText] = useState('');
	const [mailPictures, setMailPictures] = useState(''); // Строка: "1, 2, 3"
	
	// Фильтры - Chat condition (Radio buttons)
	const [chatCondition, setChatCondition] = useState('all'); // 'all' | 'empty' | 'not_empty'
	
	// Фильтры - User type (Radio buttons)
	const [userType, setUserType] = useState('paid'); // 'all' | 'paid' | 'free' | 'specific' - По умолчанию "Оплаченный"
	const [specificUsers, setSpecificUsers] = useState(''); // Строка: "123, 456, 789"
	
	// Исключения
	const [excludeIds, setExcludeIds] = useState(''); // Строка: "100, 200, 300"
	
	// Лимиты
	const [limit, setLimit] = useState(30);
	const [filterUpdateLimit, setFilterUpdateLimit] = useState(10);
	const [maxTimeMinutes, setMaxTimeMinutes] = useState(180);
	
	// Константы - разные лимиты для Chat и Mail
	const MAX_CHAT_LIMIT = 30;
	const MAX_MAIL_LIMIT = 10;

	// Автокоррекция лимита при переключении типа рассылки
	useEffect(() => {
		const maxLimit = distributionType === 'chat' ? MAX_CHAT_LIMIT : MAX_MAIL_LIMIT;
		if (limit > maxLimit) {
			setLimit(maxLimit);
		}
	}, [distributionType, limit]);

	if (!profile || !account) {
		return null;
	}

	const handleAddMessage = () => {
		if (messages.length >= 7) {
			alert('Не более 7 сообщений!');
			return;
		}
		setMessages([...messages, { text: '', interval: 2 }]);
	};

	const handleRemoveMessage = (index) => {
		if (messages.length > 1) {
			setMessages(messages.filter((_, i) => i !== index));
		}
	};

	const handleMessageChange = (index, field, value) => {
		const newMessages = [...messages];
		newMessages[index][field] = value;
		setMessages(newMessages);
	};

	// Парсинг строки с ID в массив чисел
	const parseIds = (str) => {
		if (!str.trim()) return [];
		return str.split(',')
			.map(id => parseInt(id.trim()))
			.filter(id => !isNaN(id) && id > 0);
	};

	const handleSubmit = (e) => {
		e.preventDefault();

		// Маппинг chat condition
		let onlyEmptyChat = false;
		let onlyNotEmptyChat = false;
		if (chatCondition === 'empty') {
			onlyEmptyChat = true;
		} else if (chatCondition === 'not_empty') {
			onlyNotEmptyChat = true;
		}

		// Маппинг user type
		let purchased = true;
		let free = true;
		let specificUsersArray = [];

		if (userType === 'paid') {
			purchased = true;
			free = false;
		} else if (userType === 'free') {
			purchased = false;
			free = true;
		} else if (userType === 'specific') {
			purchased = false;
			free = false;
			specificUsersArray = parseIds(specificUsers);
			
			if (specificUsersArray.length === 0) {
				alert('Введите список пользователей для отправки!');
				return;
			}
		}

		// Парсинг exclude IDs
		const excludeIdsArray = parseIds(excludeIds);

		const config = {
			profileUid: profile.uid,
			profileName: profile.age > 0 ? `${profile.name}, ${profile.age}` : profile.name,
			distributionType,
			purchased,
			free,
			onlyEmptyChat,
			onlyNotEmptyChat,
			excludeIds: excludeIdsArray,
			specificUsers: specificUsersArray,
			limit: parseInt(limit),
			filterUpdateLimit: parseInt(filterUpdateLimit),
			maxTimeMinutes: parseInt(maxTimeMinutes),
		};

		if (distributionType === 'chat') {
			// Валидация сообщений
			for (let i = 0; i < messages.length; i++) {
				if (!messages[i].text.trim()) {
					alert(`Введите текст для сообщения ${i + 1}!`);
					return;
				}
			}
			
			config.messages = messages.map(m => ({
				text: m.text,
				interval: parseInt(m.interval) || 0
			}));
		} else {
			// Mail validation
			if (!mailTitle.trim()) {
				alert('Поле "Заголовок" обязательно!');
				return;
			}
			
			if (!mailText.trim()) {
				alert('Поле "Текст" обязательно!');
				return;
			}
			
			const textLength = mailText.trim().length;
			if (textLength < 150 || textLength > 3500) {
				alert(`Текст письма должен быть от 150 до 3500 символов!\nКоличество символов сейчас: ${textLength}`);
				return;
			}

			// Парсинг картинок как массив
			const picturesArray = parseIds(mailPictures);

			config.mailMessage = {
				title: mailTitle,
				text: mailText,
				picturesNumber: picturesArray // Массив, не число!
			};
		}

		onSubmit(config);
	};

	const isValid = () => {
		if (distributionType === 'chat') {
			return messages.every(m => m.text.trim().length > 0);
		} else {
			const textLength = mailText.trim().length;
			return mailTitle.trim().length > 0 && textLength >= 150 && textLength <= 3500;
		}
	};

	return (
		<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
			<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
				Шаг 3: Настройте рассылку
			</h3>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Тип сообщения */}
				<div>
					<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
						Тип сообщения:
					</label>
					<div className="flex gap-4">
						<button
							type="button"
							onClick={() => setDistributionType('chat')}
							className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
								distributionType === 'chat'
									? 'border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
									: 'border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600'
							}`}
						>
							Chat
						</button>
						<button
							type="button"
							onClick={() => setDistributionType('mail')}
							className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
								distributionType === 'mail'
									? 'border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
									: 'border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600'
							}`}
						>
							Mail
						</button>
					</div>
				</div>

				{/* Сообщения для чата */}
				{distributionType === 'chat' && (
					<div>
						<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
							Сообщения:
						</label>
						<div className="space-y-3">
							{messages.map((message, index) => (
								<div key={index} className="flex gap-2">
									<input
										type="text"
										value={message.text}
										onChange={(e) => handleMessageChange(index, 'text', e.target.value)}
										placeholder={`Сообщение ${index + 1}`}
										className="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
									/>
									<input
										type="number"
										value={message.interval}
										onChange={(e) => handleMessageChange(index, 'interval', e.target.value)}
										placeholder="Интервал (сек)"
										min="0"
										className="w-32 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
									/>
									{messages.length > 1 && (
										<button
											type="button"
											onClick={() => handleRemoveMessage(index)}
											className="px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
										>
											✖
										</button>
									)}
								</div>
							))}
						</div>
						<button
							type="button"
							onClick={handleAddMessage}
							disabled={messages.length >= 7}
							className={`mt-2 px-4 py-2 rounded-lg border transition-colors ${
								messages.length >= 7
									? 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
									: 'border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-light-hover dark:hover:bg-dark-hover'
							}`}
						>
							+ Добавить сообщение {messages.length >= 7 && '(максимум 7)'}
						</button>
					</div>
				)}

				{/* Сообщение для почты */}
				{distributionType === 'mail' && (
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
								Заголовок:
							</label>
							<input
								type="text"
								value={mailTitle}
								onChange={(e) => setMailTitle(e.target.value)}
								placeholder="Введите заголовок"
								className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
								Текст (150-3500 символов):
								<span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
									{mailText.length} / 3500
								</span>
							</label>
							<textarea
								value={mailText}
								onChange={(e) => setMailText(e.target.value)}
								placeholder="Введите текст письма"
								rows={4}
								className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
								Картинки (номера через запятую):
							</label>
							<input
								type="text"
								value={mailPictures}
								onChange={(e) => setMailPictures(e.target.value)}
								placeholder="1, 2, 3"
								className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
							/>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								Пример: 1, 2, 3 (номера фотографий профиля)
							</p>
						</div>
					</div>
				)}

				{/* Фильтр: Отправлять только если */}
				<div>
					<label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
						Отправлять только если:
					</label>
					<div className="space-y-2">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="chatCondition"
								value="all"
								checked={chatCondition === 'all'}
								onChange={(e) => setChatCondition(e.target.value)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Отправлять всем
							</span>
						</label>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="chatCondition"
								value="empty"
								checked={chatCondition === 'empty'}
								onChange={(e) => setChatCondition(e.target.value)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Не отправляли ранее (пустые чаты)
							</span>
						</label>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="chatCondition"
								value="not_empty"
								checked={chatCondition === 'not_empty'}
								onChange={(e) => setChatCondition(e.target.value)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Уже отправляли (непустые чаты)
							</span>
						</label>
					</div>
				</div>

				{/* Фильтр: Тип пользователя */}
				<div>
					<label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
						Тип пользователя:
					</label>
					<div className="space-y-2">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="userType"
								value="all"
								checked={userType === 'all'}
								onChange={(e) => setUserType(e.target.value)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Все
							</span>
						</label>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="userType"
								value="paid"
								checked={userType === 'paid'}
								onChange={(e) => setUserType(e.target.value)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Оплаченный (Purchased)
							</span>
						</label>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="userType"
								value="free"
								checked={userType === 'free'}
								onChange={(e) => setUserType(e.target.value)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Бесплатный (Free)
							</span>
						</label>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="userType"
								value="specific"
								checked={userType === 'specific'}
								onChange={(e) => setUserType(e.target.value)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Отправлять конкретным пользователям
							</span>
						</label>
					</div>

					{/* Поле для конкретных пользователей */}
					{userType === 'specific' && (
						<div className="mt-3">
							<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
								Список пользователей для отправки (ID через запятую):
							</label>
							<textarea
								value={specificUsers}
								onChange={(e) => setSpecificUsers(e.target.value)}
								placeholder="123, 456, 789"
								rows={2}
								className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
							/>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								ID пользователей разделенные запятыми (например: 12345, 67890)
							</p>
						</div>
					)}
				</div>

				{/* Исключения */}
				<div>
					<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
						Исключать по ID (через запятую):
					</label>
					<textarea
						value={excludeIds}
						onChange={(e) => setExcludeIds(e.target.value)}
						placeholder="100, 200, 300"
						rows={2}
						className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
					/>
					<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
						ID пользователей которых нужно исключить из рассылки
					</p>
				</div>

				{/* Лимиты */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
							Лимит на рассылку (макс. {distributionType === 'chat' ? MAX_CHAT_LIMIT : MAX_MAIL_LIMIT}):
						</label>
						<input
							type="number"
							value={limit}
							onChange={(e) => {
								const value = parseInt(e.target.value) || 1;
								const maxLimit = distributionType === 'chat' ? MAX_CHAT_LIMIT : MAX_MAIL_LIMIT;
								setLimit(Math.min(Math.max(value, 1), maxLimit));
							}}
							min="1"
							max={distributionType === 'chat' ? MAX_CHAT_LIMIT : MAX_MAIL_LIMIT}
							className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							Максимум {distributionType === 'chat' ? MAX_CHAT_LIMIT : MAX_MAIL_LIMIT} рассылок
						</p>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
							Обновлять список после:
						</label>
						<input
							type="number"
							value={filterUpdateLimit}
							onChange={(e) => setFilterUpdateLimit(e.target.value)}
							min="1"
							max="100"
							className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
							Максимальное время на рассылку (мин.):
						</label>
						<input
							type="number"
							value={maxTimeMinutes}
							onChange={(e) => setMaxTimeMinutes(e.target.value)}
							min="1"
							max="1440"
							className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
						/>
					</div>
				</div>

				{/* Кнопка добавления в очередь */}
				<button
					type="submit"
					disabled={!isValid() || loading}
					className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
						!isValid() || loading
							? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
							: 'bg-purple-600 hover:bg-purple-700 text-white'
					}`}
				>
					{loading ? 'Добавление...' : 'Добавить на рассылку →'}
				</button>
			</form>
		</div>
	);
};

export default DistributionForm;
