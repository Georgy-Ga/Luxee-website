class Profile:
    def __init__(self, name: str, age: str, location: str, uid: str, image_url: str, is_disabled: bool):
        self.name: str = name
        self.age: str = age
        self.location: str = location
        self.owner_uid: int = int(uid)
        self.image_url: str = image_url
        self.is_disabled: bool = is_disabled
        self.uid: int = None
        self.apps: list[str] = []  # Инициализируем пустым списком, заполняется в get_profiles()

    def __str__(self):
        return self.display_name()

    def __repr__(self):
        return self.__str__()

    def display_name(self):
        return f"{self.name} ({self.owner_uid})"


class Client:
    def __init__(self, name: str, age: str, location: str, uid: str, app: str):
        self.name = name
        self.age = age
        self.location = location
        self.uid: int = int(uid)
        self.app = app

    def __str__(self):
        return f"{self.name} ({self.uid})"

    def __repr__(self):
        return self.__str__()


class Message:
    def __init__(self, text: str, interval: int):
        self.text: str = text
        self.interval: int = interval

    def __str__(self):
        return self.text

    def __repr__(self):
        return self.__str__()


class MailMessage:
    def __init__(self, title: str, text: str, pictures_number: list[int] = ()):
        self.title: str = title
        self.text: str = text
        self.pictures_number: list[int] = pictures_number

    def __str__(self):
        return self.text

    def __repr__(self):
        return self.__str__()


class Distribution:
    def __init__(
            self,
            profile: Profile,
            purchased: bool,
            free: bool,
            only_empty_chat: bool,
            only_not_empty_chat: bool,
            exclude: list[int],
            limit: int,
            filter_update_limit: int,
            messages: list[Message] = None,
            mail_message: MailMessage = None,
            max_time_minutes: int = 99999,
            specific_users: list[int] = None
    ):
        self.profile: Profile = profile
        self.purchased: bool = purchased
        self.free: bool = free

        self.only_empty_chat: bool = only_empty_chat
        self.only_not_empty_chat: bool = only_not_empty_chat

        self.messages: list[Message] = messages
        self.mail_message: MailMessage = mail_message

        self.exclude: list[int] = exclude
        self.specific_users: list[int] = specific_users if specific_users else []

        self.limit: int = limit
        self.filter_update_limit: int = filter_update_limit
        self.max_time_minutes: int = max_time_minutes

        # Копируем apps из профиля для обратной совместимости со старым кодом
        self.apps: list[str] = profile.apps if hasattr(profile, 'apps') else []

        self.sent_messages_count = 0
        self.skipped_clients: int = 0
        self.processed_clients: list[int] = []
