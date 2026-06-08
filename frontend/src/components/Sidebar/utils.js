/**
 * Утилиты для Sidebar компонентов
 */

// Функция для декодирования HTML entities
export const decodeHtmlEntities = (text) => {
	if (!text) return text;
	const textarea = document.createElement('textarea');
	textarea.innerHTML = text;
	return textarea.value;
};

// Функция для копирования в буфер обмена (БЕЗ alert!)
export const copyToClipboard = (text) => {
	return navigator.clipboard.writeText(text).then(() => {
		console.log(`Скопировано: ${text}`);
		return true;
	}).catch(err => {
		console.error('Ошибка копирования:', err);
		return false;
	});
};
