import tkinter as tk
from tkinter import messagebox

from src.credentials_manager import save_user, is_username_available, is_username_in_use
from src.exceptions import LuxeeLoginError


class LoginWindow(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent

        tk.Label(self, text="Логин", font=("Arial", 14)).pack(pady=10)
        self.username_entry = tk.Entry(self, font=("Arial", 14))
        self.username_entry.pack(pady=5)

        tk.Label(self, text="Пароль", font=("Arial", 14)).pack(pady=10)
        self.password_entry = tk.Entry(self, font=("Arial", 14), show="*")
        self.password_entry.pack(pady=5)

        self.login_button = tk.Button(self, text="Войти", font=("Arial", 14), command=self.login)
        self.login_button.pack(pady=20)

    def login(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()

        if not username or not password:
            messagebox.showerror("Ошибка", "Введите логин и пароль!")
            return

        if not is_username_available(username):
            messagebox.showerror(
                "Ошибка", f"Пользователь '{username}' должен быть одобрен администратором для использования программы!"
            )
            return

        if is_username_in_use(username):
            messagebox.showerror(
                "Ошибка", f"Пользователь '{username}' уже используется в другом окне программы!"
            )
            return

        try:
            self.parent.load_main_window(username, password)
        except LuxeeLoginError as e:
            messagebox.showerror("Ошибка", str(e))
            return

        save_user(username, password)
