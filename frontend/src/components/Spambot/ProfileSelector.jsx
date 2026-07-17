/**
 * Компонент выбора профиля модели для рассылки
 */
const ProfileSelector = ({ 
	profiles, 
	selectedProfile, 
	onSelect, 
	loading, 
	accountSelected,
	onRefresh,
	onClear
}) => {
	if (!accountSelected) {
		return null;
	}

	if (loading) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
					Шаг 2: Выберите профиль
				</h3>
				<p className="text-gray-600 dark:text-gray-400">Загрузка профилей...</p>
			</div>
		);
	}

	if (!profiles || profiles.length === 0) {
		return (
			<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Шаг 2: Выберите профиль
					</h3>
					{onRefresh && (
						<button
							onClick={onRefresh}
							className="px-3 py-1.5 text-sm rounded-lg border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
							title="Обновить профили"
						>
							🔄 Обновить
						</button>
					)}
				</div>
				<p className="text-gray-600 dark:text-gray-400">
					Нет доступных профилей для этого аккаунта.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
					Шаг 2: Выберите профиль
				</h3>
				<div className="flex gap-2">
					{onRefresh && (
						<button
							onClick={onRefresh}
							disabled={loading}
							className="px-3 py-1.5 text-sm rounded-lg border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							title="Принудительно обновить профили с сервера"
						>
							🔄 Обновить
						</button>
					)}
					{onClear && profiles.length > 0 && (
						<button
							onClick={onClear}
							disabled={loading}
							className="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							title="Очистить кэш и сбросить выбор"
						>
							✖️ Очистить
						</button>
					)}
				</div>
			</div>
			
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{profiles.map((profile) => (
					<button
						key={profile.uid}
						onClick={() => onSelect(profile)}
						className={`
							p-4 rounded-lg border-2 transition-all text-left
							${selectedProfile?.uid === profile.uid
								? 'border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
								: 'border-light-border dark:border-dark-border hover:border-purple-300 dark:hover:border-purple-600'
							}
						`}
					>
						<div className="flex items-start gap-3">
							{profile.image_url && (
								<img 
									src={profile.image_url} 
									alt={profile.name}
									className="w-12 h-12 rounded-full object-cover"
								/>
							)}
							<div className="flex-1 min-w-0">
								<div className="font-medium text-gray-900 dark:text-white truncate">
									{profile.name}
								</div>
							<div className="text-sm text-gray-600 dark:text-gray-400">
								{profile.age > 0 && `${profile.age} лет`}
								{profile.age > 0 && profile.location && ' • '}
								{profile.location}
							</div>
								<div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
									ID: {profile.uid}
								</div>
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
};

export default ProfileSelector;
