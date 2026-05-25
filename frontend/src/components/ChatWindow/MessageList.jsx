import { useEffect, useRef } from 'react';
import { decodeHtmlEntities, copyToClipboard, formatTime } from './utils';

const MessageList = ({ messages, isLoading, copiedId, onCopy }) => {
	const messagesEndRef = useRef(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-gray-600 dark:text-gray-300">Загрузка сообщений...</div>
			</div>
		);
	}

	if (!messages || messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-gray-600 dark:text-gray-300">Нет сообщений</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
			{messages.map((msg) => {
				const isFromMan = msg.from === 'man';
				const decodedBody = decodeHtmlEntities(msg.body);

				return (
					<div
						key={msg.id}
						className={`flex ${isFromMan ? 'justify-start' : 'justify-end'}`}
					>
						<div
							className={`max-w-[70%] rounded-lg p-3 ${
								isFromMan
									? 'bg-light-surface dark:bg-dark-surface text-gray-900 dark:text-white border border-light-border dark:border-dark-border'
									: 'bg-purple dark:bg-accent text-white'
							}`}
						>
							<div className="flex items-start justify-between gap-2 mb-1">
								<span className="text-xs opacity-75">
									{isFromMan ? '👨 Мужчина' : '👩 Девушка'}
								</span>
								<button
									onClick={() => onCopy(msg.id)}
									className="text-xs opacity-75 hover:opacity-100 transition-opacity"
									title="Копировать ID"
								>
									{copiedId === msg.id ? '✅' : '📋'}
								</button>
							</div>
							<p className="whitespace-pre-wrap break-words">{decodedBody}</p>
							<div className="text-xs opacity-75 mt-1 text-right">
								{formatTime(msg.createdAt)}
							</div>
						</div>
					</div>
				);
			})}
			<div ref={messagesEndRef} />
		</div>
	);
};

export default MessageList;
