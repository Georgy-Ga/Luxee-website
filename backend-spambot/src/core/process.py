from src.core.logger import logger
from src.core.luxee_site.luxee_browser import Luxee
from src.core.models import Distribution, Profile
from src.core.utils import save_selenium_error


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

    def start(self, distribution: Distribution, username: str, password: str):
        if self.luxee is None:
            self.luxee = Luxee(username, password)

        try:
            if distribution.messages:
                self.luxee.start_distribution(distribution)
            elif distribution.mail_message:
                self.luxee.start_mail_distribution(distribution)
            else:
                raise ValueError("No messages or mail message provided for distribution.")
        except Exception as e:
            save_selenium_error(self.luxee.browser, e)
            raise e

    def finish(self):
        if self.luxee:
            self.luxee.logout()
