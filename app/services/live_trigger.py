"""LiveTrigger — background thread that generates synthetic log batches.

KEY FIX: each generator session creates ONE upload record. All batches
append to that single file instead of creating a new file per batch.
"""
import threading
from datetime import datetime, timezone

from app.services.log_generator import LogGenerator, MODES


class LiveTrigger:

    def __init__(self, app):
        self.app = app
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.thread = None
        self.mode = None
        self.last_error = None
        self.current_upload_id = None

    @property
    def running(self):
        return bool(self.thread and self.thread.is_alive())

    @property
    def status(self):
        return {
            "running": self.running,
            "mode": self.mode,
            "last_error": self.last_error,
            "upload_id": self.current_upload_id,
            "activity": f"generating {self.mode} traffic" if self.running else "idle",
            "source": {"name": f"synthetic-{self.mode}" if self.mode else "none"},
        }

    def start(self, mode: str, user_id: int):
        if mode not in MODES:
            raise ValueError(f"mode must be one of {', '.join(MODES)}")
        with self.lock:
            if self.running:
                raise RuntimeError("generator is already running")
            self.mode = mode
            self.last_error = None
            self.current_upload_id = None
            self.stop_event.clear()
            self.thread = threading.Thread(
                target=self._run,
                args=(mode, user_id),
                daemon=True,
                name="log-generator",
            )
            self.thread.start()

    def stop(self):
        self.stop_event.set()
        t = self.thread
        if t:
            t.join(timeout=5)
        return not self.running

    def _run(self, mode: str, user_id: int):
        from app.repositories import upload_repository
        from app.services.log_processing_service import process_records

        generator = LogGenerator(seed=int(datetime.now(timezone.utc).timestamp()))
        interval   = self.app.config.get("GENERATOR_INTERVAL_SECONDS", 2)
        batch_size = self.app.config.get("GENERATOR_BATCH_SIZE", 10)

        session_ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        file_name  = f"live-{mode}-{session_ts}.stream"

        try:
            with self.app.app_context():
                upload = upload_repository.create(
                    user_id, file_name, "stream", "generated", 0
                )
                self.current_upload_id = upload.id

            while not self.stop_event.is_set():
                records = generator.generate(mode, batch_size)
                with self.app.app_context():
                    process_records(upload, records, "auto_generated")
                self.stop_event.wait(interval)

        except Exception as exc:
            self.last_error = str(exc)
            self.stop_event.set()