from typing import Callable, Optional
from src.logger import logger
from src.luxee_site.luxee_browser import Luxee
from src.models import Distribution, Profile
from src.utils import save_selenium_error


def extract_profiles(username: str, password: str) -> list[Profile]:
    luxee = Luxee(username, password)
    try:
        logger.info("Extracting profiles...")
        profiles = luxee.get_profiles()
        logger.info(f"Extracted {len(profiles)} profiles.")
        return profiles
    except Exception as e:
        logger.exception(e)
        raise e
    finally:
        luxee.logout()


class DistributionProcess:
    def __init__(self):
        self.luxee: Luxee = None

    def start(
        self, 
        distribution: Distribution, 
        username: str, 
        password: str,
        should_stop_callback: Optional[Callable[[], bool]] = None,
        status_updater: Optional[Callable[[Optional[int], Optional[int], Optional[str]], None]] = None
    ):
        """
        Start distribution process
        
        Args:
            distribution: Distribution configuration
            username: Luxee username
            password: Luxee password
            should_stop_callback: Optional callback that returns True if distribution should stop
            status_updater: Optional callback for real-time status updates (sent_count, skipped_count, current_client)
        """
        if self.luxee is None:
            self.luxee = Luxee(username, password)

        try:
            if distribution.messages:
                self.luxee.start_distribution(distribution, should_stop_callback, status_updater)
            elif distribution.mail_message:
                self.luxee.start_mail_distribution(distribution, should_stop_callback, status_updater)
            else:
                raise ValueError("No messages or mail message provided for distribution.")
        except Exception as e:
            save_selenium_error(self.luxee.browser, e)
            raise e

    def finish(self):
        if self.luxee:
            self.luxee.logout()
