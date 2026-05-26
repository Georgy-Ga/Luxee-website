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

	const handleToggleUserAi = async (userId, currentStatus) => {
		try {
			await aiApi.setUserAiByAdmin(userId, !currentStatus);
			await loadData();
		} catch (error) {
			console.error('Failed to toggle user AI:', error);
			alert('Ошибка при изменении статуса AI');
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
			<h3 className="text-lg font-semibold mb-4">
				Управление AI ({users.length} пользователей)
			</h3>

			<div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
				{users.map((user) => {
					const isExpanded = expandedUsers.has(user._id);
					const hasAccounts = user.accounts && user.accounts.length > 0;

					return (
						<div key={user._id} className="border rounded-lg p-3 bg-gray-50">
							{/* Заголовок пользователя */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 flex-1">
									{/* Кнопка раскрытия */}
									{hasAccounts && (
										<button
											onClick={() => toggleUserExpand(user._id)}
											className="text-gray-600 hover:text-gray-800 transition-colors"
										>
											{isExpanded ? '▼' : '▶'}
										</button>
									)}

									{/* Email пользователя */}
									<span className="font-medium">{user.email}</span>

									{/* Бейдж ADMIN */}
									{user.role === 'admin' && (
										<span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">
											ADMIN
										</span>
									)}
								</div>

								{/* Статусы и кнопка */}
								<div className="flex items-center gap-3">
									<div className="text-sm text-gray-600">
										<span>AI: {user.aiEnabled ? '🟢 Включен' : '🔴 Выключен'}</span>
										<span className="mx-2">|</span>
										<span>
											Разрешено админом: {user.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}
										</span>
										{hasAccounts && (
											<>
												<span className="mx-2">|</span>
												<span>Аккаунтов: {user.accounts.length}</span>
											</>
										)}
									</div>

									<button
										onClick={() => handleToggleUserAi(user._id, user.aiEnabledByAdmin)}
										className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
											user.aiEnabledByAdmin
												? 'bg-red-500 hover:bg-red-600 text-white'
												: 'bg-green-500 hover:bg-green-600 text-white'
										}`}
									>
										{user.aiEnabledByAdmin ? 'Запретить AI' : 'Разрешить AI'}
									</button>
								</div>
							</div>

							{/* Раскрывающийся список Luxee аккаунтов */}
							{isExpanded && hasAccounts && (
								<div className="mt-3 ml-6 space-y-2">
									{user.accounts.map((account) => (
										<div
											key={account._id}
											className="border border-gray-300 rounded p-2 bg-white flex items-center justify-between"
										>
											<div className="flex-1">
												<div className="font-medium text-sm">{account.luxeeEmail}</div>
												<div className="text-xs text-gray-500 mt-1">
													<span>AI: {account.aiEnabled ? '🟢 Вкл' : '🔴 Выкл'}</span>
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
														? 'bg-red-400 hover:bg-red-500 text-white'
														: 'bg-green-400 hover:bg-green-500 text-white'
												}`}
											>
												{account.aiEnabledByAdmin ? 'Выкл' : 'Вкл'}
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
