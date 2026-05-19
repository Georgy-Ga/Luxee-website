const ProfileInfo = ({ profile }) => {
	if (!profile) return null;

	return (
		<div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
			<div className="flex items-center gap-4">
				{profile.avatar && (
					<img
						src={profile.avatar}
						alt={profile.name}
						className="w-12 h-12 rounded-full object-cover"
					/>
				)}
				<div className="flex-1">
					<h3 className="font-semibold text-gray-900 dark:text-white">
						{profile.name || 'Без имени'}
					</h3>
					{profile.age && (
						<p className="text-sm text-gray-500 dark:text-gray-400">
							{profile.age} лет
						</p>
					)}
				</div>
				{profile.online !== undefined && (
					<div className="flex items-center gap-2">
						<div
							className={`w-3 h-3 rounded-full ${
								profile.online ? 'bg-green-500' : 'bg-gray-400'
							}`}
						/>
						<span className="text-sm text-gray-500 dark:text-gray-400">
							{profile.online ? 'Онлайн' : 'Оффлайн'}
						</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default ProfileInfo;
