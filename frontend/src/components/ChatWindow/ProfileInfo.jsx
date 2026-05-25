const ProfileInfo = ({ profile }) => {
	if (!profile) return null;

	return (
		<div className="p-4 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
			<div className="flex items-center gap-4">
				{profile.avatar && (
					<img
						src={profile.avatar}
						alt={profile.name}
						className="w-12 h-12 rounded-full object-cover"
					/>
				)}
				<div className="flex-1">
					<h3 className="font-semibold text-purple dark:text-accent-light">
						{profile.name || 'Без имени'}
					</h3>
					{profile.age && (
						<p className="text-sm text-gray-600 dark:text-gray-300">
							{profile.age} лет
						</p>
					)}
				</div>
				{profile.online !== undefined && (
					<div className="flex items-center gap-2">
						<div
							className={`w-3 h-3 rounded-full ${
								profile.online ? 'bg-green-500' : 'bg-gray-500'
							}`}
						/>
						<span className="text-sm text-gray-600 dark:text-gray-300">
							{profile.online ? 'Онлайн' : 'Оффлайн'}
						</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default ProfileInfo;
