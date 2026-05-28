"""FastAPI router for network CCTV and NVR discovery."""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query, HTTPException

from frigate.util.discovery import scan_network

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/network/discover", tags=["Discovery"])

@router.get("/scan", response_model=List[Dict[str, Any]])
async def api_scan_network(
    subnet_prefix: str = Query("172.16.0", description="IP subnet prefix (e.g. 172.16.0)"),
    username: str = Query("", description="Optional custom ONVIF username"),
    password: str = Query("", description="Optional custom ONVIF password"),
    channel: Optional[int] = Query(None, description="Optional channel index for NVR testing")
):
    """Scan the specified local subnet prefix for ONVIF and RTSP CCTV cameras or NVRs."""
    try:
        devices = await scan_network(subnet_prefix, username, password, channel)
        return devices
    except Exception as e:
        logger.exception("Failed to scan network subnet: %s", subnet_prefix)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to scan network subnet: {e}"
        )
