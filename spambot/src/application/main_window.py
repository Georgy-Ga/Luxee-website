import threading
import time
import tkinter as tk
import traceback
from tkinter import ttk, messagebox

from config import CONFIG
from src.application.distribution_list_frame import DistributionsListFrame
from src.application.distribution_settings_frame import DistributionSettingsFrame
from src.application.message_frame import MessagesFrame
from src.application.profile_frame import ProfileFrame
from src.credentials_manager import clear_user
from src.exceptions import StopDestributionError
from src.logger import logger
from src.models import Message, Distribution, MailMessage
from src.process import extract_profiles, DistributionProcess


class HomeWindow(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.profiles = []

        # configure this frame to fill the parent
        self.columnconfigure(0, weight=2)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

        self.profile_frame: ProfileFrame = None
        self.distributions_list_frame: DistributionsListFrame = None
        self.distribution_settings_frame: DistributionSettingsFrame = None
        self.messages_frame: MessagesFrame = None

        self.username: str = ""
        self.password: str = ""

    def load_profiles(self, username: str, password: str):
        self.profiles = extract_profiles(username, password)

        self.username = username
        self.password = password
        self.set_frames()

    def set_frames(self):
        top_frame = tk.Frame(self)
        top_frame.pack(fill="x", pady=(5, 0), padx=5)

        self.username_label = tk.Label(top_frame, text=f"👤 {self.username}", font=("Arial", 10, "bold"))
        self.username_label.pack(side="left")

        logout_button = tk.Button(top_frame, text="Выйти из аккаунта", font=("Arial", 8), command=self.logout)
        logout_button.pack(side="right")

        main_paned = tk.PanedWindow(self, orient=tk.HORIZONTAL, sashrelief=tk.RAISED)
        main_paned.pack(fill=tk.BOTH, expand=True)

        left_paned = tk.PanedWindow(main_paned, orient=tk.VERTICAL, sashrelief=tk.RAISED)
        main_paned.add(left_paned, stretch="always", width=500)

        self.profile_frame = ProfileFrame(left_paned, self.profiles, self.logout)
        left_paned.add(self.profile_frame, stretch="never", height=220)

        bottom_paned = tk.PanedWindow(left_paned, orient=tk.HORIZONTAL, sashrelief=tk.RAISED)
        left_paned.add(bottom_paned, stretch="always")

        self.distribution_settings_frame = DistributionSettingsFrame(bottom_paned, self.add_distribution)
        bottom_paned.add(self.distribution_settings_frame, stretch="always", width=400)

        self.messages_frame = MessagesFrame(bottom_paned)
        bottom_paned.add(self.messages_frame, stretch="always", width=400)

        self.distributions_list_frame = DistributionsListFrame(main_paned, self.start_distribution)
        main_paned.add(self.distributions_list_frame, stretch="always", width=250)

    def add_distribution(self):
        # Read values from Distribution Settings Frame
        result = self.distribution_settings_frame.extract_fields_values()
        if not result:
            return
        only_empty_chat, only_not_empty_chat, purchased, free, exclude_ids, limit, filter_update_limit, time_limit, specific_users = result

        # Read values from Messages Frame
        result = self.messages_frame.extract_fields_values()
        if not result:
            return
        if result["type"] == "Chat":
            messages = [Message(text, interval) for text, interval in result["messages"]]
            mail_message = None
        elif result["type"] == "Mail":
            messages = None
            mail_message = MailMessage(result["title"], result["text"], result["images"])
        else:
            messagebox.showwarning("Ошибка", "Выберите тип сообщения!")
            return

        # Extract selected profile
        profile = self.profile_frame.extract_selected_profile()
        if not profile:
            return

        distribution = Distribution(
            profile=profile,
            purchased=purchased,
            free=free,
            only_empty_chat=only_empty_chat,
            only_not_empty_chat=only_not_empty_chat,
            messages=messages,
            mail_message=mail_message,
            exclude=exclude_ids,
            limit=limit,
            filter_update_limit=filter_update_limit,
            max_time_minutes=time_limit,
            specific_users=specific_users,
        )
        self.distributions_list_frame.add_distribution(distribution)

        # Сбрасываем поля формы
        self.distribution_settings_frame.reset_fields()
        self.messages_frame.reset_fields()

    def start_distribution(self):
        if self.distributions_list_frame.distribution_count == 0:
            messagebox.showwarning("Ошибка", "Добавьте хотя бы одну рассылку!")
            return
        self.show_processing_view()
        threading.Thread(target=self.run_distribution, daemon=True).start()

    def show_processing_view(self):
        """Replaces the main UI with a processing status screen."""
        for widget in self.winfo_children():
            widget.destroy()  # Remove all widgets

        top_frame = tk.Frame(self)
        top_frame.pack(fill="x", pady=(5, 0), padx=5)

        self.username_label = tk.Label(top_frame, text=f"👤 {self.username}", font=("Arial", 10, "bold"))
        self.username_label.pack(side="left")

        self.processing_label = ttk.Label(
            self, text="📢 Начало рассылки...", font=("Arial", 16, "bold"), foreground="blue"
        )
        self.processing_label.pack(pady=20)

        self.status_text = tk.Text(self, wrap="word", height=15, state="normal")
        self.status_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.status_text.insert(tk.END, "Очередь на рассылку\n\n")
        for index, distribution in enumerate(self.distributions_list_frame.distributions_list, start=1):
            text = f"🔹 Рассылка №{index} ({distribution.profile.name})\n"
            text += f"Лимит: {distribution.limit if distribution.limit else '∞'}\n"
            if distribution.messages is not None:
                text += f"Сообщений: {len(distribution.messages)}\n"
            elif distribution.mail_message is not None:
                text += f"Письмо: {distribution.mail_message.title}\n"
            text += "-" * 30 + "\n"
            self.status_text.insert(tk.END, text)

        self.status_text.configure(state="disabled")

    def _add_distribution_status_text(self, dist_num: int, distribution: Distribution, stop_reason: str = ""):
        self.status_text.configure(state="normal")
        reason_to_stop_str = f"❌ Рассылка не может быть продолжена из-за ошибки: {stop_reason}\n" if stop_reason else ""
        self.status_text.insert(
            tk.END,
            f"\n📊 Итоги рассылки {dist_num} ({distribution.profile.name}):\n"
            f"📨 Отправлено: {distribution.sent_messages_count}\n"
            f"⚠️ Пропущено: {distribution.skipped_clients}\n"
            # f"❌ Ошибок: {distribution.}\n"
            f"{reason_to_stop_str}{'-' * 40}\n",
        )
        self.status_text.configure(state="disabled")

    def run_distribution(self):
        """Обрабатывает рассылки группами, учитывает результаты и останавливается при ошибке."""
        dist_process = DistributionProcess()
        try:
            self.status_text.configure(state="normal")
            self.status_text.insert(tk.END, "\n📢 Начинаем рассылку...\n")
            self.status_text.configure(state="disabled")

            for index, distribution in enumerate(self.distributions_list_frame.distributions_list, start=1):
                if index > 1:
                    self.status_text.configure(state="normal")
                    self.status_text.insert(
                        tk.END,
                        f"⏳ Ждем {CONFIG.WAIT_MINUTES_BETWEEN_PROFILES} минут перед началом рассылки от {distribution.profile.name}",
                    )
                    self.status_text.see(tk.END)
                    self.status_text.configure(state="disabled")
                    logger.info(
                        f"Waiting {CONFIG.WAIT_MINUTES_BETWEEN_PROFILES} minutes before starting the next distribution"
                    )
                    time.sleep(CONFIG.WAIT_MINUTES_BETWEEN_PROFILES * 60)

                self.status_text.configure(state="normal")
                self.status_text.insert(tk.END, f"\n🚀 Рассылка №{index} ({distribution.profile.name}) в процессе...\n")
                self.status_text.see(tk.END)
                self.status_text.configure(state="disabled")

                try:
                    dist_process.start(distribution, self.username, self.password)
                    self._add_distribution_status_text(index, distribution)
                except StopDestributionError as e:
                    self._add_distribution_status_text(index, distribution, stop_reason=str(e))
                except Exception as e:
                    traceback.print_exc()
                    self._add_distribution_status_text(index, distribution)
                    self.status_text.configure(state="normal")
                    self.status_text.insert(
                        tk.END,
                        f"\n❌ Рассылка {index} ({distribution.profile.name}) не удалась: {str(e)}\n"
                        f"🚨 Рассылка прервана!\n",
                    )
                    self.status_text.configure(state="disabled")

                    self.processing_label.config(text="❌ Рассылка прервана!", foreground="red")
                    break
            else:
                self.processing_label.config(text="✅ Рассылка Завершена!", foreground="green")

        except Exception as e:
            self.status_text.configure(state="normal")
            self.status_text.insert(tk.END, f"\n🚨 Рассылка прервана из-за ошибки: {str(e)}\n")
            self.status_text.insert(tk.END, "❌ Рассылка не удалась!\n")
            self.status_text.configure(state="disabled")
            self.processing_label.config(text="❌ Рассылка не удалась!", foreground="red")

        finally:
            self.update_to_finished_view()
            self.distributions_list_frame.distributions_list.clear()
            dist_process.finish()

    def update_to_finished_view(self):
        """Updates UI to indicate that distribution is finished."""
        self.menu_button = tk.Button(
            self,
            text="🏠 Главное меню",
            command=self.reset_home_window,
            font=("Arial", 12, "bold"),
            bg="#4682B4",  # Steel Blue
            fg="white",
            activebackground="#5A9BD5",
            activeforeground="white",
            padx=10,
            pady=5,
        )
        self.menu_button.pack(pady=10)

    def reset_home_window(self):
        """Reset HomeWindow UI to its initial post-login state."""
        for widget in self.winfo_children():
            widget.destroy()

        # Очистить фреймы и их содержимое
        self.profile_frame = None
        self.distributions_list_frame = None
        self.distribution_settings_frame = None
        self.messages_frame = None

        # Профили не обновляем — они уже загружены
        self.set_frames()

    def logout(self):
        """Logs out and returns to the login window."""
        clear_user()
        messagebox.showinfo("Выход", "Вы успешно вышли из системы!")
        self.parent.show_frame("LoginWindow")

    def destroy_window(self):
        """Destroys the current window."""
        self.parent.destroy_window()
