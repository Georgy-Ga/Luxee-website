import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { luxeeApi } from '../api/luxeeApi';
import { spambotApi } from '../api/spambotApi';
import Header from '../components/layout/Header';
import AccountSelector from '../components/Spambot/AccountSelector';
import AdminAccountSelector from '../components/Spambot/AdminAccountSelector';
import DistributionForm from '../components/Spambot/DistributionForm';
import DistributionHistory from '../components/Spambot/DistributionHistory';
import DistributionQueue from '../components/Spambot/DistributionQueue';
import ProfileSelector from '../components/Spambot/ProfileSelector';
import TemplateEditor from '../components/Spambot/TemplateEditor';
import TemplatePickerModal from '../components/Spambot/TemplatePickerModal';
import Modal from '../components/ui/Modal';
import { useSocket } from '../contexts/SocketContext';
import useAuthStore from '../stores/authStore';

/**
 * Spambot Page - Массовые рассылки
 */
const Spambot = () => {
	const { socket, isConnected } = useSocket();
	const { user } = useAuthStore();
	const isAdmin = user?.role === 'admin';

	// State
	const [selectedAccount, setSelectedAccount] = useState(null);
	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profiles, setProfiles] = useState([]);
	const [loadingProfiles, setLoadingProfiles] = useState(false);
	const [activeDistribution, setActiveDistribution] = useState(null);
	const [distributionHistory, setDistributionHistory] = useState([]);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [startingDistribution, setStartingDistribution] = useState(false);

	// Шаблоны рассылок
	const [templateCounts, setTemplateCounts] = useState({});
	const [templatePickerAccount, setTemplatePickerAccount] = useState(null);
	const [showCreateTemplate, setShowCreateTemplate] = useState(false);
	const [templateEditor, setTemplateEditor] = useState(null); // { account, templateId }

	// Очередь рассылок (с сохранением в localStorage)
	const [queuedDistributions, setQueuedDistributions] = useState(() => {
		try {
			const saved = localStorage.getItem('spambot_queue');
			return saved ? JSON.parse(saved) : [];
		} catch (error) {
			console.error('[Spambot] Error loading queue from localStorage:', error);
			return [];
		}
	});

	// Сохранять очередь в localStorage при изменении
	useEffect(() => {
		try {
			localStorage.setItem(
				'spambot_queue',
				JSON.stringify(queuedDistributions),
			);
		} catch (error) {
			console.error('[Spambot] Error saving queue to localStorage:', error);
		}
	}, [queuedDistributions]);

	// Загрузка аккаунтов (разная логика для админа и пользователя)
	const {
		data: accounts = [],
		isLoading: accountsLoading,
		refetch: refetchAccounts,
	} = useQuery({
		queryKey: ['spambot-accounts', isAdmin],
		queryFn: async () => {
			if (isAdmin) {
				// Админ получает все аккаунты сгруппированные по пользователям
				return await spambotApi.getAdminAccounts();
			} else {
				// Обычный пользователь получает только свои аккаунты
				return await luxeeApi.getAccounts();
			}
		},
	});

	// Загрузка профилей при выборе аккаунта
	useEffect(() => {
		if (selectedAccount) {
			loadProfiles(false); // false = использовать кэш
		} else {
			setProfiles([]);
			setSelectedProfile(null);
		}
	}, [selectedAccount]);

	const loadProfiles = async (forceReload = false) => {
		if (!selectedAccount) return;

		const accountId = selectedAccount._id;
		const CACHE_TTL = 30 * 60 * 1000; // 30 минут

		// Проверить кэш (только если не принудительная загрузка)
		if (!forceReload) {
			try {
				const cached = localStorage.getItem(`spambot_profiles_${accountId}`);
				const timestamp = localStorage.getItem(
					`spambot_profiles_timestamp_${accountId}`,
				);

				if (cached && timestamp) {
					const age = Date.now() - parseInt(timestamp);
					if (age < CACHE_TTL) {
						console.log('[Spambot] ✅ Loading profiles from cache');
						setProfiles(JSON.parse(cached));

						// Восстановить последний выбранный профиль
						try {
							const savedProfile = localStorage.getItem(
								`spambot_selected_profile_${accountId}`,
							);
							if (savedProfile) {
								const profile = JSON.parse(savedProfile);
								const cachedProfiles = JSON.parse(cached);
								const exists = cachedProfiles.find(p => p.uid === profile.uid);
								if (exists) {
									setSelectedProfile(exists);
									console.log(
										'[Spambot] ✅ Restored selected profile:',
										profile.name,
									);
								}
							}
						} catch (e) {
							console.error('[Spambot] Error restoring selected profile:', e);
						}

						return;
					} else {
						console.log('[Spambot] ⏰ Cache expired, reloading...');
					}
				}
			} catch (error) {
				console.error('[Spambot] Error reading cache:', error);
			}
		} else {
			console.log('[Spambot] 🔄 Force reload profiles (ignoring cache)');
		}

		// Загрузить с сервера
		setLoadingProfiles(true);
		try {
			console.log('[Spambot] 📡 Loading profiles from server...');
			// Админ использует admin endpoint, пользователь - обычный
			const data = isAdmin
				? await spambotApi.getAdminProfiles(accountId)
				: await spambotApi.getProfiles(accountId);
			setProfiles(data);

			// Сохранить в кэш
			try {
				localStorage.setItem(
					`spambot_profiles_${accountId}`,
					JSON.stringify(data),
				);
				localStorage.setItem(
					`spambot_profiles_timestamp_${accountId}`,
					Date.now().toString(),
				);
				console.log('[Spambot] ✅ Profiles cached');
			} catch (error) {
				console.error('[Spambot] Error caching profiles:', error);
			}
		} catch (error) {
			console.error('[Spambot] Error loading profiles:', error);
		} finally {
			setLoadingProfiles(false);
		}
	};

	// Очистить кэш профилей и сбросить выбор
	const handleClearProfiles = () => {
		if (!selectedAccount) return;

		const accountId = selectedAccount._id;

		// Удалить кэш
		localStorage.removeItem(`spambot_profiles_${accountId}`);
		localStorage.removeItem(`spambot_profiles_timestamp_${accountId}`);
		localStorage.removeItem(`spambot_selected_profile_${accountId}`);

		// Очистить состояние
		setProfiles([]);
		setSelectedProfile(null);

		console.log('[Spambot] ✅ Cache cleared');
	};

	// Загрузка истории рассылок
	useEffect(() => {
		loadDistributionHistory();
	}, []);

	const loadDistributionHistory = async () => {
		console.log('[Spambot] 📚 Loading distribution history...');
		setLoadingHistory(true);
		try {
			const data = await spambotApi.getDistributions({ limit: 100 });
			console.log(`[Spambot] ✅ Loaded ${data.length} distributions`);
			if (data.length > 0) {
				console.log(
					'[Spambot] 📊 First distribution:',
					JSON.stringify(data[0], null, 2),
				);
			}
			setDistributionHistory(data);
		} catch (error) {
			console.error('[Spambot] ❌ Error loading history:', error);
		} finally {
			setLoadingHistory(false);
		}
	};

	// Сохранить выбранный профиль в localStorage
	useEffect(() => {
		if (selectedAccount && selectedProfile) {
			try {
				localStorage.setItem(
					`spambot_selected_profile_${selectedAccount._id}`,
					JSON.stringify(selectedProfile),
				);
			} catch (error) {
				console.error('[Spambot] Error saving selected profile:', error);
			}
		}
	}, [selectedProfile, selectedAccount]);

	// Загрузка счётчиков шаблонов по аккаунтам (для бейджей на Шаге 1)
	const loadTemplateCounts = async () => {
		try {
			const counts = await spambotApi.getTemplateCounts();
			setTemplateCounts(counts || {});
		} catch (error) {
			console.error('[Spambot] Error loading template counts:', error);
		}
	};

	useEffect(() => {
		loadTemplateCounts();
	}, []);

	// Добавить рассылку в очередь
	const handleAddToQueue = config => {
		if (!selectedAccount || !selectedProfile) {
			alert('Выберите аккаунт и профиль');
			return;
		}

		const distribution = {
			id: Date.now(), // Временный ID для UI
			profile: selectedProfile,
			account: selectedAccount,
			config: config,
		};

		setQueuedDistributions(prev => [...prev, distribution]);

		// НЕ очищаем selectedProfile - оставляем форму на месте
		// Пользователь может добавить еще одну рассылку с тем же профилем

		// Показать уведомление
		console.log('[Spambot] Distribution added to queue:', distribution);
	};

	// Удалить рассылку из локальной UI очереди
	const handleRemoveFromLocalQueue = id => {
		setQueuedDistributions(prev => prev.filter(d => d.id !== id));
	};

	// Запустить все рассылки из очереди
	const handleStartAllDistributions = async () => {
		if (queuedDistributions.length === 0) {
			alert('Очередь пуста');
			return;
		}

		setStartingDistribution(true);

		try {
			// Запустить все рассылки последовательно
			for (const dist of queuedDistributions) {
				console.log(
					`[Spambot] Starting distribution for profile ${dist.profile.uid}...`,
				);
				console.log('[Spambot] Account ID:', dist.account._id);
				console.log('[Spambot] Config:', JSON.stringify(dist.config, null, 2));

				// ИСПРАВЛЕНО: передаём как объект, а не два параметра
				await spambotApi.createDistribution({
					accountId: dist.account._id,
					config: dist.config,
				});
			}

			// Очистить очередь после успешного запуска
			setQueuedDistributions([]);

			// История обновится через WebSocket
		} catch (error) {
			console.error('[Spambot] Error starting distributions:', error);
			console.error('[Spambot] Error details:', error.response?.data);
			alert(
				error.response?.data?.message ||
					error.message ||
					'Ошибка при запуске рассылок',
			);
		} finally {
			setStartingDistribution(false);
		}
	};

	// Остановка рассылки
	const handleStopDistribution = async distributionId => {
		try {
			console.log(`[Spambot] 🛑 Stopping distribution: ${distributionId}`);
			console.log(`[Spambot] 🛑 Current history:`, distributionHistory);

			const result = await spambotApi.stopDistribution(distributionId);

			console.log(`[Spambot] ✅ Stop result:`, result);
			console.log(`[Spambot] ✅ Waiting for WebSocket update...`);
			// История обновится через WebSocket
		} catch (error) {
			console.error('[Spambot] ❌ Error stopping distribution:', error);
			console.error('[Spambot] ❌ Error details:', {
				message: error.message,
				response: error.response?.data,
				status: error.response?.status,
			});
			alert(`Ошибка остановки рассылки: ${error.message}`);
		}
	};

	// Удаление рассылки из очереди
	const handleRemoveFromQueue = async distributionId => {
		try {
			console.log(`[Spambot] 🗑️  Removing from queue: ${distributionId}`);

			const result = await spambotApi.deleteDistribution(distributionId);

			console.log(`[Spambot] ✅ Remove result:`, result);

			// Удалить из истории локально (или дождаться WebSocket)
			setDistributionHistory(prev =>
				prev.filter(d => d._id !== distributionId && d.id !== distributionId),
			);
		} catch (error) {
			console.error('[Spambot] ❌ Error removing distribution:', error);
			console.error('[Spambot] ❌ Error details:', {
				message: error.message,
				response: error.response?.data,
				status: error.response?.status,
			});
			alert(
				`Ошибка удаления рассылки: ${error.response?.data?.message || error.message}`,
			);
		}
	};

	// WebSocket - Real-time обновление статуса рассылки
	useEffect(() => {
		if (!socket || !isConnected) return;

		// Обновление ТОЛЬКО лимитов анкет выбранного аккаунта (без перезагрузки всего списка).
		// Используется после завершения/остановки рассылки, чтобы не дёргать полную загрузку профилей.
		const refreshProfilesLimits = async () => {
			if (!selectedAccount) return;

			try {
				const limits = isAdmin
					? await spambotApi.getAdminProfileLimits(selectedAccount._id)
					: await spambotApi.getProfileLimits(selectedAccount._id);

				if (!limits) return;

				// Вспомогательная проверка: есть ли у лимита реальные данные (max/count).
				const hasRealLimits = data => {
					if (!data) return false;
					const chat = data.chat;
					const mail = data.mail;
					return (
						(chat && typeof chat.max === 'number') ||
						(mail && typeof mail.max === 'number')
					);
				};

				setProfiles(prev =>
					prev.map(p => {
						const l = limits[p.owner_uid];
						// Обновляем только если сервер вернул реальные данные (есть max/count).
						// Пустой {} или "no information" НЕ затирают уже имеющиеся лимиты анкеты.
						if (!hasRealLimits(l)) return p;
						return { ...p, limits: l };
					}),
				);

				// Обновить лимиты в кэше localStorage, не трогая остальные поля анкет
				try {
					const cacheKey = `spambot_profiles_${selectedAccount._id}`;
					const cached = localStorage.getItem(cacheKey);
					if (cached) {
						const updated = JSON.parse(cached).map(p => {
							const l = limits[p.owner_uid];
							// Аналогично: пустой {} или "no information" не затирают кэш
							return hasRealLimits(l) ? { ...p, limits: l } : p;
						});
						localStorage.setItem(cacheKey, JSON.stringify(updated));
					}
				} catch (e) {
					console.error('[Spambot] Error caching limits:', e);
				}

				console.log('[Spambot] ✅ Profiles limits refreshed');
			} catch (error) {
				console.error('[Spambot] ❌ Error refreshing profiles limits:', error);
			}
		};

		const handleDistributionStatus = data => {
			console.log('[Spambot] Distribution status update:', data);

			// Обновить активную рассылку
			if (
				activeDistribution &&
				data.distributionId === activeDistribution.distributionId
			) {
				setActiveDistribution(prev => ({ ...prev, ...data }));
			}

			// Обновить в истории (без перезагрузки всей истории)
			setDistributionHistory(prev =>
				prev.map(dist =>
					dist.distributionId === data.distributionId
						? { ...dist, ...data }
						: dist,
				),
			);
		};

		const handleDistributionStarted = data => {
			console.log('[Spambot] Distribution started:', data);
			setActiveDistribution(data);

			// ✅ FIX: Поиск по нескольким критериям для связи записей
			// 1. По distributionId (новый UUID от Python)
			// 2. По oldDistributionId (временный ID если запуск из очереди)
			// 3. По MongoDB _id
			setDistributionHistory(prev => {
				const existingIndex = prev.findIndex(d => 
					d.distributionId === data.distributionId || // Обычное совпадение
					d.distributionId === data.oldDistributionId || // Старый временный ID
					(d.id && data.id && d.id === data.id) // По MongoDB _id
				);
				
				if (existingIndex !== -1) {
					// Обновляем существующую запись
					const updated = [...prev];
					updated[existingIndex] = {
						...updated[existingIndex],
						...data,
					};
					console.log('[Spambot] ✅ Updated existing distribution at index', existingIndex);
					return updated;
				}
				
				// Добавляем новую запись только если не нашли существующую
				console.log('[Spambot] ➕ Adding new distribution to history');
				return [data, ...prev];
			});
		};

		const handleDistributionCompleted = data => {
			console.log('[Spambot] Distribution completed:', data);

			// Сбросить активную если это она
			if (
				activeDistribution &&
				data.distributionId === activeDistribution.distributionId
			) {
				setActiveDistribution(null);
			}

			// Обновить в истории
			setDistributionHistory(prev =>
				prev.map(dist =>
					dist.distributionId === data.distributionId
						? { ...dist, ...data, status: 'completed' }
						: dist,
				),
			);

			// Лимиты расходуются рассылкой - обновляем только лимиты без полной перезагрузки
			refreshProfilesLimits();
		};

		const handleDistributionStopped = data => {
			console.log('[Spambot] Distribution stopped:', data);

			// Сбросить активную если это она
			if (
				activeDistribution &&
				data.distributionId === activeDistribution.distributionId
			) {
				setActiveDistribution(null);
			}

			// Обновить в истории
			setDistributionHistory(prev =>
				prev.map(dist =>
					dist.distributionId === data.distributionId
						? { ...dist, ...data, status: 'stopped' }
						: dist,
				),
			);

			// При остановке лимиты могли сдвинуться - обновляем только лимиты
			refreshProfilesLimits();
		};

		const handleDistributionError = data => {
			console.error('[Spambot] Distribution error:', data);

			// Обновить активную
			if (
				activeDistribution &&
				data.distributionId === activeDistribution.distributionId
			) {
				setActiveDistribution(prev => ({
					...prev,
					status: 'error',
					errorMessage: data.errorMessage,
				}));
			}

			// Обновить в истории
			setDistributionHistory(prev =>
				prev.map(dist =>
					dist.distributionId === data.distributionId
						? { ...dist, ...data, status: 'error' }
						: dist,
				),
			);

			// При ошибке лимиты могли не измениться, но подстрахуемся свежими данными
			refreshProfilesLimits();
		};

		// ✅ NEW: Обработчик добавления в очередь
		const handleDistributionQueued = data => {
			console.log('[Spambot] Distribution queued:', data);

			// Добавить в начало истории
			setDistributionHistory(prev => {
				// Проверить если уже есть
				const exists = prev.find(
					d => d.distributionId === data.distributionId || d.id === data.id,
				);
				if (exists) {
					// Обновить существующую
					return prev.map(d =>
						d.distributionId === data.distributionId || d.id === data.id
							? { ...d, ...data }
							: d,
					);
				}
				// Добавить новую
				return [data, ...prev];
			});
		};

		// ✅ NEW: Обработчик удаления из очереди
		const handleDistributionRemoved = data => {
			console.log('[Spambot] Distribution removed:', data);

			// Удалить из истории
			setDistributionHistory(prev =>
				prev.filter(
					dist =>
						dist.distributionId !== data.distributionId && dist.id !== data.id,
				),
			);
		};

		socket.on('spambot:distribution:status', handleDistributionStatus);
		socket.on('spambot:distribution:started', handleDistributionStarted);
		socket.on('spambot:distribution:completed', handleDistributionCompleted);
		socket.on('spambot:distribution:stopped', handleDistributionStopped);
		socket.on('spambot:distribution:error', handleDistributionError);
		socket.on('spambot:distribution:queued', handleDistributionQueued);
		socket.on('spambot:distribution:removed', handleDistributionRemoved);

		return () => {
			socket.off('spambot:distribution:status', handleDistributionStatus);
			socket.off('spambot:distribution:started', handleDistributionStarted);
			socket.off('spambot:distribution:completed', handleDistributionCompleted);
			socket.off('spambot:distribution:stopped', handleDistributionStopped);
			socket.off('spambot:distribution:error', handleDistributionError);
			socket.off('spambot:distribution:queued', handleDistributionQueued);
			socket.off('spambot:distribution:removed', handleDistributionRemoved);
		};
	}, [socket, isConnected, activeDistribution, selectedAccount]);

	// WebSocket - Обновление списка аккаунтов при создании нового (для админа)
	useEffect(() => {
		if (!socket || !isConnected || !isAdmin) return;

		const handleAccountCreated = data => {
			console.log('[Spambot] New account created:', data);
			// Обновить список аккаунтов
			refetchAccounts();
			loadTemplateCounts();
		};

		socket.on('luxee:account:created', handleAccountCreated);

		return () => {
			socket.off('luxee:account:created', handleAccountCreated);
		};
	}, [socket, isConnected, isAdmin, refetchAccounts]);

	// WebSocket - Обновление счётчиков шаблонов в реальном времени
	useEffect(() => {
		if (!socket || !isConnected) return;

		const handleTemplateEvent = data => {
			if (!data || !data.account) return;
			setTemplateCounts(prev => ({
				...prev,
				[data.account]: data.templateCount ?? 0,
			}));
		};

		socket.on('spambot:template:created', handleTemplateEvent);
		socket.on('spambot:template:updated', handleTemplateEvent);
		socket.on('spambot:template:deleted', handleTemplateEvent);

		return () => {
			socket.off('spambot:template:created', handleTemplateEvent);
			socket.off('spambot:template:updated', handleTemplateEvent);
			socket.off('spambot:template:deleted', handleTemplateEvent);
		};
	}, [socket, isConnected]);

	return (
		<div className='h-screen flex flex-col bg-light-bg dark:bg-dark-bg'>
			<Header />

			<div className='flex-1 overflow-auto p-3 sm:p-4 lg:p-6'>
				<div className='max-w-7xl mx-auto space-y-4 sm:space-y-6'>
					{/* Заголовок */}
					<div className='bg-light-surface dark:bg-dark-surface rounded-lg p-3 sm:p-4 border border-light-border dark:border-dark-border'>
						<h2 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white'>
							Массовые рассылки
						</h2>
						<p className='text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1'>
							Отправка сообщений клиентам в чат или почту
						</p>
					</div>

					{/* 2-колоночный layout: Форма слева, Очередь справа */}
					<div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 spambot-grid'>
						{/* Левая колонка: Форма настройки */}
						<div className='space-y-4 sm:space-y-6'>
							{/* Шаг 1: Выбор аккаунта (разный UI для админа) */}
							{isAdmin ? (
								<AdminAccountSelector
									usersWithAccounts={accounts}
									selectedAccount={selectedAccount}
									onSelect={setSelectedAccount}
									loading={accountsLoading}
									templateCounts={templateCounts}
									onUseTemplate={setTemplatePickerAccount}
								/>
							) : (
								<AccountSelector
									accounts={accounts}
									selectedAccount={selectedAccount}
									onSelect={setSelectedAccount}
									loading={accountsLoading}
									templateCounts={templateCounts}
									onUseTemplate={setTemplatePickerAccount}
								/>
							)}

							{/* Кнопка «Создать шаблон» (рядом с Шагом 1) */}
							<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-3 sm:p-4 border border-light-border dark:border-dark-border">
								<button
									onClick={() => setShowCreateTemplate(true)}
									className="w-full py-3 px-6 rounded-lg border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors font-medium text-sm sm:text-base"
								>
									+ Создать шаблон
								</button>
							</div>

							{/* Шаг 2: Выбор профиля */}
							<ProfileSelector
								profiles={profiles}
								selectedProfile={selectedProfile}
								onSelect={setSelectedProfile}
								loading={loadingProfiles}
								accountSelected={!!selectedAccount}
								onRefresh={() => loadProfiles(true)}
								onClear={handleClearProfiles}
							/>

							{/* Шаг 3: Форма конфигурации */}
							{selectedProfile && (
								<DistributionForm
									profile={selectedProfile}
									account={selectedAccount}
									onSubmit={handleAddToQueue}
									loading={startingDistribution}
								/>
							)}
						</div>

					{/* Правая колонка: Очередь рассылок */}
					<div>
						<DistributionQueue
							distributions={queuedDistributions}
							onStart={handleStartAllDistributions}
							onRemove={handleRemoveFromLocalQueue}
							loading={startingDistribution}
						/>
					</div>
					</div>

					{/* История рассылок (полная ширина внизу) */}
					<DistributionHistory
						distributions={distributionHistory}
						loading={loadingHistory}
						onStop={handleStopDistribution}
						onRemoveFromQueue={handleRemoveFromQueue}
					/>
				</div>
			</div>

			{/* Модалка выбора шаблона аккаунта */}
			<TemplatePickerModal
				account={templatePickerAccount}
				onClose={() => setTemplatePickerAccount(null)}
				onSelect={template => {
					const account = templatePickerAccount;
					setTemplatePickerAccount(null);
					setTemplateEditor({ account, templateId: template.id });
				}}
				onCreateNew={() => {
					const account = templatePickerAccount;
					setTemplatePickerAccount(null);
					setTemplateEditor({ account, templateId: null });
				}}
			/>

			{/* Модалка выбора аккаунта для создания шаблона */}
			<Modal
				isOpen={showCreateTemplate}
				onClose={() => setShowCreateTemplate(false)}
				title="Создать шаблон — выберите аккаунт"
				size="lg"
				closeOnOverlayClick={false}
			>
				{isAdmin ? (
					<AdminAccountSelector
						usersWithAccounts={accounts}
						selectedAccount={null}
						onSelect={account => {
							setShowCreateTemplate(false);
							setTemplateEditor({ account, templateId: null });
						}}
						loading={accountsLoading}
						title="Выберите аккаунт"
					/>
				) : (
					<AccountSelector
						accounts={accounts}
						selectedAccount={null}
						onSelect={account => {
							setShowCreateTemplate(false);
							setTemplateEditor({ account, templateId: null });
						}}
						loading={accountsLoading}
						title="Выберите аккаунт"
					/>
				)}
			</Modal>

			{/* Редактор шаблона */}
			{templateEditor && (
				<TemplateEditor
					account={templateEditor.account}
					templateId={templateEditor.templateId}
					onClose={() => setTemplateEditor(null)}
					onSaved={() => loadTemplateCounts()}
					onApplied={() => setTemplateEditor(null)}
				/>
			)}
		</div>
	);
};

export default Spambot;
