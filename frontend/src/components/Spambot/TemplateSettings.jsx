import { useEffect, useRef, useState } from 'react';

/**
 * Глобальные настройки секции шаблона (chat / mail).
 * Полное соответствие с настройками DistributionForm, но для шаблона.
 *
 * value — «resolved» настройки: { purchased, free, onlyEmptyChat, onlyNotEmptyChat,
 *   excludeIds: [], specificUsers: [], limit, filterUpdateLimit, maxTimeMinutes }
 * onChange — вызывается с новым resolved-объектом при любом изменении.
 */
const TemplateSettings = ({ value = {}, onChange, maxLimit = 30 }) => {
	const deriveCondition = v =>
		v.onlyEmptyChat ? 'empty' : v.onlyNotEmptyChat ? 'not_empty' : 'all';

	const deriveUserType = v => {
		if (v.specificUsers && v.specificUsers.length > 0) return 'specific';
		if (v.purchased && !v.free) return 'paid';
		if (!v.purchased && v.free) return 'free';
		return 'all';
	};

	const [chatCondition, setChatCondition] = useState(() => deriveCondition(value));
	const [userType, setUserType] = useState(() => deriveUserType(value));
	const [specificUsers, setSpecificUsers] = useState(() =>
		Array.isArray(value.specificUsers) ? value.specificUsers.join(', ') : '',
	);
	const [excludeIds, setExcludeIds] = useState(() =>
		Array.isArray(value.excludeIds) ? value.excludeIds.join(', ') : '',
	);
	const [limit, setLimit] = useState(
		value.limit != null ? value.limit : maxLimit,
	);
	const [filterUpdateLimit, setFilterUpdateLimit] = useState(
		value.filterUpdateLimit ?? 10,
	);
	const [maxTimeMinutes, setMaxTimeMinutes] = useState(value.maxTimeMinutes ?? 180);

	const isFirst = useRef(true);

	const parseIds = str => {
		if (!str || !str.trim()) return [];
		return str
			.split(',')
			.map(id => parseInt(id.trim(), 10))
			.filter(id => !isNaN(id) && id > 0);
	};

	useEffect(() => {
		if (isFirst.current) {
			isFirst.current = false;
			return;
		}

		let purchased = true;
		let free = true;
		let onlyEmptyChat = false;
		let onlyNotEmptyChat = false;
		let specificUsersArray = [];

		if (userType === 'paid') {
			purchased = true;
			free = false;
		} else if (userType === 'free') {
			purchased = false;
			free = true;
		} else if (userType === 'specific') {
			purchased = false;
			free = false;
			specificUsersArray = parseIds(specificUsers);
		}

		if (chatCondition === 'empty') {
			onlyEmptyChat = true;
		} else if (chatCondition === 'not_empty') {
			onlyNotEmptyChat = true;
		}

		onChange({
			purchased,
			free,
			onlyEmptyChat,
			onlyNotEmptyChat,
			excludeIds: parseIds(excludeIds),
			specificUsers: specificUsersArray,
			limit: parseInt(limit, 10) || 1,
			filterUpdateLimit: parseInt(filterUpdateLimit, 10) || 10,
			maxTimeMinutes: parseInt(maxTimeMinutes, 10) || 180,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		chatCondition,
		userType,
		specificUsers,
		excludeIds,
		limit,
		filterUpdateLimit,
		maxTimeMinutes,
	]);

	const inputClass =
		'w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm';

	const labelClass = 'block text-sm font-medium text-gray-900 dark:text-white mb-2';
	const hintClass = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
	const radioWrapClass = 'flex items-center gap-2 cursor-pointer';
	const radioLabelClass = 'text-sm text-gray-700 dark:text-gray-300';

	return (
		<div className="space-y-4">
			{/* Отправлять только если */}
			<div>
				<label className={labelClass}>Отправлять только если:</label>
				<div className="space-y-2">
					<label className={radioWrapClass}>
						<input
							type="radio"
							name={`chatCondition-${maxLimit}`}
							value="all"
							checked={chatCondition === 'all'}
							onChange={e => setChatCondition(e.target.value)}
							className="w-4 h-4"
						/>
						<span className={radioLabelClass}>Отправлять всем</span>
					</label>
					<label className={radioWrapClass}>
						<input
							type="radio"
							name={`chatCondition-${maxLimit}`}
							value="empty"
							checked={chatCondition === 'empty'}
							onChange={e => setChatCondition(e.target.value)}
							className="w-4 h-4"
						/>
						<span className={radioLabelClass}>Не отправляли ранее (пустые чаты)</span>
					</label>
					<label className={radioWrapClass}>
						<input
							type="radio"
							name={`chatCondition-${maxLimit}`}
							value="not_empty"
							checked={chatCondition === 'not_empty'}
							onChange={e => setChatCondition(e.target.value)}
							className="w-4 h-4"
						/>
						<span className={radioLabelClass}>Уже отправляли (непустые чаты)</span>
					</label>
				</div>
			</div>

			{/* Тип пользователя */}
			<div>
				<label className={labelClass}>Тип пользователя:</label>
				<div className="space-y-2">
					<label className={radioWrapClass}>
						<input
							type="radio"
							name={`userType-${maxLimit}`}
							value="all"
							checked={userType === 'all'}
							onChange={e => setUserType(e.target.value)}
							className="w-4 h-4"
						/>
						<span className={radioLabelClass}>Все</span>
					</label>
					<label className={radioWrapClass}>
						<input
							type="radio"
							name={`userType-${maxLimit}`}
							value="paid"
							checked={userType === 'paid'}
							onChange={e => setUserType(e.target.value)}
							className="w-4 h-4"
						/>
						<span className={radioLabelClass}>Оплаченный (Purchased)</span>
					</label>
					<label className={radioWrapClass}>
						<input
							type="radio"
							name={`userType-${maxLimit}`}
							value="free"
							checked={userType === 'free'}
							onChange={e => setUserType(e.target.value)}
							className="w-4 h-4"
						/>
						<span className={radioLabelClass}>Бесплатный (Free)</span>
					</label>
					<label className={radioWrapClass}>
						<input
							type="radio"
							name={`userType-${maxLimit}`}
							value="specific"
							checked={userType === 'specific'}
							onChange={e => setUserType(e.target.value)}
							className="w-4 h-4"
						/>
						<span className={radioLabelClass}>Отправлять конкретным пользователям</span>
					</label>
				</div>

				{userType === 'specific' && (
					<div className="mt-3">
						<label className={labelClass}>
							Список пользователей для отправки (ID через запятую):
						</label>
						<textarea
							value={specificUsers}
							onChange={e => setSpecificUsers(e.target.value)}
							placeholder="123, 456, 789"
							rows={2}
							className={inputClass}
						/>
					</div>
				)}
			</div>

			{/* Исключения */}
			<div>
				<label className={labelClass}>Исключать по ID (через запятую):</label>
				<textarea
					value={excludeIds}
					onChange={e => setExcludeIds(e.target.value)}
					placeholder="100, 200, 300"
					rows={2}
					className={inputClass}
				/>
				<p className={hintClass}>ID пользователей которых нужно исключить из рассылки</p>
			</div>

			{/* Лимиты */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label className={labelClass}>Лимит на рассылку (макс. {maxLimit}):</label>
					<input
						type="number"
						value={limit}
						onChange={e => {
							const v = parseInt(e.target.value, 10) || 1;
							setLimit(Math.min(Math.max(v, 1), maxLimit));
						}}
						min="1"
						max={maxLimit}
						className={inputClass}
					/>
				</div>
				<div>
					<label className={labelClass}>Обновлять список после:</label>
					<input
						type="number"
						value={filterUpdateLimit}
						onChange={e => setFilterUpdateLimit(e.target.value)}
						min="1"
						max="100"
						className={inputClass}
					/>
				</div>
				<div>
					<label className={labelClass}>Максимальное время на рассылку (мин.):</label>
					<input
						type="number"
						value={maxTimeMinutes}
						onChange={e => setMaxTimeMinutes(e.target.value)}
						min="1"
						max="1440"
						className={inputClass}
					/>
				</div>
			</div>
		</div>
	);
};

export default TemplateSettings;
