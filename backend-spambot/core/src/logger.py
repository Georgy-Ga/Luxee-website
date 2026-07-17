"""Basic logging, centralized so sinks/other logging necessities can be customized centrally."""

import logging
import sys
from collections import deque


class CustomFormatter(logging.Formatter):
    """CustomFormatter class."""

    grey = "\x1b[0m"
    yellow = "\x1b[33m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"

    def __init__(self, fmt: str, defaults=None, datefmt=None):
        """Init method."""
        super().__init__(fmt, datefmt=datefmt, defaults=defaults)
        self.FORMATS = {
            logging.DEBUG: self.grey + fmt + self.reset,
            logging.INFO: self.grey + fmt + self.reset,
            logging.WARNING: self.yellow + fmt + self.reset,
            logging.ERROR: self.bold_red + fmt + self.reset,
            logging.CRITICAL: self.bold_red + fmt + self.reset,
        }
        self.defaults = defaults or {}

    def format(self, record):
        """Override 'format' method."""
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, defaults=self.defaults)
        return formatter.format(record)


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.propagate = False

handler = logging.StreamHandler(sys.stdout)
log_format = r"%(asctime)s - %(levelname)-7s [%(filename)s:%(lineno)s - %(funcName)s()] - %(message)s"

handler.setFormatter(CustomFormatter(log_format))
logger.addHandler(handler)

class LastLogsHandler(logging.Handler):
    def __init__(self, capacity=20):
        super().__init__()
        self.logs = deque(maxlen=capacity)

    def emit(self, record):
        log_entry = self.format(record)
        self.logs.append(log_entry)

    def get_logs(self):
        return list(self.logs)


last_logs_handler = LastLogsHandler(capacity=20)
last_logs_handler.setFormatter(logging.Formatter(log_format))
logger.addHandler(last_logs_handler)

if __name__ == "__main__":
    logger.debug("Debug logging test")
    logger.info("Info logging test")
    logger.warning("Warning logging test")
    logger.error("Error logging test")
    logger.exception(Exception("Exception logging test"))
