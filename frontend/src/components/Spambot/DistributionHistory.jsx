/**
 * Компонент истории рассылок
 */
const DistributionHistory = ({ distributions, loading, onStop }) => {
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
		<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
			<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
				История рассылок
			</h3>

			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b border-light-border dark:border-dark-border">
							<th className="text-left py-3 px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
								Дата
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
								className="border-b border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover"
							>
								<td className="py-3 px-2 text-sm text-gray-900 dark:text-white">
									{formatDate(dist.createdAt)}
								</td>
							<td className="py-3 px-2 text-sm text-gray-900 dark:text-white">
								<div className="max-w-[150px] truncate">
									{dist.profileName || 'N/A'}
								</div>
							</td>
							<td className="py-3 px-2 text-sm text-gray-700 dark:text-gray-300">
								{dist.distributionType === 'chat' ? 'Чат' : 'Почта'}
							</td>
								<td className="py-3 px-2">
									<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(dist.status)}`}>
										{getStatusText(dist.status)}
									</span>
								</td>
								<td className="py-3 px-2 text-sm text-gray-700 dark:text-gray-300">
									{dist.sentMessagesCount || 0}
								</td>
								<td className="py-3 px-2 text-sm text-gray-700 dark:text-gray-300">
									{dist.skippedClientsCount || 0}
								</td>
								<td className="py-3 px-2">
									{dist.status === 'running' && (
										<button
											onClick={() => onStop(dist.distributionId)}
											className="px-3 py-1 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
										>
											Остановить
										</button>
									)}
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
