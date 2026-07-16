import functools
import html
import logging
import os
import re
import time
import traceback
from datetime import datetime

from RPA.Browser.Selenium import Selenium
from bs4 import BeautifulSoup

from src.core.logger import logger, last_logs_handler


def compare_strings_ignore_symbols(str1: str, str2: str) -> bool:
    def clean_text(text):
        text = html.unescape(text)
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text).strip()
        return re.sub(r'\s+', ' ', text).strip()  # Keep only letters, numbers, and spaces

    return clean_text(str1).lower() == clean_text(str2).lower()


def sanitize_str(string: str) -> str:
    return str(string).lower().strip()


def sanitize_list(str_list: list[str]) -> list[str]:
    return [sanitize_str(item) for item in str_list]


def save_selenium_error(browser: Selenium, exception: Exception):
    error_name = type(exception).__name__
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    base_dir = "lexee_errors"
    error_dir = os.path.join(base_dir, f"{timestamp}_{error_name}")
    os.makedirs(error_dir, exist_ok=True)

    try:
        screenshot_path = os.path.join(error_dir, "screenshot.png")
        browser.capture_page_screenshot(screenshot_path)
    except Exception as e:
        logger.error(f"Failed to save screenshot: {e}")

    try:
        html_path = os.path.join(error_dir, "page_source.html")
        with open(html_path, "w", encoding="utf-8") as file:
            file.write(browser.get_source())
    except Exception as e:
        logger.error(f"Failed to save HTML: {e}")

    traceback_path = os.path.join(error_dir, "traceback.txt")
    with open(traceback_path, "w", encoding="utf-8") as file:
        traceback.print_exc(file=file)

    recent_logs = last_logs_handler.get_logs()
    logs_path = os.path.join(error_dir, "recent_logs.txt")
    with open(logs_path, "w", encoding="utf-8") as file:
        file.write("\n".join(recent_logs))


def retry_on_exception(exception_type, retries=3, delay=1):
    """
    Decorator that retries the function if a specific exception occurs.
    :param exception_type: The exception type to catch.
    :param retries: Number of retries before giving up.
    :param delay: Delay (in seconds) between retries.
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            attempts = 0
            ex = None
            while attempts < retries:
                try:
                    return func(*args, **kwargs)
                except exception_type as e:
                    attempts += 1
                    logger.debug(f"Attempt {attempts} failed with error: {e}. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    ex = e
            logger.debug(f"Function {func.__name__} failed after {retries} retries.")
            raise ex

        return wrapper

    return decorator


def extract_token_that_closest_to_string(html: str, string: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    script_tags = soup.find_all("script")

    closest_token = None
    shortest_distance = float("inf")

    # Token pattern for JWT-like tokens
    token_pattern = r'eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+'

    for script in script_tags:
        if not script.string:
            continue
        content = script.string

        if string in content:
            # Get all token matches
            tokens = list(re.finditer(token_pattern, content))
            profile_pos = content.find('available-profiles')

            # Find the closest token by character distance
            for match in tokens:
                distance = abs(match.start() - profile_pos)
                if distance < shortest_distance:
                    shortest_distance = distance
                    closest_token = match.group()
    if closest_token is None:
        raise ValueError(f"Token not found in the html: {html}")
    return closest_token
