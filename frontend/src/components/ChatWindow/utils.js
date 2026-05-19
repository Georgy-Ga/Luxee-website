// Утилиты для ChatWindow

export const decodeHtmlEntities = (text) => {
	if (!text) return text;
	const textarea = document.createElement('textarea');
	textarea.innerHTML = text;
	return textarea.value;
};

export const copyToClipboard = (text) => {
	navigator.clipboard.writeText(text).then(() => {
		console.log(`Скопировано: ${text}`);
	}).catch(err => {
		console.error('Ошибка копирования:', err);
	});
};

export const formatTime = (timestamp) => {
	if (!timestamp) return '';
	const date = new Date(timestamp);
	return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (timestamp) => {
	if (!timestamp) return '';
	const date = new Date(timestamp);
	return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};
