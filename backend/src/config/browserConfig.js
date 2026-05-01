// Конфигурация браузера

const browserConfig = {
	// Видимый режим браузера (false = видимый, true = скрытый)
	headless: process.env.BROWSER_HEADLESS === 'true' || false,
	
	// Замедление действий в миллисекундах (чтобы видеть что происходит)
	// 0 = без замедления, 100-500 = комфортно для просмотра
	slowMo: parseInt(process.env.BROWSER_SLOW_MO) || 150,
	
	// Дополнительные опции
	devtools: process.env.BROWSER_DEVTOOLS === 'true' || false, // Открывать DevTools
};

export default browserConfig;
