// Конфигурация браузера

const browserConfig = {
	// Видимый режим браузера (false = видимый, true = скрытый)
	// В production и Docker всегда headless режим
	headless: process.env.BROWSER_HEADLESS === 'true' 
		|| process.env.NODE_ENV === 'production' 
		|| process.env.DOCKER === 'true'
		|| false,
	
	// Замедление действий в миллисекундах (чтобы видеть что происходит)
	// 0 = без замедления, 100-500 = комфортно для просмотра
	// В production и Docker отключаем замедление для производительности
	slowMo: (process.env.NODE_ENV === 'production' || process.env.DOCKER === 'true')
		? 0 
		: (parseInt(process.env.BROWSER_SLOW_MO) || 150),
	
	// Дополнительные опции
	// В Docker DevTools не нужны
	devtools: (process.env.DOCKER !== 'true' && process.env.BROWSER_DEVTOOLS === 'true') || false,
};

export default browserConfig;
