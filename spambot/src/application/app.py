import ctypes
import os
import tkinter as tk

from src.application.login_window import LoginWindow
from src.application.main_window import HomeWindow
from src.credentials_manager import load_user, is_username_available, is_username_in_use, mark_username_as_in_use, \
    unmark_username_as_in_use
from src.exceptions import LuxeeLoginError
from src.logger import logger
from src.luxee_site.luxee_browser import BROWSER


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Luxee Bot")
        self.geometry("1200x760")
        # Открываем окно в полноэкранном режиме (maximized)
        self.state('zoomed')
        self.current_username = None

        self.frames = {}

        for FrameClass in (LoginWindow, HomeWindow):
            frame = FrameClass(self)
            self.frames[FrameClass.__name__] = frame
            frame.grid(row=0, column=0, sticky="nsew")

        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)

        self.protocol("WM_DELETE_WINDOW", self.destroy_window)

        user_data = load_user()
        if user_data:
            try:
                if not is_username_available(user_data["username"]):
                    self.load_login_window()
                elif is_username_in_use(user_data["username"]):
                    self.load_login_window()
                else:
                    self.load_main_window(user_data["username"], user_data["password"])
            except LuxeeLoginError as e:
                logger.exception(e)
                self.load_login_window()
                if self.current_username:
                    unmark_username_as_in_use(self.current_username)
        else:
            self.load_login_window()

        # Глобальные биндинги для Ctrl в русской раскладке
        self.bind_all("<Control-KeyPress>", self.ru_keys)

    @staticmethod
    def is_ru_lang_keyboard():
        u = ctypes.windll.LoadLibrary("user32.dll")
        pf = getattr(u, "GetKeyboardLayout")
        return hex(pf(0)) == '0x4190419'

    def ru_keys(self, event):
        if self.is_ru_lang_keyboard():
            if event.keycode == 86:
                event.widget.event_generate("<<Paste>>")
            if event.keycode == 67:
                event.widget.event_generate("<<Copy>>")
            if event.keycode == 88:
                event.widget.event_generate("<<Cut>>")
            if event.keycode == 65535:
                event.widget.event_generate("<<Clear>>")
            if event.keycode == 65:
                event.widget.event_generate("<<SelectAll>>")

    def _bind_russian_shortcuts(self):
        paste_keys = ['в', 'В']
        copy_keys = ['с', 'С']
        cut_keys = ['х', 'Х']
        undo_keys = ['з', 'З']
        select_all_keys = ['а', 'А']

        def bind_combo(keys, virtual_event):
            for key in keys:
                self.bind_all(f'<Control-{key}>', lambda e, v=virtual_event: self.event_generate(v))

        bind_combo(paste_keys, '<<Paste>>')
        bind_combo(copy_keys, '<<Copy>>')
        bind_combo(cut_keys, '<<Cut>>')
        bind_combo(undo_keys, '<<Undo>>')
        bind_combo(select_all_keys, '<<SelectAll>>')

    def load_main_window(self, username, password):
        self.current_username = username
        mark_username_as_in_use(username)

        try:
            self.frames["HomeWindow"].load_profiles(username, password)
            self.show_frame("HomeWindow")
        except Exception as e:
            unmark_username_as_in_use(username)
            raise e

    def load_login_window(self):
        self.show_frame("LoginWindow")

    def show_frame(self, frame_name):
        frame = self.frames[frame_name]
        frame.tkraise()

    def destroy_window(self):
        """Destroys the current window and stops script execution."""
        if self.current_username:
            unmark_username_as_in_use(self.current_username)
        BROWSER.close_all_browsers()
        self.destroy()
        os._exit(0)
