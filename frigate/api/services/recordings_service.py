from typing import Optional
from fastapi import Depends

from frigate.api.repositories.recordings_repository import RecordingsRepository
from frigate.api.validators.recordings_validator import RecordingsValidator

class RecordingsService:
    """Service layer coordinating validation and repository for recordings."""
    
    def __init__(
        self,
        repository: RecordingsRepository = Depends(),
        validator: RecordingsValidator = Depends()
    ):
        self.repository = repository
        self.validator = validator

    def get_recording_file_at(self, camera_name: str, timestamp: float) -> Optional[str]:
        """
        Validates the timestamp and returns the absolute path to the MP4 recording.
        Returns None if no recording matches the requested timestamp.
        """
        # 1. Validate the request parameters
        self.validator.validate_playback_request(timestamp)
        
        # 2. Fetch the recording from the database
        recording = self.repository.get_recording_by_timestamp(camera_name, timestamp)
        
        # 3. Return the file path if found
        if recording and recording.path:
            return recording.path
            
        return None
