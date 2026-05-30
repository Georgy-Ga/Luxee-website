// Конфигурация браузера

const browserConfig = {
	// Видимый режим браузера (false = видимый, true = скрытый)
	// В production автоматически включается headless режим
	headless: process.env.BROWSER_HEADLESS === 'true' 
		|| process.env.NODE_ENV === 'production' 
		|| false,
	
	// Замедление действий в миллисекундах (чтобы видеть что происходит)
	// 0 = без замедления, 100-500 = комфортно для просмотра
	// В production отключаем замедление для производительности
	slowMo: process.env.NODE_ENV === 'production' 
		? 0 
		: (parseInt(process.env.BROWSER_SLOW_MO) || 150),
	
	// Дополнительные опции
	devtools: process.env.BROWSER_DEVTOOLS === 'true' || false, // Открывать DevTools
};

export default browserConfig;
