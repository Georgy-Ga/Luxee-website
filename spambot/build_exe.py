"""
Скрипт для сборки EXE файла
Запустите: python build_exe.py
"""
import os
import subprocess
import sys

def build_exe():
    """Собирает EXE файл с помощью PyInstaller"""
    
    print("=" * 60)
    print("СБОРКА EXE ФАЙЛА LUXEE BOT")
    print("=" * 60)
    print()
    
    # Проверяем наличие PyInstaller
    try:
        import PyInstaller
        print("✅ PyInstaller установлен")
    except ImportError:
        print("❌ PyInstaller не установлен")
        print("Устанавливаю PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✅ PyInstaller установлен")
    
    print()
    print("Начинаю сборку...")
    print()
    
    # Команда для PyInstaller
    command = [
        "pyinstaller",
        "--name=LuxeeBot",
        "--onefile",
        "--windowed",
        "--icon=icon.ico",
        "--add-data=icon.ico;.",
        "--add-data=icon.png;.",
        "--hidden-import=tkinter",
        "--hidden-import=PIL",
        "--hidden-import=PIL._tkinter_finder",
        "--hidden-import=bs4",
        "--hidden-import=selenium",
        "--hidden-import=cryptography",
        "--hidden-import=RPA",
        "--hidden-import=RPA.Browser.Selenium",
        "--collect-all=RPA",
        "--collect-all=selenium",
        "--collect-all=webdriver_manager",
        "--noconfirm",
        "main.py"
    ]
    
    try:
        subprocess.check_call(command)
        print()
        print("=" * 60)
        print("✅ СБОРКА ЗАВЕРШЕНА УСПЕШНО!")
        print("=" * 60)
        print()
        print("EXE файл находится в папке: dist/LuxeeBot.exe")
        print()
    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print("❌ ОШИБКА ПРИ СБОРКЕ")
        print("=" * 60)
        print(f"Ошибка: {e}")
        print()
        return False
    
    return True

if __name__ == "__main__":
    success = build_exe()
    if success:
        print("Вы можете запустить: dist\\LuxeeBot.exe")
    print()
    input("Нажмите Enter для выхода...")
