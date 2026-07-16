import tkinter as tk
from io import BytesIO
from tkinter import ttk, messagebox

import requests
from PIL import Image, ImageTk

from src.models import Profile


class ProfileFrame(tk.Frame):
    def __init__(self, parent, profiles: list[Profile], logout_method: callable):
        super().__init__(parent, bd=2, relief=tk.GROOVE)

        self.profiles = profiles
        self.profile_panel_visible = True
        
        # Combobox row
        tk.Label(self, text="Выберите девушку:").pack(anchor="w", padx=5, pady=(2, 2))
        self.profile_var = tk.StringVar()
        self.profile_combo = ttk.Combobox(self, textvariable=self.profile_var, state="readonly")
        self.profile_combo.pack(fill=tk.X, padx=5, pady=(0, 4))
        self.profile_combo["values"] = [profile.display_name() for profile in self.profiles]
        self.profile_combo.bind("<<ComboboxSelected>>", lambda _: self.update_profile())
        self.profile_combo.current(0)

        # Horizontal layout frame for apps + profile
        self.content_frame = tk.Frame(self)
        self.content_frame.pack(fill="both", expand=True, padx=5, pady=5)
        self.content_frame.columnconfigure(0, weight=1)
        self.content_frame.columnconfigure(1, weight=1)

        # Right: Centered Profile
        self.profile_wrapper = tk.Frame(self.content_frame)
        self.profile_wrapper.grid(row=0, column=1, sticky="nsew")
        self.profile_wrapper.columnconfigure(0, weight=1)
        self.profile_wrapper.rowconfigure(0, weight=1)

        # Центрированный блок
        self.profile_panel = tk.Frame(self.profile_wrapper)
        self.profile_panel.grid(row=0, column=0, pady=(0, 5))

        # Profile image
        self.profile_img_label = tk.Label(self.profile_panel)
        self.profile_img_label.pack(pady=(0, 2))

        # Profile info
        self.profile_info_label = tk.Label(
            self.profile_panel,
            font=("Arial", 11),
            justify="center",
            anchor="center",
            width=30,
            wraplength=180
        )
        self.profile_info_label.pack()

        self.profile_image_ref = None
        self.update_profile()
        
        # Отслеживаем изменение размера окна для адаптивного скрытия
        self.bind("<Configure>", self._on_resize)

    def update_profile(self):
        selected_name = self.profile_combo.get()
        profile: Profile = next((p for p in self.profiles if p.display_name() == selected_name), None)

        if profile:
            # Load image
            try:
                response = requests.get(profile.image_url)
                img_data = Image.open(BytesIO(response.content)).resize((70, 105))
                self.profile_image_ref = ImageTk.PhotoImage(img_data)
                self.profile_img_label.configure(image=self.profile_image_ref)
            except Exception:
                self.profile_img_label.configure(image="")

            self.profile_info_label.configure(text=f"{profile.name}\n{profile.location}, {profile.age}")

    def _on_resize(self, event):
        """
        Адаптивное скрытие фотографии и информации профиля при нехватке места.
        Если высота фрейма меньше 180px - скрываем фото и информацию.
        """
        # Проверяем высоту фрейма
        frame_height = self.winfo_height()
        
        # Порог для скрытия - если высота меньше 180px
        threshold_height = 180
        
        if frame_height < threshold_height and self.profile_panel_visible:
            # Скрываем фотографию и информацию
            self.profile_panel.grid_forget()
            self.profile_panel_visible = False
        elif frame_height >= threshold_height and not self.profile_panel_visible:
            # Показываем фотографию и информацию обратно
            self.profile_panel.grid(row=0, column=0, pady=(0, 5))
            self.profile_panel_visible = True

    def extract_selected_profile(self) -> Profile | None:
        index = self.profile_combo.current()

        if 0 <= index < len(self.profiles):
            return self.profiles[index]

        messagebox.showwarning("Ошибка", "Выберите профиль!")
        return None
