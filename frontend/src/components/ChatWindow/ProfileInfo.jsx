const ProfileInfo = ({ profile }) => {
	if (!profile) return null;

	return (
		<div className="p-3 lg:p-4 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
			<div className="flex items-center gap-2 lg:gap-4">
				{profile.avatar && (
					<img
						src={profile.avatar}
						alt={profile.name}
						className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover flex-shrink-0"
					/>
				)}
				<div className="flex-1 min-w-0">
					<h3 className="text-sm lg:text-base font-semibold text-purple dark:text-accent-light truncate">
						{profile.name || 'Без имени'}
					</h3>
					{profile.age && (
						<p className="text-xs lg:text-sm text-gray-600 dark:text-gray-300">
							{profile.age} лет
						</p>
					)}
				</div>
				{profile.online !== undefined && (
					<div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
						<div
							className={`w-2 h-2 lg:w-3 lg:h-3 rounded-full ${
								profile.online ? 'bg-green-500' : 'bg-gray-500'
							}`}
						/>
						<span className="hidden sm:inline text-xs lg:text-sm text-gray-600 dark:text-gray-300">
							{profile.online ? 'Онлайн' : 'Оффлайн'}
						</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default ProfileInfo;
