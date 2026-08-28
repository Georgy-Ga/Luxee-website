/**
 * Компонент выбора Luxee аккаунта для рассылки
 * Дополнительно у каждого аккаунта — кнопка «Использовать шаблон» с бейджем-счётчиком.
 */
const AccountSelector = ({
	accounts,
	selectedAccount,
	onSelect,
	loading,
	templateCounts = {},
	onUseTemplate = null,
	title = 'Шаг 1: Выберите аккаунт',
}) => {
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
				{title}
			</h3>

			<div className="flex flex-col gap-2 sm:gap-3">
				{accounts.map((account) => {
					const templateCount = templateCounts[account._id] || 0;
					const isSelected = selectedAccount?._id === account._id;

					return (
						<div
							key={account._id}
							className="flex flex-col sm:flex-row items-stretch gap-2"
						>
							<button
								onClick={() => onSelect(account)}
								className={`
									flex-1 p-3 sm:p-4 rounded-lg border-2 transition-all text-left
									flex items-center justify-between min-h-[56px]
									${isSelected
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
								{isSelected && (
									<div className="ml-3 text-purple-600 dark:text-purple-400 text-xl sm:text-2xl">
										✓
									</div>
								)}
							</button>

							{onUseTemplate && (
								<button
									onClick={() => onUseTemplate(account)}
									disabled={templateCount === 0}
									title={
										templateCount === 0
											? 'Нет шаблонов'
											: 'Использовать шаблон'
									}
									className={`
										flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm
										min-h-[56px] sm:min-h-[56px] sm:w-auto
										transition-colors whitespace-nowrap
										${templateCount === 0
											? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-gray-800/40'
											: 'border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer'
										}
									`}
								>
									Использовать шаблон
									<span
										className={`
											px-2 py-0.5 rounded-full text-xs font-semibold
											${templateCount === 0
												? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
												: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
											}
										`}
									>
										{templateCount}
									</span>
								</button>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default AccountSelector;
