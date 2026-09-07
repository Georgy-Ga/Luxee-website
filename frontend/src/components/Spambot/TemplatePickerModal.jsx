import { useCallback, useEffect, useState } from 'react';
import { spambotApi } from '../../api/spambotApi';
import Modal from '../ui/Modal';

/**
 * Модальное окно выбора шаблона рассылки для аккаунта.
 * Показывает список шаблонов (название, заполненные секции chat/mail, дата создания).
 * Выбор шаблона открывает редактор с предзаполненными данными.
 */
const TemplatePickerModal = ({ account, onSelect, onClose, onCreateNew }) => {
	const [templates, setTemplates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [deletingId, setDeletingId] = useState(null);

	const loadTemplates = useCallback(async () => {
		if (!account) return;
		setLoading(true);
		setError(null);
		try {
			const data = await spambotApi.getTemplates(account._id);
			setTemplates(data);
		} catch (err) {
			console.error('[TemplatePicker] Error loading templates:', err);
			setError(err.response?.data?.message || err.message);
		} finally {
			setLoading(false);
		}
	}, [account]);

	useEffect(() => {
		loadTemplates();
	}, [loadTemplates]);

	const handleDelete = async (template) => {
		if (
			!window.confirm(
				`Удалить шаблон «${template.name}»? Это действие нельзя отменить.`,
			)
		) {
			return;
		}

		setDeletingId(template.id);
		try {
			await spambotApi.deleteTemplate(template.id);
			setTemplates(prev => prev.filter(t => t.id !== template.id));
		} catch (err) {
			console.error('[TemplatePicker] Error deleting template:', err);
			alert(err.response?.data?.message || err.message);
		} finally {
			setDeletingId(null);
		}
	};

	const formatDate = dateString => {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	return (
		<Modal
			isOpen={!!account}
			onClose={onClose}
			title={`Шаблоны: ${account?.luxeeEmail || ''}`}
			size="md"
			closeOnOverlayClick={false}
		>
			<div className="space-y-3">
				{onCreateNew && (
					<button
						onClick={onCreateNew}
						className="w-full py-3 px-4 rounded-lg border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors font-medium"
					>
						+ Создать новый шаблон
					</button>
				)}

				{loading && (
					<p className="text-gray-600 dark:text-gray-400 text-center py-8">
						Загрузка шаблонов...
					</p>
				)}

				{!loading && error && (
					<p className="text-red-600 dark:text-red-400 text-center py-4">{error}</p>
				)}

				{!loading && !error && templates.length === 0 && (
					<p className="text-gray-600 dark:text-gray-400 text-center py-8">
						Нет шаблонов для этого аккаунта.
					</p>
				)}

				{!loading &&
					!error &&
					templates.map(template => (
						<div
							key={template.id}
							className="border border-light-border dark:border-dark-border rounded-lg p-3 bg-white dark:bg-dark-bg"
						>
							<div className="flex items-start justify-between gap-2">
								<button
									onClick={() => onSelect(template)}
									className="flex-1 text-left group"
								>
									<div className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
										{template.name}
									</div>
									<div className="flex items-center gap-2 mt-2">
										{template.hasChat && (
											<span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
												Chat
											</span>
										)}
										{template.hasMail && (
											<span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
												Mail
											</span>
										)}
										{!template.hasChat && !template.hasMail && (
											<span className="text-xs text-gray-500 dark:text-gray-400">
												Пустой шаблон
											</span>
										)}
									</div>
									<div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
										Создан: {formatDate(template.createdAt)}
									</div>
								</button>

								<button
									onClick={() => handleDelete(template)}
									disabled={deletingId === template.id}
									className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-lg leading-none px-2 py-1 disabled:opacity-50"
									title="Удалить шаблон"
								>
									✖
								</button>
							</div>
						</div>
					))}
			</div>
		</Modal>
	);
};

export default TemplatePickerModal;
