import { useState } from 'react';
import { aiApi } from '../api/aiApi';
import Header from '../components/Header';

const AiTest = () => {
	const [profile, setProfile] = useState({
		username: 'Maria',
		age: 25,
		country: 'Ukraine',
		city: 'Kyiv',
		bio: 'I love traveling and meeting new people',
	});

	const [message, setMessage] = useState('');
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	// Отправка тестового сообщения
	const handleSendTest = async () => {
		if (!message.trim()) {
			setError('Введите сообщение');
			return;
		}

		setLoading(true);
		setError('');

		try {
			const response = await aiApi.testResponse({
				profile,
				message,
				history,
			});

			// Добавляем сообщение мужчины и ответ AI в историю
			const newHistory = [
				...history,
				{ from: 'man', body: message },
				{ from: 'woman', body: response.response },
			];

			setHistory(newHistory);
			setMessage('');
		} catch (err) {
			console.error('Error testing AI:', err);
			setError(err.response?.data?.error || 'Ошибка при генерации ответа');
		} finally {
			setLoading(false);
		}
	};

	// Очистка истории
	const handleClearHistory = () => {
		setHistory([]);
		setError('');
	};

	return (
		<div className="min-h-screen bg-light-bg dark:bg-dark-bg">
			<Header />
			<div className="max-w-6xl mx-auto p-6">
				<div className="mb-6">
					<h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
						AI Test
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Тестирование ответов нейросети с учетом всех правил
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Левая колонка - Профиль */}
					<div>
						{/* Профиль девушки */}
						<div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6">
							<h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
								👤 Профиль девушки
							</h2>
							<div className="space-y-3">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Имя
									</label>
									<input
										type="text"
										value={profile.username}
										onChange={e => setProfile({ ...profile, username: e.target.value })}
										className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Возраст
									</label>
									<input
										type="number"
										value={profile.age}
										onChange={e => setProfile({ ...profile, age: parseInt(e.target.value) })}
										className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Страна
									</label>
									<input
										type="text"
										value={profile.country}
										onChange={e => setProfile({ ...profile, country: e.target.value })}
										className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Город
									</label>
									<input
										type="text"
										value={profile.city}
										onChange={e => setProfile({ ...profile, city: e.target.value })}
										className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-800 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										О себе
									</label>
									<textarea
										value={profile.bio}
										onChange={e => setProfile({ ...profile, bio: e.target.value })}
										rows={3}
										className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-800 dark:text-white"
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Правая колонка - Чат */}
					<div>
						{/* История чата */}
						<div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-xl font-semibold text-gray-800 dark:text-white">💬 История чата</h2>
								{history.length > 0 && (
									<button
										onClick={handleClearHistory}
										className="text-sm text-red-600 dark:text-red-400 hover:underline"
									>
										Очистить
									</button>
								)}
							</div>

							<div className="space-y-3 max-h-96 overflow-y-auto mb-4">
								{history.length === 0 ? (
									<div className="text-center text-gray-500 dark:text-gray-400 py-8">
										История пуста. Отправьте первое сообщение.
									</div>
								) : (
									history.map((msg, index) => (
										<div
											key={index}
											className={`flex ${msg.from === 'man' ? 'justify-end' : 'justify-start'}`}
										>
											<div
												className={`max-w-[70%] px-4 py-2 rounded-lg ${
													msg.from === 'man'
														? 'bg-blue-500 text-white'
														: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
												}`}
											>
												<div className="text-xs mb-1 opacity-75">
													{msg.from === 'man' ? '👨 Мужчина' : '👩 ' + profile.username}
												</div>
												<div className="whitespace-pre-wrap">{msg.body}</div>
											</div>
										</div>
									))
								)}
							</div>

							{/* Ввод сообщения */}
							<div className="space-y-3">
								<textarea
									value={message}
									onChange={e => setMessage(e.target.value)}
									onKeyPress={e => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											handleSendTest();
										}
									}}
									placeholder="Введите сообщение от мужчины..."
									rows={3}
									className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-800 dark:text-white resize-none"
									disabled={loading}
								/>

								{error && (
									<div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
								)}

								<button
									onClick={handleSendTest}
									disabled={loading || !message.trim()}
									className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
								>
									{loading ? '⏳ Генерация ответа...' : '🚀 Отправить и получить ответ AI'}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AiTest;
