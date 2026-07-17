/**
 * Distribution Queue Component
 * 
 * Показывает очередь рассылок перед запуском
 * Соответствует distribution_list_frame.py из оригинального GUI
 */
const DistributionQueue = ({ distributions, onStart, onRemove, loading }) => {
	if (distributions.length === 0) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border h-full">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
					Добавлено на рассылку:
				</h3>
				<p className="text-gray-600 dark:text-gray-400 text-center py-8">
					Очередь пуста. Настройте и добавьте рассылку слева.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border h-full flex flex-col">
			<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
				Добавлено на рассылку:
			</h3>

			<div className="flex-1 overflow-auto space-y-3 mb-4">
				{distributions.map((dist, index) => {
					const { config, profile, account } = dist;

					// Форматирование условий
					const chatCondition = config.onlyEmptyChat
						? 'только пустые чаты'
						: config.onlyNotEmptyChat
						? 'только НЕ пустые чаты'
						: 'все чаты';

					let userType = '';
					if (config.specificUsers && config.specificUsers.length > 0) {
						const idsToShow = config.specificUsers.slice(0, 5);
						const remaining = config.specificUsers.length - idsToShow.length;
						userType = `конкретные пользователи (${config.specificUsers.length})`;
						if (remaining > 0) {
							userType += ` - первые: ${idsToShow.join(', ')}... (+${remaining})`;
						} else {
							userType += ` - ID: ${idsToShow.join(', ')}`;
						}
					} else {
						userType =
							config.purchased && !config.free
								? 'оплаченные'
								: !config.purchased && config.free
								? 'бесплатные'
								: 'все пользователи';
					}

					const excludeInfo = config.excludeIds && config.excludeIds.length > 0
						? `${config.excludeIds.slice(0, 5).join(', ')}${config.excludeIds.length > 5 ? '...' : ''}`
						: 'нет';

					return (
						<div
							key={dist.id}
							className="border border-light-border dark:border-dark-border rounded-lg p-3 bg-white dark:bg-dark-bg"
						>
							{/* Заголовок */}
							<div className="flex items-start justify-between mb-2">
								<div className="font-bold text-purple-600 dark:text-purple-400">
									🔹 Рассылка №{index + 1}
								</div>
								<button
									onClick={() => onRemove(dist.id)}
									className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
									title="Удалить из очереди"
								>
									✖
								</button>
							</div>

							{/* Основная информация */}
							<div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
							<div>
								<span className="font-medium">Профиль:</span> {profile.name} ({profile.uid})
							</div>
							<div>
								<span className="font-medium">Аккаунт:</span> {account.luxeeEmail || account.username || account.email || 'Не указан'}
							</div>
								<div>
									<span className="font-medium">Тип:</span>{' '}
									<span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
										{config.distributionType === 'chat' ? 'Chat' : 'Mail'}
									</span>
								</div>
								<div>
									<span className="font-medium">Лимит отправки:</span> {config.limit}
								</div>
								<div>
									<span className="font-medium">Условия:</span> {userType}, {chatCondition}
								</div>
								{config.excludeIds && config.excludeIds.length > 0 && (
									<div>
										<span className="font-medium">Исключения:</span> {excludeInfo}
									</div>
								)}

								{/* Сообщения */}
								{config.distributionType === 'chat' && config.messages && (
									<div className="mt-2 pt-2 border-t border-light-border dark:border-dark-border">
										<div className="font-medium mb-1">Сообщения:</div>
										{config.messages.map((msg, msgIndex) => {
											const truncated = msg.text.length > 50 ? msg.text.substring(0, 47) + '...' : msg.text;
											return (
												<div key={msgIndex} className="text-xs text-gray-600 dark:text-gray-400 ml-2">
													• {truncated} {msg.interval > 0 && `(${msg.interval} сек)`}
												</div>
											);
										})}
									</div>
								)}

								{/* Mail */}
								{config.distributionType === 'mail' && config.mailMessage && (
									<div className="mt-2 pt-2 border-t border-light-border dark:border-dark-border">
										<div className="font-medium mb-1">Письмо:</div>
										<div className="text-xs text-gray-600 dark:text-gray-400 ml-2">
											<div>• {config.mailMessage.title}</div>
											<div className="mt-1">
												• {config.mailMessage.text.substring(0, 50)}
												{config.mailMessage.text.length > 50 && '...'}
											</div>
											{config.mailMessage.picturesNumber && config.mailMessage.picturesNumber.length > 0 && (
												<div className="mt-1">
													• Изображения: {config.mailMessage.picturesNumber.join(', ')}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Кнопка запуска всех рассылок */}
			<button
				onClick={onStart}
				disabled={loading}
				className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-colors ${
					loading
						? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
						: 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
				}`}
			>
				{loading ? 'Запуск...' : 'Начать рассылку!'}
			</button>
		</div>
	);
};

export default DistributionQueue;
