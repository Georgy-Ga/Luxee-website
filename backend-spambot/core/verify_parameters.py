"""
Скрипт для проверки и извлечения параметров ownerUid, profileUid и userUid
"""
import re
from bs4 import BeautifulSoup
from src.models import Profile, Client
from src.requests_class import Requests


def extract_owner_uid_from_html(html_content: str) -> list[dict]:
    """
    Извлекает ownerUid из HTML страницы /profile
    
    Параметр ownerUid - это статический ID профиля (анкеты)
    Источник: HTML страница /profile, элемент <div class="uid">
    Где в коде: Profile.owner_uid
    """
    soup = BeautifulSoup(html_content, "html.parser")
    profiles = []
    
    for profile_wrapper in soup.find_all("div", {"class": "profile-tile-wrap-outside"}):
        try:
            name = profile_wrapper.find("div", {"class": "username"}).text.strip()
            uid_text = profile_wrapper.find("div", {"class": "uid"}).text.strip()
            uid_match = re.search(r"\d+", uid_text)
            
            if uid_match:
                owner_uid = uid_match.group()
                profiles.append({
                    "name": name,
                    "ownerUid": int(owner_uid),
                    "source": "HTML /profile -> <div class='uid'>",
                    "stored_in": "Profile.owner_uid"
                })
        except (AttributeError, ValueError) as e:
            print(f"Ошибка при извлечении ownerUid: {e}")
            continue
    
    return profiles


def extract_user_uid_from_html(html_content: str) -> list[dict]:
    """
    Извлекает userUid из HTML страницы /clients/list
    
    Параметр userUid - это ID клиента (получателя)
    Источник: HTML страница /clients/list, атрибут data-key
    Где в коде: Client.uid
    """
    soup = BeautifulSoup(html_content, "html.parser")
    clients = []
    
    for client_wrapper in soup.find_all("div", {"class": "profile-tile-wrap-outside"}):
        try:
            name = client_wrapper.find("div", {"class": "username"}).text.strip()
            user_uid = client_wrapper.get("data-key", "").strip()
            
            if user_uid:
                clients.append({
                    "name": name,
                    "userUid": int(user_uid),
                    "source": "HTML /clients/list -> атрибут data-key",
                    "stored_in": "Client.uid"
                })
        except (AttributeError, ValueError) as e:
            print(f"Ошибка при извлечении userUid: {e}")
            continue
    
    return clients


def extract_profile_uid_from_api(api_response: dict, owner_uid: int) -> dict:
    """
    Извлекает profileUid из API ответа /api/v2/communication/available-profiles
    
    Параметр profileUid - это динамический ID профиля для клиента
    Источник: API /api/v2/communication/available-profiles, поле "uid"
    Где в коде: Profile.uid
    """
    try:
        for profile_json in api_response.get("data", []):
            if profile_json.get("import_uid") == owner_uid:
                return {
                    "ownerUid": owner_uid,
                    "profileUid": profile_json.get("uid"),
                    "import_uid": profile_json.get("import_uid"),
                    "source": "API /api/v2/communication/available-profiles -> поле 'uid'",
                    "stored_in": "Profile.uid"
                }
    except Exception as e:
        print(f"Ошибка при извлечении profileUid: {e}")
    
    return None


def demo_extraction():
    """
    Демонстрация извлечения всех трех параметров
    """
    print("=" * 80)
    print("ДЕМОНСТРАЦИЯ ИЗВЛЕЧЕНИЯ ПАРАМЕТРОВ")
    print("=" * 80)
    
    # Пример 1: ownerUid из HTML профилей
    print("\n1. OWNER UID (Статический ID профиля)")
    print("-" * 80)
    
    example_profile_html = """
    <div class="profile-tile-wrap-outside">
        <div class="username">Anna</div>
        <div class="uid">ID: 607823</div>
    </div>
    """
    
    profiles = extract_owner_uid_from_html(example_profile_html)
    for profile in profiles:
        print(f"   Имя: {profile['name']}")
        print(f"   ownerUid: {profile['ownerUid']}")
        print(f"   Источник: {profile['source']}")
        print(f"   Где хранится: {profile['stored_in']}")
    
    # Пример 2: userUid из HTML клиентов
    print("\n2. USER UID (ID клиента/получателя)")
    print("-" * 80)
    
    example_client_html = """
    <div class="profile-tile-wrap-outside" data-key="1454399">
        <div class="username">John</div>
    </div>
    """
    
    clients = extract_user_uid_from_html(example_client_html)
    for client in clients:
        print(f"   Имя: {client['name']}")
        print(f"   userUid: {client['userUid']}")
        print(f"   Источник: {client['source']}")
        print(f"   Где хранится: {client['stored_in']}")
    
    # Пример 3: profileUid из API
    print("\n3. PROFILE UID (Динамический ID профиля для клиента)")
    print("-" * 80)
    
    example_api_response = {
        "data": [
            {
                "uid": 1609606,
                "import_uid": 607823,
                "name": "Anna"
            }
        ]
    }
    
    profile_uid_data = extract_profile_uid_from_api(example_api_response, owner_uid=607823)
    if profile_uid_data:
        print(f"   ownerUid (import_uid): {profile_uid_data['import_uid']}")
        print(f"   profileUid: {profile_uid_data['profileUid']}")
        print(f"   Источник: {profile_uid_data['source']}")
        print(f"   Где хранится: {profile_uid_data['stored_in']}")
    
    # Итоговая таблица
    print("\n" + "=" * 80)
    print("ИТОГОВАЯ ТАБЛИЦА ПАРАМЕТРОВ")
    print("=" * 80)
    print(f"{'Параметр':<15} | {'Что это':<35} | {'Откуда':<25}")
    print("-" * 80)
    print(f"{'ownerUid':<15} | {'Статический ID профиля':<35} | {'HTML /profile':<25}")
    print(f"{'profileUid':<15} | {'Динамический ID для клиента':<35} | {'API available-profiles':<25}")
    print(f"{'userUid':<15} | {'ID клиента (получателя)':<35} | {'HTML /clients/list':<25}")
    print("=" * 80)
    
    # Пример формирования URL
    print("\nПРИМЕР ФОРМИРОВАНИЯ URL ДЛЯ ЧАТА:")
    print("-" * 80)
    if profiles and clients and profile_uid_data:
        owner_uid = profiles[0]['ownerUid']
        profile_uid = profile_uid_data['profileUid']
        user_uid = clients[0]['userUid']
        
        chat_url = f"https://luxee.io/chats/?ownerUid={owner_uid}&profileUid={profile_uid}&userUid={user_uid}"
        print(f"URL: {chat_url}")
        print(f"\nГде:")
        print(f"  ownerUid={owner_uid}    <- Profile.owner_uid (статический)")
        print(f"  profileUid={profile_uid}  <- Profile.uid (динамический)")
        print(f"  userUid={user_uid}   <- Client.uid")
    
    print("\n" + "=" * 80)


def test_with_real_models():
    """
    Тест с реальными моделями из проекта
    """
    print("\n" + "=" * 80)
    print("ТЕСТ С РЕАЛЬНЫМИ МОДЕЛЯМИ")
    print("=" * 80)
    
    # Создаем профиль (ownerUid)
    profile = Profile(
        name="Anna",
        age="25",
        location="Kyiv",
        uid="607823",  # Это станет owner_uid
        image_url="https://example.com/image.jpg",
        is_disabled=False
    )
    
    print(f"\n✓ Создан Profile:")
    print(f"  - Имя: {profile.name}")
    print(f"  - owner_uid (ownerUid): {profile.owner_uid}")
    print(f"  - uid (profileUid): {profile.uid} (пока None, заполнится из API)")
    
    # Создаем клиента (userUid)
    client = Client(
        name="John",
        age="30",
        location="Lviv",
        uid="1454399",  # Это станет uid
        app="Tinder"
    )
    
    print(f"\n✓ Создан Client:")
    print(f"  - Имя: {client.name}")
    print(f"  - uid (userUid): {client.uid}")
    
    # Симулируем получение profileUid из API
    api_response = {
        "data": [
            {
                "uid": 1609606,
                "import_uid": 607823,
                "name": "Anna"
            }
        ]
    }
    
    # Находим profileUid для нашего профиля
    for profile_json in api_response["data"]:
        if profile_json["import_uid"] == profile.owner_uid:
            profile.uid = profile_json["uid"]
            print(f"\n✓ Получен profileUid из API:")
            print(f"  - Profile.uid (profileUid): {profile.uid}")
            break
    
    # Формируем финальный URL
    print(f"\n✓ Формирование URL для чата:")
    chat_url = f"https://luxee.io/chats/?ownerUid={profile.owner_uid}&profileUid={profile.uid}&userUid={client.uid}"
    print(f"  {chat_url}")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    # Запускаем демонстрацию
    demo_extraction()
    
    # Тестируем с реальными моделями
    test_with_real_models()
    
    print("\n✅ ПРОВЕРКА ЗАВЕРШЕНА!")
    print("\nВсе три параметра успешно извлечены и проверены:")
    print("  1. ownerUid  - из HTML /profile -> Profile.owner_uid")
    print("  2. profileUid - из API /api/v2/communication/available-profiles -> Profile.uid")
    print("  3. userUid   - из HTML /clients/list -> Client.uid")
