import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

class MessagesFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bd=2, relief=tk.GROOVE)

        self.message_type = tk.StringVar(value="Chat")
        self.message_entries = []

        type_frame = ttk.Frame(self)
        type_frame.pack(fill=tk.X, pady=5)
        ttk.Label(type_frame, text="Тип сообщения:").pack(side=tk.LEFT, padx=(0, 10))
        type_selector = ttk.Combobox(type_frame, textvariable=self.message_type, values=["Chat", "Mail"], state="readonly", width=10)
        type_selector.pack(side=tk.LEFT)
        type_selector.bind("<<ComboboxSelected>>", self.switch_mode)

        self.messages_frame = ttk.LabelFrame(self)
        self.messages_frame.pack(fill=tk.X, pady=10)

        self.add_message_btn = ttk.Button(self, text="+ Добавить сообщение", command=self.add_message_field)

        self.mail_fields = {}

        self.render_chat_fields()

    def reset_fields(self):
        self.clear_messages_frame()
        if self.message_type.get() == "Chat":
            self.render_chat_fields()
        else:
            self.render_mail_fields()

    def switch_mode(self, _=None):
        self.clear_messages_frame()
        if self.message_type.get() == "Chat":
            self.render_chat_fields()
        else:
            self.render_mail_fields()

    def clear_messages_frame(self):
        for widget in self.messages_frame.winfo_children():
            widget.destroy()
        self.message_entries.clear()
        self.mail_fields.clear()
        self.add_message_btn.pack_forget()

    def render_chat_fields(self):
        self.messages_frame.config(text="Сообщения")
        self.add_message_field(first=True)
        self.add_message_btn.pack(pady=5, side=tk.TOP)

    def render_mail_fields(self):
        self.messages_frame.config(text="Письмо")
        # Title
        title_label = ttk.Label(self.messages_frame, text="Заголовок:")
        title_label.pack(anchor="w", padx=5)
        title_entry = scrolledtext.ScrolledText(self.messages_frame, height=2)
        title_entry.pack(fill=tk.X, padx=5, pady=(0, 5))
        self.mail_fields["title"] = title_entry

        # Text
        text_label = ttk.Label(self.messages_frame, text="Текст:")
        text_label.pack(anchor="w", padx=5)
        text_entry = scrolledtext.ScrolledText(self.messages_frame, height=10)
        text_entry.pack(fill=tk.X, padx=5, pady=(0, 5))
        self.mail_fields["text"] = text_entry

        # Images
        images_label = ttk.Label(self.messages_frame, text="Картинки (номера через запятую):")
        images_label.pack(anchor="w", padx=5)
        images_entry = ttk.Entry(self.messages_frame)
        images_entry.pack(fill=tk.X, padx=5)
        self.mail_fields["images"] = images_entry

    def add_message_field(self, first=False):
        if len(self.message_entries) >= 7:
            messagebox.showwarning("Лимит", "Не более 7 сообщений!")
            return

        frame = ttk.Frame(self.messages_frame)
        frame.pack(fill=tk.X, pady=5, padx=5)

        interval = tk.IntVar(value=0 if first else 1)
        column = 0

        if not first:
            interval_frame = ttk.Frame(frame)
            interval_frame.grid(row=0, column=column, padx=5, sticky="w")
            ttk.Label(interval_frame, text="Интервал\n(сек):").pack(side=tk.LEFT)
            tk.Spinbox(interval_frame, from_=0, to=100, width=4, textvariable=interval).pack(side=tk.LEFT)
            column += 1

        entry = scrolledtext.ScrolledText(frame, height=3)
        entry.grid(row=0, column=column, sticky="ew", padx=5)
        frame.columnconfigure(column, weight=1)
        column += 1

        if not first:
            remove_btn = ttk.Button(frame, text="✖", width=3, command=lambda: self.remove_message(frame))
            remove_btn.grid(row=0, column=column, padx=1)

        self.message_entries.append((interval, entry, frame))

    def remove_message(self, frame):
        for i, (_, _, f) in enumerate(self.message_entries):
            if f == frame:
                f.destroy()
                del self.message_entries[i]
                break

    def extract_fields_values(self) -> dict or None:
        msg_type = self.message_type.get()

        if msg_type == "Chat":
            messages = []
            for interval, entry, _ in self.message_entries:
                text = entry.get("1.0", tk.END).strip()
                if not text:
                    messagebox.showwarning("Ошибка", "Введите текст сообщения!")
                    return
                try:
                    interval = interval.get()
                except tk.TclError:
                    messagebox.showwarning("Ошибка", "Интервал должен быть числом!")
                    return
                messages.append((text, interval))
            return {"type": "Chat", "messages": messages}

        else:
            title = self.mail_fields["title"].get("1.0", tk.END).strip()
            if not title:
                messagebox.showwarning("Ошибка", "Поле 'Заголовок' обязательно!")
                return
            text = self.mail_fields["text"].get("1.0", tk.END).strip()

            if not text:
                messagebox.showwarning("Ошибка", "Поле 'Текст' обязательно!")
                return

            mail_min_symbols = 150
            mail_max_symbols = 3500
            if len(text) < mail_min_symbols or len(text) > mail_max_symbols:
                messagebox.showwarning("Ошибка", f"Текст письма должен быть от {mail_min_symbols} до {mail_max_symbols} символов!\nКоличество символов сейчас: {len(text)}")
                return

            images = self.mail_fields["images"].get().strip()
            if images:
                try:
                    images = [int(i.strip()) for i in images.split(",")]
                except ValueError:
                    messagebox.showwarning("Ошибка", "Номера картинок должны быть числами разделенными запятыми!")
                    return
            else:
                images = []

            return {"type": "Mail", "title": title, "text": text, "images": images}
