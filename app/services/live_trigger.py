import threading
from datetime import datetime, timezone

from app.services.log_generator import LogGenerator, MODES


class LiveTrigger:
    """Owns one non-blocking generator worker for a Flask process."""

    def __init__(self, app):
        self.app = app
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.thread = None
        self.mode = None
        self.last_error = None

    @property
    def running(self):
        return bool(self.thread and self.thread.is_alive())

    def start(self, mode, user_id):
        if mode not in MODES:
            raise ValueError(f"mode must be one of {', '.join(MODES)}")
        with self.lock:
            if self.running:
                raise RuntimeError("generator is already running")
            self.mode, self.last_error = mode, None
            self.stop_event.clear()
            self.thread = threading.Thread(target=self._run, args=(mode, user_id), daemon=True, name="log-generator")
            self.thread.start()

    def stop(self):
        self.stop_event.set()
        thread = self.thread
        if thread:
            thread.join(timeout=5)
        return not self.running

    def _run(self, mode, user_id):
        from app.repositories import upload_repository
        from app.services.log_processing_service import process_records

        generator = LogGenerator(seed=int(datetime.now(timezone.utc).timestamp()))
        interval = self.app.config["GENERATOR_INTERVAL_SECONDS"]
        batch_size = self.app.config["GENERATOR_BATCH_SIZE"]
        try:
            while not self.stop_event.is_set():
                records = generator.generate(mode, batch_size)
                with self.app.app_context():
                    upload = upload_repository.create(user_id, f"live-{mode}.memory", "memory", "generated", 0)
                    process_records(upload, records, "auto_generated")
                self.stop_event.wait(interval)
        except Exception as exc:
            self.last_error = str(exc)
            self.stop_event.set()
