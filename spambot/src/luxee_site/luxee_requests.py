import time

from requests import Session, ReadTimeout, HTTPError
from urllib3.exceptions import ProtocolError
from requests.exceptions import ConnectionError as RequestConnectionError

from src.requests_class import Requests
from src.utils import retry_on_exception, extract_token_that_closest_to_string


class Gender:
    male = "1"
    female = "2"


class PreferGender:
    men = "1"
    women = "2"
    everyone = "3"


class IsOnline:
    online = "10"
    offline = "1"
    all = "30"


class Purchased:
    free = "1"
    payed = "2"


retry_exceptions = (ReadTimeout, HTTPError, ProtocolError, ConnectionError, AttributeError, RequestConnectionError)


class LuxeeRequests:
    def __init__(self):
        """Initialize the class."""
        self._requests: Requests = None
        self.session = Session()
        self._clients_list_page_available_profiles_token = ""

    def authorize(self, cookies: dict[str, str]):
        self._requests = Requests(cookies=cookies)

    @retry_on_exception(exception_type=retry_exceptions, delay=10, retries=10)
    def get_profiles(self) -> str:
        return self._requests.get("https://luxee.io/profile")

    @retry_on_exception(exception_type=retry_exceptions, delay=10, retries=10)
    def get_profile_settings(self, profile_uid) -> str:
        return self._requests.get(f"https://luxee.io/profile/update/{profile_uid}")

    @retry_on_exception(exception_type=retry_exceptions, delay=10, retries=10)
    def get_clients_list(self, purchased: bool = None) -> str:
        if purchased is True:
            purchased = Purchased.payed
        elif purchased is False:
            purchased = Purchased.free
        else:
            purchased = ""
        params = {
            "token": "0",
            "ClientsFilterForm[s_gender]": Gender.male,
            "ClientsFilterForm[s_prefer_gender]": Gender.female,
            "ClientsFilterForm[country_id]": "",
            "ClientsFilterForm[age_from]": "",
            "ClientsFilterForm[age_to]": "",
            "ClientsFilterForm[is_online]": IsOnline.online,
            "ClientsFilterForm[purchased]": purchased,
            "ClientsFilterForm[range]": "",
        }

        result = self._requests.get("https://luxee.io/clients/list", params=params)

        # Extract token
        self._clients_list_page_available_profiles_token = extract_token_that_closest_to_string(result,
                                                                                                "available-profiles")
        return result

    @retry_on_exception(exception_type=retry_exceptions, delay=10, retries=10)
    def get_available_profiles(self, client_id: int) -> dict:
        params = {
            "user_uid": client_id,
            "_": str(int(time.time() * 1000)),
        }
        headers = {
            "Token": self._clients_list_page_available_profiles_token,
        }
        return self._requests.get(
            "https://luxee.io/api/v2/communication/available-profiles", headers=headers, params=params
        )
