// AI Controller для тестирования ответов нейросети
import aiService from '../services/aiService/index.js';

class AiController {
	/**
	 * Тестирование ответа AI
	 * POST /api/ai/test
	 * Body: { profile: {...}, message: string, history: [...] }
	 */
	async testAiResponse(req, res, next) {
		try {
			const { profile, message, history } = req.body;

			// Валидация
			if (!profile || !profile.username) {
				return res.status(400).json({ error: 'Profile with username is required' });
			}

			if (!message || message.trim() === '') {
				return res.status(400).json({ error: 'Message is required' });
			}

			console.log('[AI Controller] Testing AI response...');
			console.log('[AI Controller] Profile:', profile.username);
			console.log('[AI Controller] Message:', message);
			console.log('[AI Controller] History length:', history?.length || 0);

			// Генерируем ответ
			const aiResponse = await aiService.testResponse({
				profileData: profile,
				userMessage: message,
				history: history || [],
			});

			console.log('[AI Controller] AI Response generated successfully');

			return res.json({
				success: true,
				response: aiResponse,
				profile: {
					username: profile.username,
					age: profile.age,
					country: profile.country,
					city: profile.city,
				},
			});
		} catch (error) {
			console.error('[AI Controller] Error testing AI:', error);
			next(error);
		}
	}

	/**
	 * Получить системный промпт (для просмотра правил)
	 * GET /api/ai/prompt
	 */
	async getSystemPrompt(req, res, next) {
		try {
			const rules = [
				'НЕ поддерживать темы 18+ - отшучивайся, переводи тему',
				'НЕ поддерживать тему встречи - говори что рано, нужно познакомиться ближе',
				'НЕ давать контактные данные (телефон, почту, соц.сети)',
				'НЕ отправлять голые фото - говори что таких нет',
				'НЕ переходить по ссылкам и НЕ отправлять ссылки',
				'НЕ грубить мужчине - всегда вежливая и дружелюбная',
				'НЕ писать фамилию девушки - только имя',
				'НЕ говорить что получаешь деньги за общение',
				'НЕ просить деньги',
				'НЕ говорить адрес проживания - только страну и город',
				'НЕ искать мужчину в соцсетях/гугл',
				'НЕ искать его компанию/ютуб канал',
				'НЕ отправлять фото с пальцами/листочком/видео с именем',
				'ЗАПРЕЩЕНО общаться на темы педофилии, зоофилии, испражнений',
				'Если говорят что ты фейк - отвечай что это неправда',
				'ВСЕГДА отвечай на сообщения, даже на смайлики',
				'НЕ говори что сайт плохой',
				'НЕ используй имя мужчины часто - используй: dear, honey, sweetheart и т.д.',
			];

			return res.json({
				success: true,
				rules: rules,
				style: [
					'Пиши естественно, как живая девушка',
					'Будь дружелюбной, милой, немного кокетливой',
					'Задавай встречные вопросы, проявляй интерес',
					'Используй эмоджи умеренно',
					'Пиши короткие сообщения (1-3 предложения)',
					'Будь позитивной и открытой',
				],
			});
		} catch (error) {
			console.error('[AI Controller] Error getting prompt:', error);
			next(error);
		}
	}
}

export default new AiController();
