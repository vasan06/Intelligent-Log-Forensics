import unittest
from pathlib import Path

from app.services.event_stream import EventBroker


class EventStreamTest(unittest.TestCase):
    def test_broker_delivers_to_and_removes_subscriber(self):
        broker = EventBroker()
        subscriber = broker.subscribe()
        broker.publish({"id": 7})
        self.assertEqual(subscriber.get_nowait(), {"id": 7})
        broker.unsubscribe(subscriber)
        self.assertEqual(len(broker.subscribers), 0)

    def test_chart_click_uses_twenty_percent_alpha(self):
        javascript = Path("app/static/js/dashboard.js").read_text(encoding="utf-8")
        self.assertIn("${color}33", javascript)
        self.assertIn('new EventSource("/api/v1/stream/live")', javascript)


if __name__ == "__main__":
    unittest.main()
