"""Poll and process durable log-upload jobs."""

import logging
import time

from sqlalchemy import select, update

from backend.database import get_db
from backend.models.log_analysis import log_analyses
from backend.models.upload_job import upload_jobs
from backend.models.uploaded_file import uploaded_files
from backend.services.upload_processing import process_upload_job


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # A worker restart retries interrupted jobs from the beginning; processing is batch-safe.
    with get_db() as db:
        interrupted = db.execute(
            update(upload_jobs).where(upload_jobs.c.status == "processing")
            .values(status="queued", stage="queued", processed_records=0, error=None)
        )
        if interrupted.rowcount:
            db.execute(
                update(log_analyses).where(
                    log_analyses.c.id.in_(
                        select(upload_jobs.c.analysis_id).where(upload_jobs.c.status == "queued")
                    )
                ).values(status="pending")
            )
            db.execute(
                update(uploaded_files).where(
                    uploaded_files.c.id.in_(
                        select(upload_jobs.c.file_id).where(upload_jobs.c.status == "queued")
                    )
                ).values(status="queued")
            )
            logging.info("Re-queued %s interrupted upload job(s)", interrupted.rowcount)

    logging.info("Upload worker started")
    while True:
        with get_db() as db:
            job_id = db.execute(
                select(upload_jobs.c.id)
                .where(upload_jobs.c.status == "queued")
                .order_by(upload_jobs.c.created_at)
                .limit(1)
            ).scalar_one_or_none()
        if job_id:
            logging.info("Processing upload job %s", job_id)
            process_upload_job(job_id)
        else:
            time.sleep(1)


if __name__ == "__main__":
    main()
