import { useState } from 'react';

const MessageInput = ({ onSend, isSending }) => {
	const [message, setMessage] = useState('');

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!message.trim() || isSending) return;
		
		onSend(message);
		setMessage('');
	};

	const handleKeyDown = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-600">
			<div className="flex gap-2">
				<textarea
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Введите сообщение... (Enter для отправки, Shift+Enter для новой строки)"
					className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
					rows="3"
					disabled={isSending}
				/>
				<button
					type="submit"
					disabled={!message.trim() || isSending}
					className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
				>
					{isSending ? '⏳' : '📤'}
				</button>
			</div>
		</form>
	);
};

export default MessageInput;
