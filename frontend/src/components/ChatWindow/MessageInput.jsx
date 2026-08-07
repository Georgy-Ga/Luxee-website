import { useState, useRef, useEffect } from 'react';

const MessageInput = ({ onSend, isSending }) => {
	const [message, setMessage] = useState('');
	const textareaRef = useRef(null);

	// Автоматическое изменение высоты textarea
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = 'auto';
			textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
		}
	}, [message]);

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
		<form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
			<div className="flex gap-2 items-end">
				<textarea
					ref={textareaRef}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Введите сообщение..."
					className="input-field resize-none overflow-hidden text-base"
					rows="1"
					disabled={isSending}
					style={{ minHeight: '44px', maxHeight: '200px', fontSize: '16px' }}
				/>
				<button
					type="submit"
					disabled={!message.trim() || isSending}
					className="btn-primary px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 min-h-[44px] text-xl"
				>
					{isSending ? '⏳' : '📤'}
				</button>
			</div>
		</form>
	);
};

export default MessageInput;
