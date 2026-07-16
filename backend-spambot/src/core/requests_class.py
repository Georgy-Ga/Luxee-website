"""A wrapper module for making HTTP requests using requests."""
import time
from typing import Any

from requests import Session, Response

from src.core.logger import logger


class Requests:
    def __init__(self, headers: dict[str, str] = None, cookies: dict[str, str] | str = None):
        self.session = Session()
        self.last_used = 0

        if headers:
            for key, value in headers.items():
                self.session.headers[key] = value

        if cookies:
            for key, value in cookies.items():
                self.session.cookies.set(key, value)

    def __wait_if_needed(self):
        elapsed = time.time() - self.last_used
        if elapsed < 1.0:
            time_to_wait = 1.0 - elapsed
            time.sleep(time_to_wait)

    def __reset_if_stale(self):
        if time.time() - self.last_used > 240:
            old_cookies = self.session.cookies.get_dict()
            headers = dict(self.session.headers)
            self.session.close()
            self.session = Session()
            self.session.cookies.update(old_cookies)
            self.session.headers.update(headers)
            self.last_used = time.time()
            logger.info("Session reset due to staleness.")

    def __handle_response(self, response: Response):
        response.raise_for_status()
        return response.json() if "application/json" in response.headers.get("Content-Type", "") else response.text

    def get(
            self,
            url: str,
            data: Any = None,
            json: Any = None,
            headers: dict[str, str] = None,
            params: dict[str, Any] = None,
    ):
        self.__wait_if_needed()
        self.__reset_if_stale()
        response = self.session.get(url, data=data, json=json, headers=headers, params=params, timeout=120)
        self.last_used = time.time()
        return self.__handle_response(response)

    def post(
            self,
            url: str,
            data: Any = None,
            json: Any = None,
            headers: dict[str, str] = None,
            params: dict[str, Any] = None,
    ):
        self.__wait_if_needed()
        self.__reset_if_stale()
        response = self.session.post(url, data=data, json=json, headers=headers, params=params, timeout=120)
        self.last_used = time.time()
        return self.__handle_response(response)
