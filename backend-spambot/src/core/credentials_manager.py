import base64
import csv
import hashlib
import json
import os

import cryptography.fernet
import psutil
import requests

# Encryption key (must be kept safe)
SECRET_KEY = base64.urlsafe_b64encode(hashlib.sha256(b"super_secure_key").digest())
cipher = cryptography.fernet.Fernet(SECRET_KEY)
USER_FILE = "luxee_bot_user_data.enc"
IN_USE_FILE = os.path.expanduser("~/.luxee_user_usage.json")


def save_user(username: str, password: str):
    encrypted_data = cipher.encrypt(json.dumps({"username": username, "password": password}).encode())
    with open(USER_FILE, "wb") as file:
        file.write(encrypted_data)


def clear_user():
    if os.path.exists(USER_FILE):
        os.remove(USER_FILE)


def load_user():
    if os.path.exists(USER_FILE):
        try:
            with open(USER_FILE, "rb") as file:
                decrypted_data = cipher.decrypt(file.read()).decode()
                return json.loads(decrypted_data)
        except Exception:
            return None
    return None


def is_username_available(username: str) -> bool:
    sheet_id = "1fMJScBUrr67eq81XkM2daw_vd-efnDCdwqjgYF3Vq5s"
    sheet_name = "Sheet1"
    col_name = "Доступные юзеры"

    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={sheet_name}"

    response = requests.get(csv_url)
    response.raise_for_status()

    lines = response.text.splitlines()
    reader = csv.reader(lines)

    data = list(reader)

    try:
        header = data[0]
    except IndexError:
        raise ValueError("No data found in the sheet")

    try:
        column_idx = header.index(col_name)
    except ValueError:
        raise ValueError(f"'{col_name}' not found in the sheet")

    available_usernames = []
    for row in data[1:]:
        value = row[column_idx].strip().lower()
        if value:
            available_usernames.append(value)

    if username.strip().lower() in available_usernames:
        return True
    return False


def _load_in_use_data():
    if os.path.exists(IN_USE_FILE):
        try:
            with open(IN_USE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_in_use_data(data: dict):
    with open(IN_USE_FILE, "w") as f:
        json.dump(data, f)


def mark_username_as_in_use(username: str):
    data = _load_in_use_data()
    data[username.lower()] = os.getpid()
    _save_in_use_data(data)


def unmark_username_as_in_use(username: str):
    data = _load_in_use_data()
    username = username.lower()
    if username in data:
        del data[username]
        _save_in_use_data(data)


def is_username_in_use(username: str) -> bool:
    data = _load_in_use_data()
    username = username.lower()
    pid = data.get(username)

    if pid is None:
        return False

    if psutil.pid_exists(pid):
        return True
    else:
        # Clean up stale entry
        unmark_username_as_in_use(username)
        return False
