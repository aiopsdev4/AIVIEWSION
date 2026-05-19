from typing import Optional
from frigate.models import Recordings

class RecordingsRepository:
    """Repository for accessing Recording data from the database."""
    
    def get_recording_by_timestamp(self, camera_name: str, timestamp: float) -> Optional[Recordings]:
        """Fetch a single recording segment that encapsulates the given timestamp."""
        return (
            Recordings.select()
            .where(
                Recordings.camera == camera_name,
                Recordings.start_time <= timestamp,
                Recordings.end_time >= timestamp
            )
            .first()
        )
