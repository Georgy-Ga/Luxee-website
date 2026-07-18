import { useState } from 'react';

/**
 * Компонент выбора Luxee аккаунта для админа
 * Показывает иерархическую структуру: пользователи -> их аккаунты
 */
const AdminAccountSelector = ({ usersWithAccounts, selectedAccount, onSelect, loading }) => {
	// Состояние раскрытых пользователей (по умолчанию все свернуты)
	const [expandedUsers, setExpandedUsers] = useState(new Set());

	const toggleUser = (userId) => {
		const newExpanded = new Set(expandedUsers);
		if (newExpanded.has(userId)) {
			newExpanded.delete(userId);
		} else {
			newExpanded.add(userId);
		}
		setExpandedUsers(newExpanded);
	};

	// SVG иконки
	const ChevronDown = () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);

	const ChevronRight = () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
		</svg>
	);

	if (loading) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<p className="text-gray-600 dark:text-gray-400">Загрузка аккаунтов...</p>
			</div>
		);
	}

	if (!usersWithAccounts || usersWithAccounts.length === 0) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<p className="text-gray-600 dark:text-gray-400">
					Нет доступных аккаунтов в системе.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
			<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
				Шаг 1: Выберите аккаунт
			</h3>
			
			<div className="flex flex-col gap-2">
				{usersWithAccounts.map((userGroup) => {
					const isExpanded = expandedUsers.has(userGroup.user._id);
					const totalAccounts = userGroup.accounts.length;
					
					return (
						<div key={userGroup.user._id} className="border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
							{/* Заголовок пользователя */}
							<button
								onClick={() => toggleUser(userGroup.user._id)}
								className="w-full p-3 bg-light-surface dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
							>
								<div className="flex items-center gap-2">
									{/* Иконка chevron */}
									{isExpanded ? (
										<ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
									) : (
										<ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
									)}
									
									{/* Email пользователя */}
									<span className="font-medium text-gray-900 dark:text-white">
										{userGroup.user.email}
									</span>
								</div>
								
								{/* Бейдж с количеством аккаунтов */}
								<span className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
									{totalAccounts}
								</span>
							</button>

							{/* Список аккаунтов (показывается если раскрыто) */}
							{isExpanded && (
								<div className="bg-gray-50 dark:bg-gray-900/50">
									{userGroup.accounts.map((account) => {
										const isSelected = selectedAccount?._id === account._id;
										
										return (
											<button
												key={account._id}
												onClick={() => onSelect(account)}
												className={`
													w-full p-3 border-t border-light-border dark:border-dark-border
													transition-all text-left flex items-center justify-between
													${isSelected
														? 'bg-purple-50 dark:bg-purple-900/20'
														: 'hover:bg-white dark:hover:bg-gray-800'
													}
												`}
											>
												<div className="flex-1 min-w-0 ml-6">
													<div className={`font-medium truncate ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
														{account.luxeeEmail}
													</div>
													<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
														{account.isActive ? 'Активен' : 'Неактивен'}
													</div>
												</div>
												
												{isSelected && (
													<div className="ml-3 text-purple-600 dark:text-purple-400 text-xl">
														✓
													</div>
												)}
											</button>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default AdminAccountSelector;
