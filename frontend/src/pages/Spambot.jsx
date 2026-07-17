import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { luxeeApi } from '../api/luxeeApi';
import { spambotApi } from '../api/spambotApi';
import Header from '../components/layout/Header';
import { useSocket } from '../contexts/SocketContext';
import AccountSelector from '../components/Spambot/AccountSelector';
import ProfileSelector from '../components/Spambot/ProfileSelector';
import DistributionForm from '../components/Spambot/DistributionForm';
import DistributionQueue from '../components/Spambot/DistributionQueue';
import DistributionHistory from '../components/Spambot/DistributionHistory';

/**
 * Spambot Page - Массовые рассылки
 */
const Spambot = () => {
	const { socket, isConnected } = useSocket();
	
	// State
	const [selectedAccount, setSelectedAccount] = useState(null);
	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profiles, setProfiles] = useState([]);
	const [loadingProfiles, setLoadingProfiles] = useState(false);
	const [activeDistribution, setActiveDistribution] = useState(null);
	const [distributionHistory, setDistributionHistory] = useState([]);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [startingDistribution, setStartingDistribution] = useState(false);

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
			localStorage.setItem('spambot_queue', JSON.stringify(queuedDistributions));
		} catch (error) {
			console.error('[Spambot] Error saving queue to localStorage:', error);
		}
	}, [queuedDistributions]);

	// Загрузка аккаунтов
	const { data: accounts = [], isLoading: accountsLoading } = useQuery({
		queryKey: ['luxee-accounts'],
		queryFn: luxeeApi.getAccounts,
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
				const timestamp = localStorage.getItem(`spambot_profiles_timestamp_${accountId}`);

				if (cached && timestamp) {
					const age = Date.now() - parseInt(timestamp);
					if (age < CACHE_TTL) {
						console.log('[Spambot] ✅ Loading profiles from cache');
						setProfiles(JSON.parse(cached));
						
						// Восстановить последний выбранный профиль
						try {
							const savedProfile = localStorage.getItem(`spambot_selected_profile_${accountId}`);
							if (savedProfile) {
								const profile = JSON.parse(savedProfile);
								const cachedProfiles = JSON.parse(cached);
								const exists = cachedProfiles.find(p => p.uid === profile.uid);
								if (exists) {
									setSelectedProfile(exists);
									console.log('[Spambot] ✅ Restored selected profile:', profile.name);
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
			const data = await spambotApi.getProfiles(accountId);
			setProfiles(data);

			// Сохранить в кэш
			try {
				localStorage.setItem(`spambot_profiles_${accountId}`, JSON.stringify(data));
				localStorage.setItem(`spambot_profiles_timestamp_${accountId}`, Date.now().toString());
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
		setLoadingHistory(true);
		try {
			const data = await spambotApi.getDistributions({ limit: 20 });
			setDistributionHistory(data);
		} catch (error) {
			console.error('[Spambot] Error loading history:', error);
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
					JSON.stringify(selectedProfile)
				);
			} catch (error) {
				console.error('[Spambot] Error saving selected profile:', error);
			}
		}
	}, [selectedProfile, selectedAccount]);

	// Добавить рассылку в очередь
	const handleAddToQueue = (config) => {
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

		// Очистить выбранный профиль для следующей рассылки
		setSelectedProfile(null);

		// Показать уведомление
		console.log('[Spambot] Distribution added to queue:', distribution);
	};

	// Удалить рассылку из очереди
	const handleRemoveFromQueue = (id) => {
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
				console.log(`[Spambot] Starting distribution for profile ${dist.profile.uid}...`);
				console.log('[Spambot] Account ID:', dist.account._id);
				console.log('[Spambot] Config:', JSON.stringify(dist.config, null, 2));
				
				// ИСПРАВЛЕНО: передаём как объект, а не два параметра
				await spambotApi.createDistribution({
					accountId: dist.account._id,
					config: dist.config
				});
			}

			// Очистить очередь после успешного запуска
			setQueuedDistributions([]);

			// История обновится через WebSocket
		} catch (error) {
			console.error('[Spambot] Error starting distributions:', error);
			console.error('[Spambot] Error details:', error.response?.data);
			alert(error.response?.data?.message || error.message || 'Ошибка при запуске рассылок');
		} finally {
			setStartingDistribution(false);
		}
	};

	// Остановка рассылки
	const handleStopDistribution = async (distributionId) => {
		try {
			await spambotApi.stopDistribution(distributionId);
			// История обновится через WebSocket
		} catch (error) {
			console.error('[Spambot] Error stopping distribution:', error);
			alert(error.message || 'Ошибка при остановке рассылки');
		}
	};

	// WebSocket - Real-time обновление статуса рассылки
	useEffect(() => {
		if (!socket || !isConnected) return;

		const handleDistributionStatus = (data) => {
			console.log('[Spambot] Distribution status update:', data);
			
			if (activeDistribution && data.distributionId === activeDistribution.distributionId) {
				setActiveDistribution(prev => ({ ...prev, ...data }));
			}
			
			loadDistributionHistory();
		};

		const handleDistributionStarted = (data) => {
			console.log('[Spambot] Distribution started:', data);
			setActiveDistribution(data);
			loadDistributionHistory();
		};

		const handleDistributionCompleted = (data) => {
			console.log('[Spambot] Distribution completed:', data);
			if (activeDistribution && data.distributionId === activeDistribution.distributionId) {
				setActiveDistribution(null);
			}
			loadDistributionHistory();
		};

		const handleDistributionStopped = (data) => {
			console.log('[Spambot] Distribution stopped:', data);
			if (activeDistribution && data.distributionId === activeDistribution.distributionId) {
				setActiveDistribution(null);
			}
			loadDistributionHistory();
		};

		const handleDistributionError = (data) => {
			console.error('[Spambot] Distribution error:', data);
			if (activeDistribution && data.distributionId === activeDistribution.distributionId) {
				setActiveDistribution(prev => ({ ...prev, status: 'error', errorMessage: data.errorMessage }));
			}
			loadDistributionHistory();
		};

		socket.on('spambot:distribution:status', handleDistributionStatus);
		socket.on('spambot:distribution:started', handleDistributionStarted);
		socket.on('spambot:distribution:completed', handleDistributionCompleted);
		socket.on('spambot:distribution:stopped', handleDistributionStopped);
		socket.on('spambot:distribution:error', handleDistributionError);

		return () => {
			socket.off('spambot:distribution:status', handleDistributionStatus);
			socket.off('spambot:distribution:started', handleDistributionStarted);
			socket.off('spambot:distribution:completed', handleDistributionCompleted);
			socket.off('spambot:distribution:stopped', handleDistributionStopped);
			socket.off('spambot:distribution:error', handleDistributionError);
		};
	}, [socket, isConnected, activeDistribution]);

	return (
		<div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg">
			<Header />
			
			<div className="flex-1 overflow-auto p-4 lg:p-6">
				<div className="max-w-7xl mx-auto space-y-6">
					{/* Заголовок */}
					<div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
							Массовые рассылки
						</h2>
						<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
							Отправка сообщений клиентам в чат или почту
						</p>
					</div>

					{/* 2-колоночный layout: Форма слева, Очередь справа */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Левая колонка: Форма настройки */}
						<div className="space-y-6">
							{/* Шаг 1: Выбор аккаунта */}
							<AccountSelector
								accounts={accounts}
								selectedAccount={selectedAccount}
								onSelect={setSelectedAccount}
								loading={accountsLoading}
							/>

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
						<div className="lg:sticky lg:top-6 lg:self-start">
							<DistributionQueue
								distributions={queuedDistributions}
								onStart={handleStartAllDistributions}
								onRemove={handleRemoveFromQueue}
								loading={startingDistribution}
							/>
						</div>
					</div>

					{/* История рассылок (полная ширина внизу) */}
					<DistributionHistory
						distributions={distributionHistory}
						loading={loadingHistory}
						onStop={handleStopDistribution}
					/>
				</div>
			</div>
		</div>
	);
};

export default Spambot;
