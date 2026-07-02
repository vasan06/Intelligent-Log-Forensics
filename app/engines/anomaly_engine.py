def detect(records):
    if not records:
        return []
    times = [record["response_time"] for record in records if record["response_time"] is not None]
    if len(times) < 4:
        return []
    average = sum(times) / len(times)
    threshold = max(1500, average * 3)
    return [
        {"record_index": index, "reason": "Response-time outlier", "score": 62}
        for index, record in enumerate(records)
        if (record["response_time"] or 0) > threshold
    ]

