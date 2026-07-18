import random
import re
import time

from RPA.Browser.Selenium import Selenium
from SeleniumLibrary.errors import SeleniumLibraryException, NoOpenBrowser
from bs4 import BeautifulSoup
from requests import HTTPError, ReadTimeout
from requests.exceptions import ConnectionError as RequestConnectionError
from selenium.common import WebDriverException, InvalidSessionIdException, StaleElementReferenceException
from selenium.webdriver import ActionChains, Keys
from urllib3.exceptions import ProtocolError

from config import CONFIG
from src.exceptions import UserBlockedError, CompleteDestributionError, LuxeeLoginError, StopDestributionError
from src.logger import logger
from src.luxee_site.luxee_requests import LuxeeRequests
from src.models import Profile, Client, Distribution, Message, MailMessage
from src.utils import compare_strings_ignore_symbols, save_selenium_error, sanitize_list, sanitize_str

# ❌ REMOVED: Global BROWSER = Selenium()
# Each Luxee instance now creates its own browser for isolation


def relogin_and_retry_if_site_fail(retries: int = 3) -> callable:
    """Base decorator to relogin and retry if specified exceptions occur."""

    def decorator(func: callable) -> callable:
        def wrapper(self: "Luxee", *args, **kwargs) -> callable:
            tries = 0
            exception = None
            while tries < retries:
                try:
                    result = func(self, *args, **kwargs)
                    break
                except (
                        SeleniumLibraryException, AssertionError, WebDriverException, HTTPError, ConnectionError,
                        RequestConnectionError, NoOpenBrowser,
                        ProtocolError, InvalidSessionIdException, ReadTimeout) as e:
                    logger.error(f"Error occurred: {e}. Retrying...")
                    self.logout()
                    self.login()
                    exception = e
                    tries += 1
            else:
                raise exception
            return result

        return wrapper

    return decorator


class Luxee:
    def __init__(self, username: str, password: str):
        """Initialize the class."""
        self.username = username
        self.password = password
        self.url = "https://luxee.io/"
        # ✅ Each instance creates its OWN browser for parallel execution
        self.browser = Selenium()

        self.requests = LuxeeRequests()
        self.login()

    def login(self):
        """Login to the website."""
        logger.info("Logging in...")
        self.browser.open_available_browser(self.url, headless=CONFIG.HIDDEN_BROWSER)
        try:
            self.browser.wait_until_element_is_visible('//*[@class="log__in"]')
            self.browser.click_button('//button[@class="log__in"]')

            self.browser.wait_until_element_is_visible('//input[@id="userIdentifierId"]')
            self.browser.input_text('//input[@id="userIdentifierId"]', self.username)
            self.browser.input_text('//input[@id="passwordId"]', self.password)
            self.browser.click_button('//button[text()="Sign in"]')

            try:
                self.browser.wait_until_element_is_visible('//nav[@role="navigation"]')
            except AssertionError:
                if self.browser.is_element_visible('//p[contains(@class, "error-text form")]'):
                    error_text = self.browser.get_text('//p[contains(@class, "error-text form")]')
                    raise LuxeeLoginError(error_text)
                else:
                    raise LuxeeLoginError("Unknown error occurred during login")

            self.requests.authorize(self.browser.get_cookies(as_dict=True))
            logger.info("Logged in successfully")
        except LuxeeLoginError as e:
            self.browser.close_browser()
            raise e
        except Exception as e:
            save_selenium_error(self.browser, e)
            self.browser.close_browser()
            raise e

    def __extract_profiles(self, html_page: str) -> list[Profile]:
        soup = BeautifulSoup(html_page, "html.parser")

        profiles: list[Profile] = []
        for profile_wrapper in soup.find_all("div", {"class": "profile-tile-wrap-outside"}):
            name = profile_wrapper.find("div", {"class": "username"}).text.strip()
            location = profile_wrapper.find("div", {"class": "location"}).text.strip()
            age = profile_wrapper.find("div", {"class": "age"}).text.strip()
            uid_text = profile_wrapper.find("div", {"class": "uid"}).text.strip()
            
            # Debug log to see what we're extracting from HTML
            logger.debug(f"[HTML Extract] Profile: name='{name}', age='{age}', location='{location}', uid='{uid_text}'")
            
            try:
                uid = re.search(r"\d+", uid_text).group()
            except AttributeError:
                logger.warning(f"Could not extract UID from {uid_text} for profile '{name}'")
                continue

            # Extract image URL
            style_attr = profile_wrapper.find("a", {"class": "profile-tile-wrap__img"})["style"]
            if match := re.search(r'url\("(.*?)"\)', style_attr):
                url = match.group(1)
            else:
                url = None

            is_disabled = "Disabled" in profile_wrapper.find("div", {"class": "profile-tile-wrap__action"}).text

            profiles.append(Profile(name, age, location, uid, url, is_disabled))
        return profiles

    def __extract_profile_apps_from_settings_page(self, html_page: str) -> list[str]:
        soup = BeautifulSoup(html_page, "html.parser")

        apps = []
        div = soup.find('div', id='fakeprofilemodel-apps')
        if div:
            for label in div.find_all('label', class_='checkbox'):
                app = label.get_text(strip=True)
                if app:
                    apps.append(app)
        return apps

    @relogin_and_retry_if_site_fail()
    def get_profiles(self) -> list[Profile]:
        try:
            profiles_html = self.requests.get_profiles()
            profiles = self.__extract_profiles(profiles_html)
            for profile in profiles:
                settings_str = self.requests.get_profile_settings(profile.owner_uid)
                profile.apps = self.__extract_profile_apps_from_settings_page(settings_str)
            return profiles
        except Exception as e:
            save_selenium_error(self.browser, e)
            raise e

    def __extract_clients(self, html_page: str) -> list[Client]:
        soup = BeautifulSoup(html_page, "html.parser")
        clients = []
        for client_wrapper in soup.find_all("div", {"class": "profile-tile-wrap-outside"}):
            try:
                name = client_wrapper.find("div", {"class": "username"}).text.strip()
                age = client_wrapper.find("div", {"class": "age"}).text.strip()
                location = client_wrapper.find("div", {"class": "location"}).text.strip()
                uid = client_wrapper["data-key"].strip()
                
                # app может отсутствовать, используем значение по умолчанию
                app_element = client_wrapper.find("span", {"class": "application-wrap"})
                app = app_element.text.strip() if app_element else "Unknown"

                clients.append(Client(name, age, location, uid, app))
            except (AttributeError, KeyError) as e:
                logger.warning(f"Failed to extract client data: {e}")
                continue
        return clients

    def _get_clients_list(self, purchased: bool, free: bool) -> list[Client]:
        if purchased and free:
            purchased_enabled = None
        elif purchased:
            purchased_enabled = True
        elif free:
            purchased_enabled = False
        else:
            raise ValueError("At least one of 'purchased' or 'free' must be True")

        clients_html = self.requests.get_clients_list(purchased_enabled)
        return self.__extract_clients(clients_html)

    def _is_profile_available_for_user(self, client_id: int, profile: Profile) -> bool:
        result = self.requests.get_available_profiles(client_id)
        for profile_json in result["data"]:
            if profile_json["import_uid"] == profile.owner_uid:
                profile.uid = profile_json["uid"]
                return True
        else:
            return False

    def _is_user_online(self, client: Client) -> bool:
        """
        Проверяет онлайн статус пользователя в чате.
        Возвращает True если пользователь онлайн, False если офлайн.
        """
        try:
            # Проверяем наличие класса "offline" у элемента chat_title-opponent
            chat_title_element = self.browser.find_element('//div[@id="chat_title-opponent"]')
            class_attribute = chat_title_element.get_attribute("class")
            
            # Если есть класс "offline" - пользователь офлайн
            if "offline" in class_attribute:
                logger.info(f"User {client.name} (ID: {client.uid}) is OFFLINE - skipping")
                return False
            else:
                logger.info(f"User {client.name} (ID: {client.uid}) is ONLINE")
                return True
        except Exception as e:
            logger.warning(f"Could not determine online status for user {client.uid}: {e}")
            # В случае ошибки считаем что пользователь онлайн (чтобы не пропустить)
            return True

    def visit_chat(self, client: Client, profile: Profile):
        self.browser.go_to(
            f"https://luxee.io/chats/?ownerUid={profile.owner_uid}&profileUid={profile.uid}&userUid={client.uid}"
        )

        # Wait until user is loaded
        self.browser.wait_until_element_is_enabled(
            f'//div[@id="chat_title-opponent"]//*[@data-member-uid="{client.uid}"]', timeout=30
        )
        # Wait until chat messages are loaded
        try:
            self.browser.wait_until_element_is_enabled('//div[@id="message-main-wrap"]/div')
        except AssertionError:
            logger.warning("Chat messages are not loaded.")  # Maybe the case when "no messages" div is not visible

    def visit_mail_chat(self, client: Client, profile: Profile):
        self.browser.go_to(
            f"https://luxee.io/communication/mail/?ownerUid={profile.owner_uid}&userUid={client.uid}"
        )

        # Wait until user is loaded
        self.browser.wait_until_element_is_enabled(
            f'//div[@id="mail-info-container"]//li//p[strong[contains(text(), "ID")] and contains(normalize-space(.), "{client.uid}")]',
            timeout=30
        )

        # Wait until message input field is loaded
        self.browser.wait_until_element_is_enabled('//input[@id="message-title-area"]')

        # Wait until chat messages are loaded
        try:
            self.browser.wait_until_element_is_enabled('//div[@id="mailsContainer"]/ul/li', timeout=2)
        except AssertionError:
            pass  # It means no messages exist

    def _are_there_any_messages_in_chat(self) -> bool:
        # Make sure chat is loaded
        # Waiting for messages div or for div with text "No messages"
        self.browser.wait_until_element_is_enabled(
            '//div[@id="message-main-wrap"]/div[contains(@class, "messages") or @class="empty-wrap"]'
        )

        messages_count = self.browser.get_element_count(
            '//div[@id="message-main-wrap"]/div[contains(@class, "messages")]'
        )
        if messages_count > 0:
            return True
        else:
            return False

    def _are_there_any_mails(self) -> bool:
        self.browser.wait_until_element_is_enabled('//div[@id="mailsContainer"]')

        mails_count = self.browser.get_element_count('//div[@id="mailsContainer"]/ul/li')
        if mails_count > 0:
            return True
        else:
            return False

    def _type_naturally(self, locator: str, text: str):
        input_element = self.browser.find_element(locator)

        input_element.click()
        actions = ActionChains(self.browser.driver)

        for char in text:
            if char == '\n':
                actions.key_down(Keys.SHIFT).send_keys(Keys.ENTER).key_up(Keys.SHIFT)
            else:
                actions.send_keys(char)

        actions.perform()

    def _send_message(self, message_text: str):
        input_text_xpath = '//div[@id="type-main-wrap"]//*[@contenteditable]'
        try:
            self.browser.wait_until_element_is_visible(input_text_xpath)
        except AssertionError:
            raise UserBlockedError(
                "Input field for message is not available. Maybe user has blocked you. Cannot send messages."
            )

        # Send message
        self._type_naturally(input_text_xpath, message_text)
        if CONFIG.SKIP_SENDING_MESSAGE:
            logger.info(f"Skip Sending message in DEV_MODE.")
            return

        self.browser.click_element_when_visible('//button[@id="send-button"]')

        # Wait until message is sent
        timeout = time.time() + 15
        last_message_text = ""
        while time.time() < timeout:
            messages_text_xpath = (
                '//div[@id="message-main-wrap"]/div[contains(@class, "messages")]//*[@class="chat-full-message"]'
            )
            try:
                last_message_text = self.browser.find_elements(messages_text_xpath)[-1].text
            except StaleElementReferenceException:
                continue
            if compare_strings_ignore_symbols(last_message_text, message_text):
                break
        else:
            raise TimeoutError(f"Message '{message_text}' was sent but not appeared in chat. "
                               f"The last message in chat was '{last_message_text}'")

    def send_messages(self, client: Client, messages: list[Message], retries: int = 1):
        """Отправка сообщений с возможностью повторных попыток"""
        self.browser.wait_until_element_is_enabled('//div[@id="chat_title-opponent"]')
        if self.browser.is_element_visible('//div[@id="user-block-notify"]'):
            raise UserBlockedError("User has blocked you. Cannot send messages.")

        logger.info(f"Sending messages to client '{client}'.")
        for message in messages:
            time.sleep(message.interval)
            
            # Попытки отправки с retry
            for attempt in range(retries):
                try:
                    self._send_message(message.text)
                    logger.info(f"Sent message: '{message.text}'")
                    break  # Успешно отправлено
                except Exception as e:
                    if attempt < retries - 1:
                        logger.warning(f"Failed to send message (attempt {attempt + 1}/{retries}): {e}. Retrying...")
                        time.sleep(2)
                    else:
                        logger.error(f"Failed to send message after {retries} attempts: {e}")
                        raise

    def _send_mail(self, mail: MailMessage):
        input_mail_title_xpath = '//input[@id="message-title-area"]'
        input_text_xpath = '//div[@id="inputFieldContainer"]//*[@contenteditable]'
        try:
            self.browser.wait_until_element_is_visible(input_mail_title_xpath)
            self.browser.wait_until_element_is_visible(input_text_xpath)
        except AssertionError:
            raise UserBlockedError(
                "Input field for message is not available. Maybe user has blocked you. Cannot send messages."
            )

        # Type title
        self._type_naturally(input_mail_title_xpath, mail.title)

        # Type text
        self._type_naturally(input_text_xpath, mail.text)

        # Send message
        if CONFIG.SKIP_SENDING_MESSAGE:
            logger.info(f"Skip Sending mail in DEV_MODE.")
            return

        self.browser.click_element_when_visible('//button[@id="send-button"]')

        try:
            self.browser.wait_until_element_is_visible('//div[@role="alert"]/div', timeout=3)
            alert_message = self.browser.get_text('//div[@role="alert"]/div')
        except AssertionError:
            alert_message = ""

        # Wait until message is sent
        timeout = time.time() + 40
        last_mail_title = ""
        last_mail_text = ""
        while time.time() < timeout:
            mails_text_and_title_xpath = '//div[@id="mailsContainer"]/ul/li//*[@class="message"]'
            try:
                last_mail_title = self.browser.find_elements(mails_text_and_title_xpath)[-2].text
                last_mail_text = self.browser.find_elements(mails_text_and_title_xpath)[-1].text
            except (StaleElementReferenceException, IndexError):
                continue
            if compare_strings_ignore_symbols(last_mail_title, mail.title) and compare_strings_ignore_symbols(
                    last_mail_text, mail.text):
                break
        else:
            if alert_message:
                raise StopDestributionError(alert_message)
            else:
                raise TimeoutError(
                    f"Mail with title '{mail.title}' and text '{mail.text}' was sent but not appeared in mail chat. "
                    f"The last mail in chat with title '{last_mail_title}' and text '{last_mail_text}'"
                )

    def __select_image_for_mail(self, pic_num: int):
        image_checbox_xpath = '//div[@id="communication-files"]//div[@class="thumbnail" and .//img]//input[@type="checkbox"]'
        self.browser.wait_until_element_is_visible(image_checbox_xpath)
        images = self.browser.find_elements(image_checbox_xpath)

        image = images[pic_num - 1]
        self.browser.driver.execute_script(
            "arguments[0].scrollIntoView({behavior: 'auto', block: 'center'});", image
        )

        time.sleep(1)
        self.browser.click_element_when_visible(image)
        time.sleep(1)

        self.browser.checkbox_should_be_selected(image)

    def _select_images_for_mail(self, mail: MailMessage):
        self.browser.wait_until_element_is_enabled('//button[@id="select-communication-file"]')
        self.browser.click_button('//button[@id="select-communication-file"]')
        self.browser.wait_until_element_is_visible('//div[@id="communication-files"]')
        time.sleep(5)

        for pic_num in mail.pictures_number:
            self.__select_image_for_mail(pic_num)

        self.browser.click_button("//button[text()='Attach files']")
        logger.info(f"Selected images: {', '.join(map(str, mail.pictures_number))}")

    def send_mail(self, client: Client, mail: MailMessage):
        self.browser.wait_until_element_is_enabled('//div[@id="inputFieldContainer"]')
        if self.browser.is_element_visible('//div[@id="user-block-notify"]'):
            raise UserBlockedError("User has blocked you. Cannot send messages.")

        logger.info(f"Sending mail to client '{client}'.")

        if mail.pictures_number:
            self._select_images_for_mail(mail)
            time.sleep(len(mail.pictures_number) * 3)  # Wait for the images to be selected

        self._send_mail(mail)
        logger.info(f"Sent message with title: '{mail.title}'")

    def logout(self):
        """Logout from the website."""
        try:
            self.browser.click_element_when_visible('//a[contains(@class, "user-profile")]')
            self.browser.click_element_when_visible('//a[contains(@href, "logout")]')
            self.browser.handle_alert()
            logger.info("Logged out successfully")
        except Exception as e:
            logger.error(f"Failed to logout: {e}")
        try:
            self.browser.close_browser()
        except Exception as e:
            logger.error(f"Failed to close browser: {e}")

    def _create_clients_from_ids(self, user_ids: list[int]) -> list[Client]:
        """Создает список клиентов из списка ID"""
        clients = []
        for user_id in user_ids:
            # Создаем "пустого" клиента только с ID
            client = Client(
                name=f"User_{user_id}",
                age="?",
                location="?",
                uid=str(user_id),
                app="?"
            )
            clients.append(client)
        return clients

    def filter_clients(self, distribution: Distribution) -> list[Client]:
        # Если указаны конкретные пользователи - используем их
        if distribution.specific_users:
            logger.info(f"Using specific users list: {distribution.specific_users}")
            
            # ВАЖНО: Нужно получить токен для API, даже если не используем список клиентов
            # Делаем запрос к clients/list чтобы извлечь токен для available-profiles API
            logger.info("Fetching token for API requests...")
            time.sleep(10)  # Wait for 10 seconds to avoid being blocked by the server
            self._get_clients_list(purchased=True, free=True)  # Получаем токен (запрашиваем всех клиентов)
            
            clients_full = self._create_clients_from_ids(distribution.specific_users)
            logger.info(f"Created {len(clients_full)} clients from specific IDs.")
        else:
            logger.info("Updating clients list.")
            time.sleep(10)  # Wait for 10 seconds to avoid being blocked by the server

            clients_full = self._get_clients_list(purchased=distribution.purchased, free=distribution.free)
            logger.info(f"Found {len(clients_full)} clients by filters.")

            # Фильтруем по apps ТОЛЬКО если список не пустой
            if distribution.apps:
                clients_full = [client for client in clients_full if
                                sanitize_str(client.app) in sanitize_list(distribution.apps)]
                logger.info(f"Filtered {len(clients_full)} clients by apps: {', '.join(distribution.apps)}")
            else:
                logger.info(f"No apps filter applied (apps list is empty), keeping all {len(clients_full)} clients.")

        clients = [client for client in clients_full if client.uid not in distribution.processed_clients]
        if len(clients_full) != len(clients):
            logger.info(f"Filtered out {len(clients_full) - len(clients)} clients that were already processed.")

        return clients

    def _get_last_messages(self, profile_uid: int, messages_count: int) -> list[str]:
        messages_texts_xpath = f'//div[@id="message-main-wrap"]/div[contains(@class, "messages") and @data-member-uid="{profile_uid}"]//*[@class="chat-full-message"]'
        return [e.text for e in self.browser.find_elements(messages_texts_xpath)[-messages_count:]]

    def _get_last_mails(self, mails_count: int) -> list[str]:
        messages_texts_xpath = f'//div[@id="mailsContainer"]/ul/li//*[@class="message"]'
        return [e.text for e in self.browser.find_elements(messages_texts_xpath)[-mails_count * 2:]]

    def _check_if_messages_was_sent_recently(self, distribution: Distribution) -> bool:
        last_messages = self._get_last_messages(distribution.profile.uid, len(distribution.messages))
        for message in distribution.messages:
            if all(compare_strings_ignore_symbols(message.text, last_message) for last_message in last_messages):
                return True
        return False

    def _check_if_mail_was_sent_recently(self, distribution: Distribution) -> bool:
        last_mails_and_titles = self._get_last_mails(10)

        for mail_or_title_text in last_mails_and_titles:
            if compare_strings_ignore_symbols(distribution.mail_message.text, mail_or_title_text):
                return True
        return False

    @relogin_and_retry_if_site_fail()
    def start_distribution(self, distribution: Distribution, should_stop_callback=None, status_updater=None):
        """Starts the distribution process."""
        start_time = time.time()

        while distribution.sent_messages_count < distribution.limit:
            # Check if we should stop
            if should_stop_callback and should_stop_callback():
                logger.info("Distribution stopped by external request")
                break
                
            if distribution.max_time_minutes > 0:
                elapsed_time = (time.time() - start_time) / 60
                if elapsed_time >= distribution.max_time_minutes:
                    logger.info(f"Time limit reached ({distribution.max_time_minutes} minutes). "
                                f"Stopping distribution!")
                    break
            try:
                clients = self.filter_clients(distribution)

                logger.info(f"Searching for available clients for '{distribution.profile.name}' profile.")

                sent_messages_on_page = 0

                for client in clients:
                    if sent_messages_on_page >= distribution.filter_update_limit:
                        break

                    distribution.processed_clients.append(client.uid)

                    # Для конкретных пользователей пытаемся отправить 3 раза
                    retry_attempts = 3 if distribution.specific_users else 1
                    
                    # Попытки отправки с retry
                    message_sent = False
                    for attempt in range(retry_attempts):
                        try:
                            available = self._is_profile_available_for_user(client.uid, distribution.profile)
                            time.sleep(2)  # Wait for 1.5 seconds to avoid being blocked by the server

                            if not available:
                                distribution.skipped_clients += 1
                                logger.info(f"Profile '{distribution.profile}' is not available for client '{client}'")
                                break

                            if client.uid in distribution.exclude:
                                distribution.skipped_clients += 1
                                logger.info(f"Skip client {client} because it is in EXCLUDE list.")
                                break

                            logger.info(f"Visiting chat with client '{client}'.")
                            self.visit_chat(client, distribution.profile)

                            # Проверка онлайн статуса ТОЛЬКО для конкретных пользователей
                            if distribution.specific_users:
                                if not self._is_user_online(client):
                                    distribution.skipped_clients += 1
                                    logger.info(f"Skip client {client} because user is OFFLINE.")
                                    break

                            any_messages_in_chat = self._are_there_any_messages_in_chat()
                            if distribution.only_empty_chat and any_messages_in_chat:
                                distribution.skipped_clients += 1
                                logger.info(f"Skip client {client} because chat is not empty.")
                                break
                            if distribution.only_not_empty_chat and not any_messages_in_chat:
                                distribution.skipped_clients += 1
                                logger.info(f"Skip client {client} because chat is empty.")
                                break

                            if any_messages_in_chat:
                                if self._check_if_messages_was_sent_recently(distribution):
                                    distribution.skipped_clients += 1
                                    logger.info(f"Skip client {client} because this messages was already sent recently.")
                                    break

                            self.send_messages(client, distribution.messages, retries=1)
                            message_sent = True
                            break  # Успешно отправлено
                            
                        except Exception as e:
                            if attempt < retry_attempts - 1:
                                logger.warning(f"Failed to send to client {client} (attempt {attempt + 1}/{retry_attempts}): {e}. Retrying...")
                                time.sleep(3)
                            else:
                                logger.error(f"Failed to send to client {client} after {retry_attempts} attempts: {e}. Skipping...")
                                distribution.skipped_clients += 1
                                break
                    
                    if message_sent:
                        sent_messages_on_page += 1
                        distribution.sent_messages_count += 1
                        
                        # Call status_updater for real-time updates
                        if status_updater:
                            status_updater(
                                sent=distribution.sent_messages_count,
                                skipped=distribution.skipped_clients,
                                client=str(client.uid)
                            )

                        if distribution.sent_messages_count >= distribution.limit:
                            raise CompleteDestributionError("Limit reached")
                        else:
                            sleep_seconds = random.randint(10, 30)
                            logger.info(f"Waiting for {sleep_seconds} seconds before send to next client.")
                            time.sleep(sleep_seconds)
            except CompleteDestributionError:
                logger.info("Distribution completed")
                break

    @relogin_and_retry_if_site_fail()
    def start_mail_distribution(self, distribution: Distribution, should_stop_callback=None, status_updater=None):
        """Starts the distribution process."""
        start_time = time.time()

        while distribution.sent_messages_count < distribution.limit:
            # Check if we should stop
            if should_stop_callback and should_stop_callback():
                logger.info("Distribution stopped by external request")
                break
                
            if distribution.max_time_minutes > 0:
                elapsed_time = (time.time() - start_time) / 60
                if elapsed_time >= distribution.max_time_minutes:
                    logger.info(f"Time limit reached ({distribution.max_time_minutes} minutes). "
                                f"Stopping distribution!")
                    break
            try:
                clients = self.filter_clients(distribution)

                logger.info(f"Searching for available clients for '{distribution.profile.name}' profile.")

                sent_messages_on_page = 0

                for client in clients:
                    if sent_messages_on_page >= distribution.filter_update_limit:
                        break

                    distribution.processed_clients.append(client.uid)

                    # Для конкретных пользователей пытаемся отправить 3 раза
                    retry_attempts = 3 if distribution.specific_users else 1
                    
                    # Попытки отправки с retry
                    message_sent = False
                    for attempt in range(retry_attempts):
                        try:
                            available = self._is_profile_available_for_user(client.uid, distribution.profile)
                            time.sleep(2)  # Wait for 1.5 seconds to avoid being blocked by the server

                            if not available:
                                distribution.skipped_clients += 1
                                logger.info(f"Profile '{distribution.profile}' is not available for client '{client}'")
                                break

                            if client.uid in distribution.exclude:
                                distribution.skipped_clients += 1
                                logger.info(f"Skip client {client} because it is in EXCLUDE list.")
                                break

                            logger.info(f"Visiting mails chat with client '{client}'.")
                            self.visit_mail_chat(client, distribution.profile)

                            # Проверка онлайн статуса ТОЛЬКО для конкретных пользователей
                            # Примечание: для mail чата нет онлайн индикатора, поэтому проверяем через обычный чат
                            if distribution.specific_users:
                                # Временно переходим в чат для проверки онлайн статуса
                                logger.info(f"Checking online status for client '{client}'...")
                                self.visit_chat(client, distribution.profile)
                                if not self._is_user_online(client):
                                    distribution.skipped_clients += 1
                                    logger.info(f"Skip client {client} because user is OFFLINE.")
                                    break
                                # Возвращаемся обратно в mail чат
                                logger.info(f"User is online, returning to mail chat...")
                                self.visit_mail_chat(client, distribution.profile)

                            any_messages_in_chat = self._are_there_any_mails()
                            if distribution.only_empty_chat and any_messages_in_chat:
                                distribution.skipped_clients += 1
                                logger.info(f"Skip client {client} because mails chat is not empty.")
                                break
                            if distribution.only_not_empty_chat and not any_messages_in_chat:
                                distribution.skipped_clients += 1
                                logger.info(f"Skip client {client} because mails chat is empty.")
                                break

                            if any_messages_in_chat:
                                if self._check_if_mail_was_sent_recently(distribution):
                                    distribution.skipped_clients += 1
                                    logger.info(f"Skip client {client} because this messages was already sent recently.")
                                    break

                            self.send_mail(client, distribution.mail_message)
                            message_sent = True
                            break  # Успешно отправлено
                            
                        except Exception as e:
                            if attempt < retry_attempts - 1:
                                logger.warning(f"Failed to send mail to client {client} (attempt {attempt + 1}/{retry_attempts}): {e}. Retrying...")
                                time.sleep(3)
                            else:
                                logger.error(f"Failed to send mail to client {client} after {retry_attempts} attempts: {e}. Skipping...")
                                distribution.skipped_clients += 1
                                break
                    
                    if message_sent:
                        sent_messages_on_page += 1
                        distribution.sent_messages_count += 1
                        
                        # Call status_updater for real-time updates
                        if status_updater:
                            status_updater(
                                sent=distribution.sent_messages_count,
                                skipped=distribution.skipped_clients,
                                client=str(client.uid)
                            )

                        if distribution.sent_messages_count >= distribution.limit:
                            raise CompleteDestributionError("Limit reached")
                        else:
                            sleep_seconds = random.randint(10, 30)
                            logger.info(f"Waiting for {sleep_seconds} seconds before send to next client.")
                            time.sleep(sleep_seconds)

            except CompleteDestributionError:
                logger.info("Distribution completed")
                break
