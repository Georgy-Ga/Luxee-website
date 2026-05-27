import { useState, useEffect } from 'react';
import { aiApi } from '../../api/aiApi';

const AiTab = () => {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [expandedUsers, setExpandedUsers] = useState(new Set());

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			const data = await aiApi.getAllUsersAiStatus();
			setUsers(data.users || []);
		} catch (error) {
			console.error('Failed to load AI status:', error);
		} finally {
			setLoading(false);
		}
	};

	const toggleUserExpand = (userId) => {
		const newExpanded = new Set(expandedUsers);
		if (newExpanded.has(userId)) {
			newExpanded.delete(userId);
		} else {
			newExpanded.add(userId);
		}
		setExpandedUsers(newExpanded);
	};

	// Определяем состояние всех аккаунтов пользователя
	const getAccountsStatus = (accounts) => {
		if (!accounts || accounts.length === 0) return 'none';
		
		const enabledCount = accounts.filter(acc => acc.aiEnabledByAdmin).length;
		
		if (enabledCount === accounts.length) return 'all';
		if (enabledCount === 0) return 'none';
		return 'partial';
	};

	const handleToggleAllAccounts = async (userId, accounts) => {
		try {
			const status = getAccountsStatus(accounts);
			// Если все включены - выключаем все, иначе - включаем все
			const newStatus = status === 'all' ? false : true;
			
			await aiApi.setAllUserAccountsAiByAdmin(userId, newStatus);
			await loadData();
		} catch (error) {
			console.error('Failed to toggle all accounts AI:', error);
			alert('Ошибка при изменении статуса AI для всех аккаунтов');
		}
	};

	const handleToggleAccountAi = async (accountId, currentStatus) => {
		try {
			await aiApi.setAccountAiByAdmin(accountId, !currentStatus);
			await loadData();
		} catch (error) {
			console.error('Failed to toggle account AI:', error);
			alert('Ошибка при изменении статуса AI аккаунта');
		}
	};

	if (loading) {
		return <div className="p-4 text-center">Загрузка...</div>;
	}

	return (
		<div className="p-4">
			<h3 className="text-lg font-semibold mb-4 text-purple dark:text-accent-light">
				Управление AI ({users.length} пользователей)
			</h3>

			<div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
				{users.map((user) => {
					const isExpanded = expandedUsers.has(user._id);
					const hasAccounts = user.accounts && user.accounts.length > 0;
					const accountsStatus = getAccountsStatus(user.accounts);

					return (
						<div key={user._id} className="card p-3">
							{/* Заголовок пользователя */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 flex-1">
									{/* Кнопка раскрытия */}
									{hasAccounts && (
										<button
											onClick={() => toggleUserExpand(user._id)}
											className="text-gray-600 dark:text-gray-300 hover:text-purple dark:hover:text-accent-light transition-colors"
										>
											{isExpanded ? '▼' : '▶'}
										</button>
									)}

									{/* Email пользователя */}
									<span className="font-medium text-gray-900 dark:text-white">{user.email}</span>

									{/* Бейдж ADMIN */}
									{user.role === 'admin' && (
										<span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded-full font-semibold">
											ADMIN
										</span>
									)}
								</div>

								{/* Статусы и кнопка */}
								<div className="flex items-center gap-3">
									<div className="text-sm text-gray-600 dark:text-gray-300">
										<span>AI: {user.aiEnabled ? '🟢 Включен' : '⚪ Выключен'}</span>
										{hasAccounts && (
											<>
												<span className="mx-2">|</span>
												<span>Аккаунтов: {user.accounts.length}</span>
											</>
										)}
									</div>

									{/* Умная кнопка для всех аккаунтов */}
									{hasAccounts && (
										<button
											onClick={() => handleToggleAllAccounts(user._id, user.accounts)}
											className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
												accountsStatus === 'all'
													? 'bg-green-500 hover:bg-green-600 text-white'
													: accountsStatus === 'partial'
													? 'bg-yellow-500 hover:bg-yellow-600 text-white'
													: 'bg-gray-400 hover:bg-gray-500 text-white'
											}`}
											title={
												accountsStatus === 'all'
													? 'Все аккаунты включены. Нажмите чтобы выключить все'
													: accountsStatus === 'partial'
													? 'Часть аккаунтов включена. Нажмите чтобы включить все'
													: 'Все аккаунты выключены. Нажмите чтобы включить все'
											}
										>
											{accountsStatus === 'all' && '✅ Все включены'}
											{accountsStatus === 'partial' && '🟡 Частично'}
											{accountsStatus === 'none' && '⚪ Все выключены'}
										</button>
									)}
								</div>
							</div>

							{/* Раскрывающийся список Luxee аккаунтов */}
							{isExpanded && hasAccounts && (
								<div className="mt-3 ml-6 space-y-2">
									{user.accounts.map((account) => (
										<div
											key={account._id}
											className="border border-light-border dark:border-dark-border rounded p-2 bg-light-surface dark:bg-dark-surface flex items-center justify-between"
										>
											<div className="flex-1">
												<div className="font-medium text-sm text-gray-900 dark:text-white">{account.luxeeEmail}</div>
												<div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
													<span>AI: {account.aiEnabled ? '🟢 Вкл' : '⚪ Выкл'}</span>
													<span className="mx-2">|</span>
													<span>
														Админ: {account.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}
													</span>
												</div>
											</div>

											<button
												onClick={() =>
													handleToggleAccountAi(account._id, account.aiEnabledByAdmin)
												}
												className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
													account.aiEnabledByAdmin
														? 'bg-green-500 hover:bg-green-600 text-white'
														: 'bg-gray-400 hover:bg-gray-500 text-white'
												}`}
												title={account.aiEnabledByAdmin ? 'Нажмите чтобы выключить' : 'Нажмите чтобы включить'}
											>
												{account.aiEnabledByAdmin ? '✅ Вкл' : '⚪ Выкл'}
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default AiTab;
