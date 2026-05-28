"""Utility functions for network scanning and CCTV/ONVIF discovery."""

import asyncio
import logging
import socket
import urllib.request
import hashlib
import base64
import os
import time
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

PORTS_TO_SCAN = [80, 554, 8000, 8899, 37777]

DEFAULT_CREDENTIALS = [
    ("admin", "password1"),
    ("admin", "P@ssword1"),
    ("admin", "passw0rd1"),
    ("admin", "admin"),
    ("admin", ""),
]

# Locate ffprobe binary in container vs host
FFPROBE_PATH = "/usr/lib/ffmpeg/7.0/bin/ffprobe"
if not os.path.exists(FFPROBE_PATH):
    FFPROBE_PATH = "ffprobe"

SOAP_BODY_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  {auth_header}
  <soap:Body>
    {body_content}
  </soap:Body>
</soap:Envelope>"""

def get_auth_header(username: str, password: str) -> str:
    """Generate WS-Security Digest Authentication header for ONVIF."""
    if not username:
        return ""
    
    nonce = os.urandom(16)
    nonce_b64 = base64.b64encode(nonce).decode("utf-8")
    created = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    hasher = hashlib.sha1()
    hasher.update(nonce + created.encode("utf-8") + password.encode("utf-8"))
    digest = base64.b64encode(hasher.digest()).decode("utf-8")
    
    return f"""
  <soap:Header>
    <Security soap:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <UsernameToken>
        <Username>{username}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</Nonce>
        <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">{created}</Created>
      </UsernameToken>
    </Security>
  </soap:Header>
"""

async def check_ip_ports(ip: str, sem: asyncio.Semaphore) -> Tuple[str, List[int]]:
    """Asynchronously scan defined ports on an IP address."""
    async with sem:
        open_ports = []
        for port in PORTS_TO_SCAN:
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip, port),
                    timeout=0.6
                )
                open_ports.append(port)
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
        return ip, open_ports

def send_soap_request(ip: str, port: int, body_content: str, username: str = "", password: str = "") -> str:
    """Send SOAP XML request to a device ONVIF service endpoint."""
    auth_header = get_auth_header(username, password) if username else ""
    payload = SOAP_BODY_TEMPLATE.format(auth_header=auth_header, body_content=body_content)
    
    url = f"http://{ip}:{port}/onvif/device_service"
    req = urllib.request.Request(
        url,
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/soap+xml; charset=utf-8"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=1.5) as response:
            return response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return str(e)

def probe_onvif_details(ip: str, port: int, username: str = "", password: str = "") -> Dict[str, Any]:
    """Query ONVIF endpoints to extract device capabilities, details, and MAC address."""
    # 1. Device Info
    res_info = send_soap_request(ip, port, "<tds:GetDeviceInformation/>", username, password)
    if "HTTP Error 401" in res_info or "Unauthorized" in res_info:
        raise PermissionError("Unauthorized")
        
    if "GetDeviceInformationResponse" not in res_info:
        raise ConnectionError("Not a valid ONVIF device")
        
    manufacturer = "Generic"
    model = "IP Camera"
    
    try:
        if "GetDeviceInformationResponse" in res_info:
            root = ET.fromstring(res_info)
            ns = {"tds": "http://www.onvif.org/ver10/device/wsdl"}
            man_elem = root.find(".//tds:Manufacturer", ns)
            if man_elem is not None:
                manufacturer = man_elem.text or "Generic"
            mod_elem = root.find(".//tds:Model", ns)
            if mod_elem is not None:
                model = mod_elem.text or "IP Camera"
    except Exception as e:
        logger.debug("Failed to parse ONVIF Device Information XML: %s", e)
        
    # 2. Network Interfaces (for MAC address)
    res_net = send_soap_request(ip, port, "<tds:GetNetworkInterfaces/>", username, password)
    mac_address = ""
    try:
        if "<tt:HwAddress>" in res_net:
            mac_address = res_net.split("<tt:HwAddress>")[1].split("</tt:HwAddress>")[0].strip().lower()
    except Exception as e:
        logger.debug("Failed to parse ONVIF Network Interfaces XML: %s", e)

    # 3. Capabilities
    res_cap = send_soap_request(ip, port, "<tds:GetCapabilities/>", username, password)
    has_ptz = "<tt:PTZ>" in res_cap or "/PTZ" in res_cap
    has_audio = False
    is_nvr = False
    
    try:
        if "GetCapabilitiesResponse" in res_cap:
            if "<tt:VideoSources>" in res_cap:
                sources_str = res_cap.split("<tt:VideoSources>")[1].split("</tt:VideoSources>")[0]
                if int(sources_str) > 1:
                    is_nvr = True
            if "<tt:AudioSources>" in res_cap:
                audio_str = res_cap.split("<tt:AudioSources>")[1].split("</tt:AudioSources>")[0]
                if int(audio_str) > 0:
                    has_audio = True
    except Exception as e:
        logger.debug("Failed to parse ONVIF Capabilities XML: %s", e)
        
    model_upper = model.upper()
    if "NVR" in model_upper or "XVR" in model_upper or "HCVR" in model_upper:
        is_nvr = True
        
    return {
        "manufacturer": manufacturer,
        "model": model,
        "mac": mac_address,
        "is_nvr": is_nvr,
        "ptz": has_ptz,
        "audio": has_audio,
        "username": username,
        "password": password
    }

async def validate_rtsp_stream(rtsp_url: str) -> Tuple[bool, str, int, int, int]:
    """Execute ffprobe asynchronously to perform a frame-level playability check."""
    cmd = [
        FFPROBE_PATH, "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=0",
        rtsp_url
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3.5)
        if proc.returncode == 0:
            out = stdout.decode().strip()
            info = {}
            for line in out.split("\n"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    info[k.strip()] = v.strip()
            
            codec = info.get("codec_name", "h264")
            width = int(info.get("width", 1280))
            height = int(info.get("height", 720))
            fps_str = info.get("r_frame_rate", "25/1")
            fps = 25
            if "/" in fps_str:
                num, den = fps_str.split("/", 1)
                if int(den) > 0:
                    fps = int(round(float(num) / float(den)))
            return True, codec, width, height, fps
    except Exception as e:
        logger.debug("ffprobe validation failed: %s", e)
    return False, "h264", 1280, 720, 25

async def probe_device(ip: str, open_ports: List[int], custom_user: str = "", custom_pwd: str = "") -> Tuple[bool, Dict[str, Any]]:
    """Probe a discovered IP, return (is_camera, device_info)."""
    onvif_ports = [p for p in open_ports if p in [80, 8000, 8899]]
    
    # Setup credentials list
    creds = []
    if custom_user:
        creds.append((custom_user, custom_pwd))
    creds.extend(DEFAULT_CREDENTIALS)
    
    # Try ONVIF endpoints
    if onvif_ports:
        port = onvif_ports[0]
        unauthorized = False
        
        for user, pwd in creds:
            try:
                details = await asyncio.to_thread(probe_onvif_details, ip, port, user, pwd)
                
                # Active stream validation
                rtsp_url = f"rtsp://{user}:{pwd}@{ip}:554/cam/realmonitor?channel=1&subtype=0" if "dahua" in details["manufacturer"].lower() else f"rtsp://{user}:{pwd}@{ip}:554/h264/ch1/main/av_stream"
                playable, codec, w, h, fps = await validate_rtsp_stream(rtsp_url)
                
                return True, {
                    "ip": ip,
                    "mac": details["mac"],
                    "status": "Online" if playable else "Invalid Stream",
                    "manufacturer": details["manufacturer"],
                    "model": details["model"],
                    "device_type": "nvr" if details["is_nvr"] else "cctv",
                    "ptz": details["ptz"],
                    "audio": details["audio"],
                    "port": port,
                    "onvif_url": f"http://{ip}:{port}/onvif/device_service",
                    "rtsp_url": rtsp_url,
                    "username": user,
                    "password": pwd,
                    "resolution": f"{w}x{h}",
                    "fps": fps,
                    "codec": codec
                }
            except PermissionError:
                unauthorized = True
            except Exception as e:
                logger.debug("Failed ONVIF probe on %s:%d: %s", ip, port, e)
                
        if unauthorized:
            # We identified it's an ONVIF device but couldn't unlock it
            return True, {
                "ip": ip,
                "mac": "",
                "status": "Access Denied",
                "manufacturer": "Unknown (Credentials Required)",
                "model": "Locked Device",
                "device_type": "cctv",
                "ptz": False,
                "audio": False,
                "port": port,
                "onvif_url": f"http://{ip}:{port}/onvif/device_service",
                "rtsp_url": f"rtsp://admin:admin@{ip}:554/h264/ch1/main/av_stream"
            }
            
    # Non-ONVIF endpoints (Fallback to media-specific port check)
    if 37777 in open_ports or 554 in open_ports:
        is_dahua = 37777 in open_ports
        rtsp_url = f"rtsp://admin:password1@{ip}:554/cam/realmonitor?channel=1&subtype=0" if is_dahua else f"rtsp://admin:admin@{ip}:554/h264/ch1/main/av_stream"
        
        # Verify the RTSP stream is active and readable
        playable, codec, w, h, fps = await validate_rtsp_stream(rtsp_url)
        if playable:
            return True, {
                "ip": ip,
                "mac": "",
                "status": "Online",
                "manufacturer": "Dahua (Private SDK)" if is_dahua else "Generic RTSP",
                "model": "Dahua Device" if is_dahua else "Generic Streamer",
                "device_type": "nvr" if is_dahua and 80 in open_ports else "cctv",
                "ptz": False,
                "audio": False,
                "port": 37777 if is_dahua else 554,
                "rtsp_url": rtsp_url,
                "resolution": f"{w}x{h}",
                "fps": fps,
                "codec": codec
            }

    # Reject/Discard if it does not match ONVIF, RTSP (554), or Dahua SDK (37777)
    # This prevents non-CCTV webservers/printers on Port 80/8080 from appearing.
    return False, {}

async def scan_network(subnet_prefix: str, custom_user: str = "", custom_pwd: str = "") -> List[Dict[str, Any]]:
    """Scan subnet and probe all active IPs concurrently or test a single IP."""
    if subnet_prefix.count(".") == 3:
        logger.info("Probing single IP: %s", subnet_prefix)
        sem = asyncio.Semaphore(1)
        _, open_ports = await check_ip_ports(subnet_prefix, sem)
        if not open_ports:
            return []
        is_cam, dev = await probe_device(subnet_prefix, open_ports, custom_user, custom_pwd)
        return [dev] if is_cam else []

    logger.info("Scanning local subnet: %s.0/24", subnet_prefix)
    sem = asyncio.Semaphore(60)
    
    # 1. Parallel port sweep
    tasks = []
    for i in range(1, 255):
        ip = f"{subnet_prefix}.{i}"
        tasks.append(check_ip_ports(ip, sem))
        
    sweep_results = await asyncio.gather(*tasks)
    active_ips = [(ip, ports) for ip, ports in sweep_results if ports]
    
    # 2. Detailed ONVIF capability probing & RTSP stream validation
    probe_tasks = []
    for ip, ports in active_ips:
        probe_tasks.append(probe_device(ip, ports, custom_user, custom_pwd))
        
    probe_results = await asyncio.gather(*probe_tasks)
    
    # Filter out discarded (non-CCTV) devices
    devices = [dev for is_cam, dev in probe_results if is_cam]
    return devices
