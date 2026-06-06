import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { luxeeApi } from '../../api/luxeeApi';
import useChatStore from '../../stores/chatStore';
import MessageList from './MessageList';
import ProfileInfo from './ProfileInfo';
import MessageInput from './MessageInput';
import { copyToClipboard } from './utils';

const ChatWindow = () => {
	const [isSending, setIsSending] = useState(false);
	const [copiedId, setCopiedId] = useState(null);
	const queryClient = useQueryClient();

	const selectedChat = useChatStore(state => state.selectedChat);
	
	const handleCopy = (id) => {
		copyToClipboard(id.toString());
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const { data: chatData, isLoading } = useQuery({
		queryKey: [
			'chatMessages',
			selectedChat?.accountId,
			selectedChat?.profileUid,
			selectedChat?.chatId,
		],
		queryFn: () =>
			luxeeApi.openChat(
				selectedChat.accountId,
				selectedChat.profileUid,
				selectedChat.chatId,
			),
		enabled: !!selectedChat,
		refetchInterval: 10000,
	});

	const handleSendMessage = async (messageText) => {
		if (!selectedChat || !messageText.trim()) return;

		setIsSending(true);
		try {
			await luxeeApi.sendMessage(
				selectedChat.accountId,
				selectedChat.profileUid,
				selectedChat.chatId,
				messageText,
			);

			queryClient.invalidateQueries({
				queryKey: [
					'chatMessages',
					selectedChat.accountId,
					selectedChat.profileUid,
					selectedChat.chatId,
				],
			});

			queryClient.invalidateQueries({ queryKey: ['chats'] });
		} catch (error) {
			console.error('Ошибка отправки сообщения:', error);
			alert('Ошибка отправки сообщения');
		} finally {
			setIsSending(false);
		}
	};

	if (!selectedChat) {
		return (
			<div className="flex-1 flex items-center justify-center bg-light-bg dark:bg-dark-bg">
				<div className="text-center">
					<p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
						💬 Выберите чат
					</p>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Выберите чат из списка слева
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col bg-light-bg dark:bg-dark-bg">
			<ProfileInfo profile={chatData?.profile} />
			<MessageList
				messages={chatData?.messages}
				isLoading={isLoading}
				copiedId={copiedId}
				onCopy={handleCopy}
			/>
			<MessageInput onSend={handleSendMessage} isSending={isSending} />
		</div>
	);
};

export default ChatWindow;
