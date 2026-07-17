"""
Скрипт для исправления файла блокировки
Запустите этот файл, если программа не открывается из-за блокировки
"""
import os
import json

# Путь к файлу блокировки
IN_USE_FILE = os.path.expanduser("~/.luxee_user_usage.json")

def fix_lock_file():
    """Очищает файл блокировки"""
    try:
        if os.path.exists(IN_USE_FILE):
            # Удаляем файл блокировки
            os.remove(IN_USE_FILE)
            print(f"✅ Файл блокировки удален: {IN_USE_FILE}")
            print("✅ Теперь можно запустить программу!")
        else:
            print(f"ℹ️  Файл блокировки не найден: {IN_USE_FILE}")
            print("ℹ️  Программа должна работать нормально")
    except Exception as e:
        print(f"❌ Ошибка при удалении файла: {e}")
        print(f"\nПопробуйте удалить файл вручную:")
        print(f"Путь: {IN_USE_FILE}")

if __name__ == "__main__":
    print("=" * 60)
    print("ИСПРАВЛЕНИЕ БЛОКИРОВКИ LUXEE BOT")
    print("=" * 60)
    print()
    
    fix_lock_file()
    
    print()
    print("=" * 60)
    input("Нажмите Enter для выхода...")
