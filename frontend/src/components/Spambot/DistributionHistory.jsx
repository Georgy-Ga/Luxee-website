/**
 * Компонент истории рассылок
 */
const DistributionHistory = ({ distributions, loading, onStop, onRemoveFromQueue }) => {
	if (loading) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
					История рассылок
				</h3>
				<p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
			</div>
		);
	}

	if (!distributions || distributions.length === 0) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
					История рассылок
				</h3>
				<p className="text-gray-600 dark:text-gray-400">
					Нет рассылок. Создайте первую рассылку выше.
				</p>
			</div>
		);
	}

	const getStatusColor = (status) => {
		switch (status) {
			case 'running':
				return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
			case 'queued':
				return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
			case 'completed':
				return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
			case 'stopped':
				return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
			case 'error':
				return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
			default:
				return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
		}
	};

	const getStatusText = (status) => {
		switch (status) {
			case 'running':
				return 'Выполняется';
			case 'queued':
				return 'В очереди';
			case 'completed':
				return 'Завершена';
			case 'stopped':
				return 'Остановлена';
			case 'error':
				return 'Ошибка';
			default:
				return status;
		}
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	return (
		<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-3 lg:p-4 border border-light-border dark:border-dark-border">
			<h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-3 lg:mb-4">
				История рассылок
			</h3>

			<div className="overflow-x-auto">
				<table className="w-full table-to-cards">
					<thead>
						<tr className="border-b border-light-border dark:border-dark-border">
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Дата
							</th>
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Аккаунт
							</th>
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Профиль
							</th>
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Тип
							</th>
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Статус
							</th>
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Отправлено
							</th>
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Пропущено
							</th>
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Действия
							</th>
						</tr>
					</thead>
					<tbody>
						{distributions.map((dist, index) => (
							<tr 
								key={dist._id || `dist-${index}`}
								className="border-b border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover bg-light-bg dark:bg-dark-bg"
							>
								<td className="py-3 px-2 text-sm text-gray-900 dark:text-white" data-label="Дата">
									<span className="lg:hidden font-normal">{formatDate(dist.createdAt)}</span>
									<span className="hidden lg:inline">{formatDate(dist.createdAt)}</span>
								</td>
								<td className="py-3 px-2 text-sm text-gray-700 dark:text-gray-300" data-label="Аккаунт">
									<div className="max-w-full lg:max-w-[180px] truncate" title={dist.accountEmail}>
										{dist.accountEmail || 'N/A'}
									</div>
								</td>
								<td className="py-3 px-2 text-sm text-gray-900 dark:text-white" data-label="Профиль">
									<div className="max-w-full lg:max-w-[150px] truncate">
										{dist.profileName || 'N/A'}
									</div>
								</td>
								<td className="py-3 px-2 text-sm text-gray-700 dark:text-gray-300" data-label="Тип">
									{dist.distributionType === 'chat' ? 'Чат' : 'Почта'}
								</td>
								<td className="py-3 px-2" data-label="Статус">
									<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(dist.status)}`}>
										{getStatusText(dist.status)}
									</span>
								</td>
								<td className="py-3 px-2 text-sm text-gray-700 dark:text-gray-300" data-label="Отправлено">
									{dist.sentMessagesCount || 0}
								</td>
								<td className="py-3 px-2 text-sm text-gray-700 dark:text-gray-300" data-label="Пропущено">
									{dist.skippedClientsCount || 0}
								</td>
								<td className="py-3 px-2" data-label="Действия">
									<div className="flex flex-col sm:flex-row gap-2">
										{dist.status === 'running' && (
											<button
												onClick={() => onStop(dist.distributionId)}
												className="px-3 py-2 text-xs lg:text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 whitespace-nowrap min-h-[44px] sm:min-h-0"
											>
												Остановить
											</button>
										)}
										{dist.status === 'queued' && onRemoveFromQueue && (
											<button
												onClick={() => onRemoveFromQueue(dist.id || dist._id)}
												className="px-3 py-2 text-xs lg:text-sm rounded-lg border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 whitespace-nowrap min-h-[44px] sm:min-h-0"
												title="Удалить из очереди"
											>
												✖ Удалить
											</button>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default DistributionHistory;
