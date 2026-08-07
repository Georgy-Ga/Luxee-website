/**
 * Компонент выбора Luxee аккаунта для рассылки
 */
const AccountSelector = ({ accounts, selectedAccount, onSelect, loading }) => {
	if (loading) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<p className="text-gray-600 dark:text-gray-400">Загрузка аккаунтов...</p>
			</div>
		);
	}

	if (!accounts || accounts.length === 0) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<p className="text-gray-600 dark:text-gray-400">
					Нет доступных аккаунтов. Добавьте Luxee аккаунт на странице Dashboard.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-3 sm:p-4 border border-light-border dark:border-dark-border">
			<h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">
				Шаг 1: Выберите аккаунт
			</h3>
			
			<div className="flex flex-col gap-2 sm:gap-3">
				{accounts.map((account) => (
					<button
						key={account._id}
						onClick={() => onSelect(account)}
						className={`
							p-3 sm:p-4 rounded-lg border-2 transition-all text-left
							flex items-center justify-between min-h-[56px]
							${selectedAccount?._id === account._id
								? 'border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
								: 'border-light-border dark:border-dark-border hover:border-purple-300 dark:hover:border-purple-600'
							}
						`}
					>
						<div className="flex-1 min-w-0">
							<div className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">
								{account.luxeeEmail}
							</div>
							<div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
								{account.isActive ? 'Активен' : 'Неактивен'}
							</div>
						</div>
						{selectedAccount?._id === account._id && (
							<div className="ml-3 text-purple-600 dark:text-purple-400 text-xl sm:text-2xl">
								✓
							</div>
						)}
					</button>
				))}
			</div>
		</div>
	);
};

export default AccountSelector;
