import queue
import threading


class EventBroker:
    def __init__(self, max_queue_size=200):
        self.max_queue_size = max_queue_size
        self.lock = threading.Lock()
        self.subscribers = set()

    def subscribe(self):
        subscriber = queue.Queue(self.max_queue_size)
        with self.lock:
            self.subscribers.add(subscriber)
        return subscriber

    def unsubscribe(self, subscriber):
        with self.lock:
            self.subscribers.discard(subscriber)

    def publish(self, event):
        with self.lock:
            subscribers = tuple(self.subscribers)
        for subscriber in subscribers:
            try:
                subscriber.put_nowait(event)
            except queue.Full:
                try:
                    subscriber.get_nowait()
                    subscriber.put_nowait(event)
                except queue.Empty:
                    pass
