import { useState, useEffect } from 'react';
import { aiApi } from '../../api/aiApi';

const AiTab = () => {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [expandedUsers, setExpandedUsers] = useState(new Set());
	const [processingUsers, setProcessingUsers] = useState(new Set());
	const [processingAccounts, setProcessingAccounts] = useState(new Set());
	const [error, setError] = useState(null);

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await aiApi.getAllUsersAiStatus();
			setUsers(data.users || []);
		} catch (error) {
			console.error('Failed to load AI status:', error);
			setError('Не удалось загрузить данные AI. Попробуйте обновить страницу.');
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
		// Защита от двойного клика
		if (processingUsers.has(userId)) return;
		
		try {
			setProcessingUsers(prev => new Set(prev).add(userId));
			setError(null);
			
			const status = getAccountsStatus(accounts);
			// Если все включены - выключаем все, иначе - включаем все
			const newStatus = status === 'all' ? false : true;
			
			await aiApi.setAllUserAccountsAiByAdmin(userId, newStatus);
			await loadData();
		} catch (error) {
			console.error('Failed to toggle all accounts AI:', error);
			const action = getAccountsStatus(accounts) === 'all' ? 'выключить' : 'включить';
			setError(`Не удалось ${action} AI для всех аккаунтов. ${error.response?.data?.error || error.message}`);
		} finally {
			setProcessingUsers(prev => {
				const next = new Set(prev);
				next.delete(userId);
				return next;
			});
		}
	};

	const handleToggleAccountAi = async (accountId, currentStatus) => {
		// Защита от двойного клика
		if (processingAccounts.has(accountId)) return;
		
		try {
			setProcessingAccounts(prev => new Set(prev).add(accountId));
			setError(null);
			
			await aiApi.setAccountAiByAdmin(accountId, !currentStatus);
			await loadData();
		} catch (error) {
			console.error('Failed to toggle account AI:', error);
			const action = currentStatus ? 'выключить' : 'включить';
			setError(`Не удалось ${action} AI для аккаунта. ${error.response?.data?.error || error.message}`);
		} finally {
			setProcessingAccounts(prev => {
				const next = new Set(prev);
				next.delete(accountId);
				return next;
			});
		}
	};

	if (loading) {
		return (
			<div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple dark:border-accent-light mb-4"></div>
				<p className="text-gray-600 dark:text-gray-300">Загрузка данных AI...</p>
			</div>
		);
	}

	return (
		<div className="p-4">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-lg font-semibold text-purple dark:text-accent-light">
					Управление AI ({users.length} пользователей)
				</h3>
				<button
					onClick={loadData}
					disabled={loading}
					className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
					title="Обновить данные"
				>
					🔄 Обновить
				</button>
			</div>

			{/* Сообщение об ошибке */}
			{error && (
				<div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
					<div className="flex items-start gap-2">
						<span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
						<div className="flex-1">
							<p className="text-sm text-red-800 dark:text-red-200 font-medium">Ошибка</p>
							<p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
						</div>
						<button
							onClick={() => setError(null)}
							className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
						>
							✕
						</button>
					</div>
				</div>
			)}

			<div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
				{users.map((user) => {
					const isExpanded = expandedUsers.has(user._id);
					const hasAccounts = user.accounts && user.accounts.length > 0;
					const accountsStatus = getAccountsStatus(user.accounts);
					const isProcessing = processingUsers.has(user._id);

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
											disabled={isProcessing}
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
											disabled={isProcessing}
											className={`px-3 py-1 rounded text-sm font-medium transition-colors relative ${
												accountsStatus === 'all'
													? 'bg-green-500 hover:bg-green-600 text-white'
													: accountsStatus === 'partial'
													? 'bg-yellow-500 hover:bg-yellow-600 text-white'
													: 'bg-gray-400 hover:bg-gray-500 text-white'
											} ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
											title={
												isProcessing
													? 'Обработка...'
													: accountsStatus === 'all'
													? 'Все аккаунты включены. Нажмите чтобы выключить все'
													: accountsStatus === 'partial'
													? 'Часть аккаунтов включена. Нажмите чтобы включить все'
													: 'Все аккаунты выключены. Нажмите чтобы включить все'
											}
										>
											{isProcessing ? (
												<span className="flex items-center gap-2">
													<span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
													Обработка...
												</span>
											) : (
												<>
													{accountsStatus === 'all' && '✅ Все включены'}
													{accountsStatus === 'partial' && '🟡 Частично'}
													{accountsStatus === 'none' && '⚪ Все выключены'}
												</>
											)}
										</button>
									)}
								</div>
							</div>

							{/* Раскрывающийся список Luxee аккаунтов */}
							{isExpanded && hasAccounts && (
								<div className="mt-3 ml-6 space-y-2">
									{user.accounts.map((account) => {
										const isAccountProcessing = processingAccounts.has(account._id);
										
										return (
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
													disabled={isAccountProcessing}
													className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
														account.aiEnabledByAdmin
															? 'bg-green-500 hover:bg-green-600 text-white'
															: 'bg-gray-400 hover:bg-gray-500 text-white'
													} ${isAccountProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
													title={
														isAccountProcessing
															? 'Обработка...'
															: account.aiEnabledByAdmin
															? 'Нажмите чтобы выключить'
															: 'Нажмите чтобы включить'
													}
												>
													{isAccountProcessing ? (
														<span className="flex items-center gap-1">
															<span className="inline-block w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></span>
															...
														</span>
													) : (
														<>
															{account.aiEnabledByAdmin ? '✅ Вкл' : '⚪ Выкл'}
														</>
													)}
												</button>
											</div>
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

export default AiTab;
