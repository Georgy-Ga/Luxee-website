import tkinter as tk
from tkinter import ttk

from src.models import Distribution


class DistributionsListFrame(tk.Frame):
    def __init__(self, parent, start_distribution: callable):
        super().__init__(parent, bd=2, relief=tk.GROOVE)

        self.start_distribution = start_distribution
        self.distributions_list: list[Distribution] = []
        ttk.Label(self, text="Добавлено на рассылку:").pack(anchor="w")

        self.text_widget = tk.Text(self, height=20, wrap="word", state="disabled")
        self.text_widget.pack(fill=tk.BOTH, expand=True)

        start_btn = tk.Button(
            self,
            text="Начать рассылку!",
            command=self.start_distribution,
            font=("Arial", 12, "bold"),
            bg="green",
            fg="white",
            activebackground="darkgreen",
            activeforeground="white",
            padx=10,
            pady=5,
        )

        start_btn.pack(pady=10, padx=20, ipadx=10)

        self.distribution_count = 0

    def add_distribution(self, distribution: Distribution):
        self.distribution_count += 1

        header = f"🔹 Рассылка №{self.distribution_count} 🔹"
        profile = f"Профиль: {distribution.profile.name}"
        limit = f"Лимит отправки: {distribution.limit if distribution.limit else '∞'}"

        chat_cond = (
            "только пустые чаты"
            if distribution.only_empty_chat
            else "только НЕ пустые чаты"
            if distribution.only_not_empty_chat
            else "все чаты"
        )

        # Определяем тип пользователей
        if distribution.specific_users:
            # Показываем только первые ID в зависимости от лимита
            ids_to_show = distribution.specific_users[:distribution.limit] if distribution.limit else distribution.specific_users
            remaining = len(distribution.specific_users) - len(ids_to_show)
            
            ids_str = ', '.join(map(str, ids_to_show))
            if remaining > 0:
                user_type = f"конкретные пользователи ({len(ids_to_show)} из {len(distribution.specific_users)})"
                specific_users_info = f"ID пользователей: {ids_str}... (+{remaining} еще)"
            else:
                user_type = f"конкретные пользователи ({len(ids_to_show)})"
                specific_users_info = f"ID пользователей: {ids_str}"
        else:
            user_type = (
                "оплаченные"
                if distribution.purchased and not distribution.free
                else "бесплатные"
                if distribution.free and not distribution.purchased
                else "все пользователи"
            )
            specific_users_info = None

        condition_info = f"Условия: {user_type}, {chat_cond}"
        exclude_info = f"Исключения: {', '.join(map(str, distribution.exclude)) or 'нет'}"
        
        # Добавляем информацию о конкретных пользователях, если они указаны
        if specific_users_info:
            users_list_info = specific_users_info
        else:
            users_list_info = None

        if distribution.messages is not None:
            messages_info = "Сообщения:"

            for msg in distribution.messages:
                text = msg.text if len(msg.text) <= 50 else msg.text[:47] + "..."
                messages_info += f"\n  • {text} ({msg.interval} сек)"
        elif distribution.mail_message is not None:
            messages_info = "Письмо:"

            text = distribution.mail_message.text if len(distribution.mail_message.text) <= 50 else distribution.mail_message.text[:47] + "..."
            messages_info += f"\n • {distribution.mail_message.title} ({text})"
            if distribution.mail_message.pictures_number:
                pictures = ", ".join(map(str, distribution.mail_message.pictures_number))
                messages_info += f"\n • Изображения: {pictures}"
        else:
            messages_info = "Сообщения: нет"

        # Формируем итоговый текст
        text_parts = [header, profile, limit, condition_info]
        
        # Добавляем список ID если есть
        if users_list_info:
            text_parts.append(users_list_info)
        
        text_parts.extend([exclude_info, messages_info, "-" * 40 + "\n"])
        
        full_text = "\n".join(text_parts)

        self.text_widget.configure(state="normal")
        self.text_widget.insert(tk.END, full_text)
        self.text_widget.configure(state="disabled")
        self.distributions_list.append(distribution)

        self.text_widget.see(tk.END)

