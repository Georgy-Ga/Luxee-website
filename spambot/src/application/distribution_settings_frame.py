import tkinter as tk
from tkinter import ttk, messagebox


class DistributionSettingsFrame(tk.Frame):
    def __init__(self, parent, add_distribution: callable):
        super().__init__(parent, bd=2, relief=tk.GROOVE)

        self.settings_frame = ttk.LabelFrame(self, text="Настройки рассылки")
        self.settings_frame.pack(fill=tk.BOTH, expand=True, pady=10)

        ttk.Label(self.settings_frame, text="Отправлять только если:").pack(anchor="w", pady=10)
        self.chat_condition_var = tk.StringVar(value="all")
        chat_conditions = [
            ("Не отправляли ранее", "empty"),
            ("Уже отправляли", "not_empty"),
            ("Отправлять всем", "all"),
        ]
        for text, value in chat_conditions:
            rb = ttk.Radiobutton(self.settings_frame, text=text, variable=self.chat_condition_var, value=value)
            rb.pack(anchor="w")

        ttk.Label(self.settings_frame, text="Тип пользователя:").pack(anchor="w", pady=10)
        self.user_type_var = tk.StringVar(value="all")
        user_types = [("Оплаченный", "paid"), ("Бесплатный", "free"), ("Все", "all"), ("Отправлять конкретным пользователям", "specific")]
        for text, value in user_types:
            rb = ttk.Radiobutton(self.settings_frame, text=text, variable=self.user_type_var, value=value, command=self._toggle_specific_users_field)
            rb.pack(anchor="w", pady=1)

        # Поле для конкретных пользователей (скрыто по умолчанию)
        self.specific_users_label = ttk.Label(self.settings_frame, text="Список пользователей для отправки (через запятую):")
        self.specific_users_text = tk.Text(self.settings_frame, height=2)

        ttk.Label(self.settings_frame, text="Исключать по ID (через запятую):").pack(anchor="w")
        self.exclude_text = tk.Text(self.settings_frame, height=2)
        self.exclude_text.pack(fill=tk.X, pady=10)

        self.grid_fields_frame = ttk.Frame(self.settings_frame)
        self.grid_fields_frame.pack(fill=tk.X, pady=10)

        # Лимит
        ttk.Label(self.grid_fields_frame, text="Лимит на рассылку:").grid(row=0, column=0, sticky="w", pady=5,
                                                                          padx=(0, 10))
        self.limit_entry = ttk.Entry(self.grid_fields_frame, width=15)
        self.limit_entry.grid(row=0, column=1, sticky="w")

        # Обновление
        ttk.Label(self.grid_fields_frame, text="Обновлять список после:").grid(row=1, column=0, sticky="w", pady=5,
                                                                               padx=(0, 10))
        self.update_limit_entry = ttk.Entry(self.grid_fields_frame, width=15)
        self.update_limit_entry.grid(row=1, column=1, sticky="w")

        # Время
        ttk.Label(self.grid_fields_frame, text="Максимальное время на рассылку (мин.):").grid(row=2, column=0,
                                                                                              sticky="w", pady=5,
                                                                                              padx=(0, 10))
        self.time_limit_entry = ttk.Entry(self.grid_fields_frame, width=15)
        self.time_limit_entry.insert(0, "180")
        self.time_limit_entry.grid(row=2, column=1, sticky="w")

        add_btn = ttk.Button(self, text="Добавить на рассылку →", command=add_distribution)

        style = ttk.Style()
        style.configure("AddButton.TButton", font=("Arial", 11, "bold"), padding=5)

        add_btn.configure(style="AddButton.TButton")
        add_btn.pack(pady=10, padx=20, ipadx=10)

    def _toggle_specific_users_field(self):
        """Показать/скрыть поле для конкретных пользователей"""
        if self.user_type_var.get() == "specific":
            # Найти виджет "Исключать по ID" и вставить перед ним
            exclude_label = None
            for child in self.settings_frame.winfo_children():
                if isinstance(child, ttk.Label) and "Исключать по ID" in child.cget("text"):
                    exclude_label = child
                    break
            
            if exclude_label:
                self.specific_users_label.pack(anchor="w", pady=(10, 0), before=exclude_label)
                self.specific_users_text.pack(fill=tk.X, pady=(0, 10), before=exclude_label)
        else:
            self.specific_users_label.pack_forget()
            self.specific_users_text.pack_forget()

    def reset_fields(self):
        self.chat_condition_var.set("all")
        self.user_type_var.set("all")
        self.specific_users_text.delete("1.0", tk.END)
        self.exclude_text.delete("1.0", tk.END)
        self.limit_entry.delete(0, tk.END)
        self.update_limit_entry.delete(0, tk.END)
        self.time_limit_entry.delete(0, tk.END)
        self.time_limit_entry.insert(0, "180")
        self._toggle_specific_users_field()

    def extract_fields_values(self):
        # Type of chat condition
        chat_condition = self.chat_condition_var.get()
        if chat_condition == "empty":
            only_empty_chat, only_not_empty_chat = True, False
        elif chat_condition == "not_empty":
            only_empty_chat, only_not_empty_chat = False, True
        else:
            only_empty_chat, only_not_empty_chat = False, False

        # Type of user
        user_type = self.user_type_var.get()
        if user_type == "paid":
            purchased, free = True, False
        elif user_type == "free":
            purchased, free = False, True
        elif user_type == "specific":
            purchased, free = False, False  # Не используется для конкретных пользователей
        else:
            purchased, free = True, True

        # Specific users IDs
        specific_users = []
        if user_type == "specific":
            specific_users_str = self.specific_users_text.get("1.0", tk.END).strip()
            if not specific_users_str:
                messagebox.showwarning("Ошибка", "Введите список пользователей для отправки!")
                return
            try:
                specific_users = [int(uid.strip()) for uid in specific_users_str.split(",") if uid.strip()]
            except ValueError:
                messagebox.showwarning("Ошибка", "ID пользователей должны быть числами разделенными запятыми!")
                return

        # Exclude IDs
        exclude_ids_str = self.exclude_text.get("1.0", tk.END).strip()
        if exclude_ids_str:
            try:
                exclude_ids = [int(uid.strip()) for uid in exclude_ids_str.split(",") if uid.strip()]
            except ValueError:
                messagebox.showwarning("Ошибка", "ID должны быть числами разделенными запятыми!")
                return
        else:
            exclude_ids = []

        # Limit and update limit
        limit_str = self.limit_entry.get().strip()

        if not limit_str:
            messagebox.showwarning("Ошибка", "Введите лимит!")
            return
        try:
            limit = int(limit_str)
        except ValueError:
            messagebox.showwarning("Ошибка", "Лимит должен быть числом!")
            return

        filter_update_limit_str = self.update_limit_entry.get().strip()
        if not filter_update_limit_str:
            messagebox.showwarning("Ошибка", "Введите число для обновление списка!")
            return
        try:
            filter_update_limit = int(filter_update_limit_str)
        except ValueError:
            messagebox.showwarning("Ошибка", "Обновление списка должно быть числом!")
            return

        # Time limit
        time_limit_str = self.time_limit_entry.get().strip()
        if not time_limit_str:
            messagebox.showwarning("Ошибка", "Введите максимальное время на рассылку!")
            return
        try:
            time_limit = int(time_limit_str)
        except ValueError:
            messagebox.showwarning("Ошибка", "Максимальное время должно быть числом!")
            return
        if time_limit <= 0:
            messagebox.showwarning("Ошибка", "Максимальное время должно быть больше 0!")
            return

        return only_empty_chat, only_not_empty_chat, purchased, free, exclude_ids, limit, filter_update_limit, time_limit, specific_users
