import time
from fastapi import HTTPException

class RecordingsValidator:
    """Validator for Recordings API endpoints."""
    
    def validate_playback_request(self, timestamp: float) -> bool:
        """
        Validate that the requested timestamp is well-formed and sensible.
        Raises HTTPException on validation failure.
        """
        if timestamp <= 0:
            raise HTTPException(status_code=400, detail="Invalid timestamp provided. Must be > 0.")
            
        current_time = time.time()
        # Allow a small buffer (e.g., 1 hour) for clock sync issues
        if timestamp > current_time + 3600:
            raise HTTPException(status_code=400, detail="Timestamp is in the future.")
            
        return True
