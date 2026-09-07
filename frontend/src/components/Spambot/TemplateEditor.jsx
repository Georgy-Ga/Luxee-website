import { useEffect, useState } from 'react';
import { spambotApi } from '../../api/spambotApi';
import useAuthStore from '../../stores/authStore';
import Modal from '../ui/Modal';
import TemplateSettings from './TemplateSettings';

const MAX_CHAT_LIMIT = 30;
const MAX_MAIL_LIMIT = 10;
const MAX_MESSAGES = 7;

const inputClass =
	'w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm';
const labelClass = 'block text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-2';

const CHANNELS = [
	{ key: 'chat', label: 'chat' },
	{ key: 'mail', label: 'mail' },
];

// Возвращает строку лимита для одного канала (та же логика, что в ProfileSelector).
const getChannelLimitLabel = (limits, channelKey, channelLabel) => {
	if (!limits) return null;
	const lim = limits[channelKey];
	if (!lim) return null;
	if (lim.no_information) {
		return { text: `${channelLabel}: no information`, faded: true };
	}
	const { max, count } = lim;
	if (typeof max === 'undefined') return null;
	const available = Math.max((max || 0) - (count || 0), 0);
	if (available <= 0) {
		return { text: `${channelLabel}: исчерпан`, exhausted: true };
	}
	return { text: `${channelLabel}: ${available}/${max}` };
};

// Есть ли у анкеты реальные лимиты (max/count), а не метка "нет информации".
const hasRealLimits = limits => {
	if (!limits || typeof limits !== 'object') return false;
	const chat = limits.chat;
	const mail = limits.mail;
	return (
		(chat && typeof chat.max === 'number') ||
		(mail && typeof mail.max === 'number')
	);
};

// Если не для всех анкет подгрузились лимиты — добираем ИМЕННО лимиты лёгким
// эндпоинтом (/spambot/.../profile-limits), БЕЗ повторной загрузки анкет.
// Аналогично тому, как это делает Spambot при обновлении лимитов после рассылки.
const ensureLimits = async (profiles, account, isAdmin) => {
	if (!profiles || !profiles.some(p => !hasRealLimits(p.limits))) {
		return profiles;
	}

	try {
		const limitsMap = isAdmin
			? await spambotApi.getAdminProfileLimits(account._id)
			: await spambotApi.getProfileLimits(account._id);

		if (!limitsMap) return profiles;

		return profiles.map(p => {
			const l = limitsMap[p.owner_uid];
			return l && hasRealLimits(l) ? { ...p, limits: l } : p;
		});
	} catch (err) {
		console.error('[TemplateEditor] Error refreshing limits:', err);
		return profiles;
	}
};

/**
 * Компактная шапка анкеты (аватар + имя + ID + лимиты) — уменьшенный аналог карточек ProfileSelector.
 */
const ProfileHeader = ({ profile }) => (
	<div className="flex flex-col gap-1 min-w-0">
		<div className="flex items-center gap-2 min-w-0">
			{profile.avatar ? (
				<img
					src={profile.avatar}
					alt={profile.profileName || ''}
					className="w-6 h-6 rounded-full object-cover shrink-0"
				/>
			) : (
				<div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
			)}
			<span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
				{profile.profileName || 'Без имени'}
			</span>
			<span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
				ID: {profile.profileUid}
			</span>
		</div>
		{CHANNELS.map(ch => {
			const res = getChannelLimitLabel(profile.limits, ch.key, ch.label);
			if (!res) return null;
			return (
				<span
					key={ch.key}
					className={`text-[10px] ${
						res.exhausted || res.faded
							? 'text-red-500 dark:text-red-400 font-medium'
							: 'text-gray-500 dark:text-gray-500'
					}`}
				>
					{res.text}
				</span>
			);
		})}
	</div>
);

/**
 * Редактор шаблона рассылки (создание / редактирование / применение).
 */
const TemplateEditor = ({ account, templateId = null, onClose, onSaved, onApplied }) => {
	const { user } = useAuthStore();
	const isAdmin = user?.role === 'admin';

	const [name, setName] = useState('');
	const [loadingProfiles, setLoadingProfiles] = useState(true);
	const [loadError, setLoadError] = useState(null);

	const [currentTemplateId, setCurrentTemplateId] = useState(templateId);
	const [chatSettings, setChatSettings] = useState({});
	const [mailSettings, setMailSettings] = useState({});
	const [chatProfiles, setChatProfiles] = useState([]);
	const [mailProfiles, setMailProfiles] = useState([]);
	const [missing, setMissing] = useState([]);

	const [saving, setSaving] = useState(false);
	const [applying, setApplying] = useState(false);

	// Загрузка анкет аккаунта + (при редактировании) шаблона с валидацией
	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			setLoadingProfiles(true);
			setLoadError(null);
			try {
				let loadedProfiles;
				let templateData = null;

				// При редактировании — получаем шаблон с валидацией, которая сразу
				// возвращает актуальные анкеты (один логин вместо двух). При создании — просто грузим анкеты.
				if (templateId) {
					templateData = await spambotApi.getTemplate(templateId, { validate: true });
					loadedProfiles = templateData.profiles || [];
				} else {
					loadedProfiles = isAdmin
						? await spambotApi.getAdminProfiles(account._id)
						: await spambotApi.getProfiles(account._id);
				}

				if (cancelled) return;

				// Если не для всех анкет подгрузились лимиты — добираем только лимиты (без перезагрузки анкет)
				loadedProfiles = await ensureLimits(loadedProfiles, account, isAdmin);

				if (cancelled) return;

				const tpl = templateData?.template || null;
				const validation = templateData?.validation || null;

				if (tpl) {
					setName(tpl.name || '');
					setChatSettings(tpl.chat?.settings || {});
					setMailSettings(tpl.mail?.settings || {});
					setMissing(validation?.missing || []);
				}

				const chatByUid = new Map(
					(tpl?.chat?.profiles || []).map(p => [String(p.profileUid), p]),
				);
				const mailByUid = new Map(
					(tpl?.mail?.profiles || []).map(p => [String(p.profileUid), p]),
				);

				const buildChatProfiles = (loadedProfiles || []).map(p => {
					const existing = chatByUid.get(String(p.uid));
					return {
						profileUid: p.uid,
						profileName: existing?.profileName || p.name || 'Без имени',
						avatar: existing?.avatar || p.image_url || '',
						limits: p.limits || null,
						messages:
							existing?.messages?.length > 0
								? existing.messages.map(m => ({
										text: m.text || '',
										interval: m.interval || 0,
									}))
								: [{ text: '', interval: 0 }],
					};
				});

				const buildMailProfiles = (loadedProfiles || []).map(p => {
					const existing = mailByUid.get(String(p.uid));
					const pics = Array.isArray(existing?.picturesNumber)
						? existing.picturesNumber
						: [];
					return {
						profileUid: p.uid,
						profileName: existing?.profileName || p.name || 'Без имени',
						avatar: existing?.avatar || p.image_url || '',
						limits: p.limits || null,
						title: existing?.title || '',
						text: existing?.text || '',
						picturesNumber: pics.join(', '),
					};
				});

				setChatProfiles(buildChatProfiles);
				setMailProfiles(buildMailProfiles);
			} catch (err) {
				if (!cancelled) {
					console.error('[TemplateEditor] Error loading:', err);
					setLoadError(err.response?.data?.message || err.message);
				}
			} finally {
				if (!cancelled) setLoadingProfiles(false);
			}
		};

		load();
		return () => {
			cancelled = true;
		};
	}, [account?._id, templateId, isAdmin]);

	// ===== CHAT helpers =====
	const updateChatMessage = (uid, index, field, value) => {
		setChatProfiles(prev =>
			prev.map(p => {
				if (p.profileUid !== uid) return p;
				const messages = [...p.messages];
				messages[index] = { ...messages[index], [field]: value };
				return { ...p, messages };
			}),
		);
	};

	const addChatMessage = uid => {
		setChatProfiles(prev =>
			prev.map(p => {
				if (p.profileUid !== uid) return p;
				if (p.messages.length >= MAX_MESSAGES) return p;
				return { ...p, messages: [...p.messages, { text: '', interval: 2 }] };
			}),
		);
	};

	const removeChatMessage = (uid, index) => {
		setChatProfiles(prev =>
			prev.map(p => {
				if (p.profileUid !== uid) return p;
				if (p.messages.length <= 1) return p;
				const messages = p.messages.filter((_, i) => i !== index);
				return { ...p, messages };
			}),
		);
	};

	// ===== MAIL helpers =====
	const updateMail = (uid, field, value) => {
		setMailProfiles(prev =>
			prev.map(p => (p.profileUid === uid ? { ...p, [field]: value } : p)),
		);
	};

	const parsePictures = str => {
		if (!str || !str.trim()) return [];
		return str
			.split(',')
			.map(n => parseInt(n.trim(), 10))
			.filter(n => !isNaN(n) && n > 0);
	};

	const buildPayload = () => ({
		name,
		chat: {
			settings: chatSettings,
			profiles: chatProfiles.map(p => ({
				profileUid: p.profileUid,
				profileName: p.profileName,
				avatar: p.avatar,
				messages: p.messages.map(m => ({
					text: m.text,
					interval: parseInt(m.interval, 10) || 0,
				})),
			})),
		},
		mail: {
			settings: mailSettings,
			profiles: mailProfiles.map(p => ({
				profileUid: p.profileUid,
				profileName: p.profileName,
				avatar: p.avatar,
				title: p.title,
				text: p.text,
				picturesNumber: parsePictures(p.picturesNumber),
			})),
		},
	});

	const handleSave = async () => {
		if (!name.trim()) {
			alert('Укажите название шаблона');
			return;
		}

		setSaving(true);
		try {
			const payload = buildPayload();
			if (currentTemplateId) {
				await spambotApi.updateTemplate(currentTemplateId, payload);
			} else {
				const created = await spambotApi.createTemplate(account._id, payload);
				setCurrentTemplateId(created.id);
			}
			onSaved?.(currentTemplateId);
			alert('Шаблон сохранён');
		} catch (err) {
			console.error('[TemplateEditor] Save error:', err);
			alert(err.response?.data?.message || err.message);
		} finally {
			setSaving(false);
		}
	};

	const handleApply = async () => {
		if (!currentTemplateId) return;

		setApplying(true);
		try {
			const payload = buildPayload();
			const result = await spambotApi.applyTemplate(currentTemplateId, {
				chat: payload.chat,
				mail: payload.mail,
			});

			alert(`Добавлено на рассылку: ${result.createdCount} рассылок`);

			onApplied?.(result);
			onClose();
		} catch (err) {
			console.error('[TemplateEditor] Apply error:', err);
			alert(err.response?.data?.message || err.message);
		} finally {
			setApplying(false);
		}
	};

	return (
		<Modal
			isOpen={!!account}
			onClose={onClose}
			title={currentTemplateId ? 'Шаблон рассылки' : 'Новый шаблон рассылки'}
			size="xl"
			closeOnOverlayClick={false}
		>
			<div className="space-y-5">
				{/* Название */}
				<div>
					<label className={labelClass}>Название шаблона:</label>
					<input
						type="text"
						value={name}
						onChange={e => setName(e.target.value)}
						placeholder="Например: Приветствие + рассылка"
						className={inputClass}
					/>
				</div>

				{/* Уведомление о недостающих анкетах */}
				{missing.length > 0 && (
					<div className="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-3">
						<p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">
							Анкеты без текста (можно заполнить, либо оставить пустыми — по ним рассылка не пойдёт):
						</p>
						<ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
							{missing.map(m => (
								<li key={m.profileUid}>
									Анкета {m.profileName} (ID {m.profileUid})
								</li>
							))}
						</ul>
					</div>
				)}

				{loadingProfiles && (
					<p className="text-gray-600 dark:text-gray-400 text-center py-8">
						Загрузка анкет аккаунта...
					</p>
				)}

				{!loadingProfiles && loadError && (
					<p className="text-red-600 dark:text-red-400 text-center py-4">{loadError}</p>
				)}

				{!loadingProfiles && !loadError && (
					<>
						{/* ===== CHAT секция ===== */}
						<div className="border border-light-border dark:border-dark-border rounded-lg p-3 sm:p-4">
							<h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
								CHAT
							</h3>
							<TemplateSettings
								value={chatSettings}
								onChange={setChatSettings}
								maxLimit={MAX_CHAT_LIMIT}
							/>

							<div className="mt-4 space-y-3">
								<h4 className="text-sm font-medium text-gray-900 dark:text-white">
									Сообщения по анкетам:
								</h4>
								{chatProfiles.map(profile => (
									<div
										key={profile.profileUid}
										className="border border-light-border dark:border-dark-border rounded-lg p-3 bg-white dark:bg-dark-bg"
									>
										<ProfileHeader profile={profile} />
										<div className="mt-2 space-y-2">
											{profile.messages.map((m, index) => (
												<div key={index} className="flex flex-col sm:flex-row gap-2">
													<input
														type="text"
														value={m.text}
														onChange={e =>
															updateChatMessage(profile.profileUid, index, 'text', e.target.value)
														}
														placeholder={`Сообщение ${index + 1}`}
														className="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
													/>
													<input
														type="number"
														value={m.interval}
														onChange={e =>
															updateChatMessage(profile.profileUid, index, 'interval', e.target.value)
														}
														placeholder="Интервал (сек)"
														min="0"
														className="w-full sm:w-28 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
													/>
													{profile.messages.length > 1 && (
														<button
															type="button"
															onClick={() => removeChatMessage(profile.profileUid, index)}
															className="px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
														>
															✖
														</button>
													)}
												</div>
											))}
										</div>
										<button
											type="button"
											onClick={() => addChatMessage(profile.profileUid)}
											disabled={profile.messages.length >= MAX_MESSAGES}
											className={`mt-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
												profile.messages.length >= MAX_MESSAGES
													? 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
													: 'border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-light-hover dark:hover:bg-dark-hover'
											}`}
										>
											+ Добавить сообщение
										</button>
									</div>
								))}
							</div>
						</div>

						{/* ===== MAIL секция ===== */}
						<div className="border border-light-border dark:border-dark-border rounded-lg p-3 sm:p-4">
							<h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
								MAIL
							</h3>
							<TemplateSettings
								value={mailSettings}
								onChange={setMailSettings}
								maxLimit={MAX_MAIL_LIMIT}
							/>

							<div className="mt-4 space-y-3">
								<h4 className="text-sm font-medium text-gray-900 dark:text-white">
									Письма по анкетам:
								</h4>
								{mailProfiles.map(profile => (
									<div
										key={profile.profileUid}
										className="border border-light-border dark:border-dark-border rounded-lg p-3 bg-white dark:bg-dark-bg"
									>
										<ProfileHeader profile={profile} />
										<div className="mt-2 space-y-2">
											<input
												type="text"
												value={profile.title}
												onChange={e => updateMail(profile.profileUid, 'title', e.target.value)}
												placeholder="Заголовок"
												className={inputClass}
											/>
											<textarea
												value={profile.text}
												onChange={e => updateMail(profile.profileUid, 'text', e.target.value)}
												placeholder="Текст письма (150-3500 символов)"
												rows={3}
												className={`${inputClass} resize-y`}
											/>
											<div className="flex items-center justify-between">
												<span className="text-xs text-gray-500 dark:text-gray-400">
													{profile.text.length} / 3500
												</span>
											</div>
											<input
												type="text"
												value={profile.picturesNumber}
												onChange={e => updateMail(profile.profileUid, 'picturesNumber', e.target.value)}
												placeholder="Картинки: 1, 2, 3"
												className={inputClass}
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					</>
				)}

				{/* Кнопки */}
				{!loadingProfiles && !loadError && (
					<div className="flex flex-col sm:flex-row gap-2 pt-2">
						<button
							onClick={handleSave}
							disabled={saving || applying}
							className="flex-1 py-3 px-6 rounded-lg font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{saving ? 'Сохранение...' : 'Сохранить'}
						</button>

						{currentTemplateId && (
							<button
								onClick={handleApply}
								disabled={applying || saving}
								className="flex-1 py-3 px-6 rounded-lg font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{applying ? 'Добавление...' : 'Добавить на рассылку →'}
							</button>
						)}
					</div>
				)}
			</div>
		</Modal>
	);
};

export default TemplateEditor;
