"""Utility functions for network scanning and CCTV/ONVIF discovery."""

import asyncio
import logging
import socket
import urllib.request
import ssl
import hashlib
import base64
import os
import time
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

PORTS_TO_SCAN = [80, 554, 8554, 8000, 8899, 37777]

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
    """Asynchronously scan defined ports on an IP address in parallel."""
    async with sem:
        open_ports = []
        
        async def check_single_port(port: int):
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip, port),
                    timeout=2.0
                )
                open_ports.append(port)
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

        await asyncio.gather(*(check_single_port(p) for p in PORTS_TO_SCAN))
        return ip, sorted(open_ports)

def get_mac_from_arp(ip: str) -> str:
    """Read the system ARP table to resolve the MAC address of a local IP."""
    try:
        if os.path.exists("/proc/net/arp"):
            with open("/proc/net/arp", "r") as f:
                # Skip header
                next(f)
                for line in f:
                    parts = line.split()
                    if len(parts) >= 4 and parts[0] == ip:
                        mac = parts[3].strip().lower()
                        # Verify it's a valid MAC format (not 00:00:00:00:00:00)
                        if mac and mac != "00:00:00:00:00:00" and len(mac) == 17:
                            return mac
    except Exception as e:
        logger.debug("Failed to read MAC from ARP for %s: %s", ip, e)
    return ""

def probe_nvr_channels_onvif(ip: str, port: int, username: str, password: str) -> int:
    """Query the ONVIF Media Service GetVideoSources to dynamically determine the NVR channel count."""
    res_cap = send_soap_request(ip, port, "<tds:GetCapabilities/>", username, password)
    media_url = f"http://{ip}:{port}/onvif/media_service"
    if "<tt:Media>" in res_cap:
        try:
            media_url = res_cap.split("<tt:Media>")[1].split("<tt:XAddr>")[1].split("</tt:XAddr>")[0].strip()
        except Exception:
            pass
            
    body_content = "<trt:GetVideoSources xmlns:trt=\"http://www.onvif.org/ver10/media/wsdl\"/>"
    auth_header = get_auth_header(username, password) if username else ""
    payload = SOAP_BODY_TEMPLATE.format(auth_header=auth_header, body_content=body_content)
    
    req = urllib.request.Request(
        media_url,
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/soap+xml; charset=utf-8"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=2.0) as response:
            res = response.read().decode("utf-8", errors="ignore")
            count = res.count("<trt:VideoSources>") or res.count("<trt:VideoSource>") or res.count("<tt:VideoSource>")
            if count > 0:
                return count
    except Exception as e:
        logger.debug("Failed to query GetVideoSources on NVR %s: %s", ip, e)
    return 0

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
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=1.5, context=context) as response:
            return response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return str(e)

def probe_onvif_details(ip: str, port: int, username: str = "", password: str = "") -> Dict[str, Any]:
    """Query ONVIF endpoints to extract device capabilities, details, and MAC address."""
    # 1. Device Info
    res_info = send_soap_request(ip, port, "<tds:GetDeviceInformation/>", username, password)
    if any(err in res_info for err in ["HTTP Error 401", "Unauthorized", "HTTP Error 400", "HTTP Error 403", "sender", "Sender"]):
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
        
    if not mac_address or mac_address == "00:00:00:00:00:00":
        mac_address = get_mac_from_arp(ip)
 
    # 3. Capabilities
    res_cap = send_soap_request(ip, port, "<tds:GetCapabilities/>", username, password)
    has_ptz = False
    if "<tt:PTZ>" in res_cap:
        try:
            ptz_section = res_cap.split("<tt:PTZ>")[1].split("</tt:PTZ>")[0]
            if "<tt:XAddr>" in ptz_section:
                has_ptz = True
        except Exception:
            has_ptz = True
    elif "/PTZ" in res_cap:
        has_ptz = True

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
            elif "<tt:AudioOutputs>" in res_cap:
                audio_str = res_cap.split("<tt:AudioOutputs>")[1].split("</tt:AudioOutputs>")[0]
                if int(audio_str) > 0:
                    has_audio = True
    except Exception as e:
        logger.debug("Failed to parse ONVIF Capabilities XML: %s", e)
        
    model_upper = model.upper()
    man_upper = manufacturer.upper()
    if "NVR" in model_upper or "XVR" in model_upper or "HCVR" in model_upper:
        is_nvr = True
        
    is_bwc = "BWC" in model_upper or "BWC" in man_upper or "BODY" in model_upper or "BODYWORN" in model_upper
        
    return {
        "manufacturer": manufacturer,
        "model": model,
        "mac": mac_address,
        "is_nvr": is_nvr,
        "is_bwc": is_bwc,
        "ptz": has_ptz,
        "audio": has_audio,
        "username": username,
        "password": password
    }

async def validate_rtsp_stream(rtsp_url: str) -> Tuple[bool, str, int, int, int]:
    """Execute ffprobe asynchronously to perform a frame-level playability check."""
    cmd = [
        FFPROBE_PATH, "-v", "error",
        "-rtsp_transport", "tcp",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=0",
        rtsp_url
    ]
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=4.0)
        except asyncio.TimeoutError:
            if proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
            raise

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
        if proc and proc.returncode is None:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
    return False, "h264", 1280, 720, 25


async def probe_device(ip: str, open_ports: List[int], custom_user: str = "", custom_pwd: str = "") -> Tuple[bool, Dict[str, Any]]:
    """Probe a discovered IP, return (is_camera, device_info)."""
    onvif_ports = [p for p in open_ports if p in [80, 8000, 8899]]
    rtsp_port = 8554 if 8554 in open_ports else 554
    
    # Setup credentials list
    creds = []
    if custom_user:
        creds.append((custom_user, custom_pwd))
    else:
        creds.append(("", ""))
    
    # Try ONVIF endpoints
    if onvif_ports:
        port = onvif_ports[0]
        unauthorized = False
        
        for user, pwd in creds:
            try:
                details = await asyncio.to_thread(probe_onvif_details, ip, port, user, pwd)
                
                # Active stream validation
                rtsp_url = f"rtsp://{user}:{pwd}@{ip}:{rtsp_port}/cam/realmonitor?channel=1&subtype=0" if "dahua" in details["manufacturer"].lower() else f"rtsp://{user}:{pwd}@{ip}:{rtsp_port}/h264/ch1/main/av_stream"
                playable, codec, w, h, fps = await validate_rtsp_stream(rtsp_url)
                
                device_type = "cctv"
                if details["is_nvr"]:
                    device_type = "nvr"
                elif details.get("is_bwc"):
                    device_type = "bwc"

                return True, {
                    "ip": ip,
                    "mac": details["mac"],
                    "status": "Online",
                    "manufacturer": details["manufacturer"],
                    "model": details["model"],
                    "device_type": device_type,
                    "ptz": details["ptz"],
                    "audio": details["audio"],
                    "port": port,
                    "onvif_url": f"http://{ip}:{port}/onvif/device_service",
                    "rtsp_url": rtsp_url,
                    "username": user,
                    "password": pwd,
                    "resolution": f"{w}x{h}",
                    "fps": fps,
                    "codec": codec,
                    "playable": playable
                }
            except PermissionError:
                unauthorized = True
            except Exception as e:
                logger.debug("Failed ONVIF probe on %s:%d: %s", ip, port, e)
                
        if unauthorized:
            # We identified it's an ONVIF device but couldn't unlock it
            return True, {
                "ip": ip,
                "mac": get_mac_from_arp(ip),
                "status": "Online",
                "manufacturer": "Unknown (Credentials Required)",
                "model": "Locked Device",
                "device_type": "cctv",
                "ptz": False,
                "audio": False,
                "port": port,
                "onvif_url": f"http://{ip}:{port}/onvif/device_service",
                "rtsp_url": f"rtsp://{custom_user}:{custom_pwd}@{ip}:{rtsp_port}/h264/ch1/main/av_stream",
                "username": custom_user,
                "password": custom_pwd,
                "playable": False
            }
            
    # Non-ONVIF endpoints (Fallback to media-specific port check)
    if 37777 in open_ports or 554 in open_ports or 8554 in open_ports:
        is_dahua = 37777 in open_ports
        rtsp_url = f"rtsp://{custom_user}:{custom_pwd}@{ip}:{rtsp_port}/cam/realmonitor?channel=1&subtype=0" if is_dahua else f"rtsp://{custom_user}:{custom_pwd}@{ip}:{rtsp_port}/h264/ch1/main/av_stream"
        
        # Verify the RTSP stream is active and readable
        playable, codec, w, h, fps = await validate_rtsp_stream(rtsp_url)
        if playable or is_dahua:
            manufacturer = "Dahua (Private SDK)" if is_dahua else "Generic RTSP"
            model = "Dahua Device" if is_dahua else "Generic Streamer"
            if not playable and is_dahua:
                manufacturer = "Dahua (Credentials Required)"
                model = "Locked NVR" if 80 in open_ports else "Locked Dahua Device"
            
            return True, {
                "ip": ip,
                "mac": get_mac_from_arp(ip),
                "status": "Online",
                "manufacturer": manufacturer,
                "model": model,
                "device_type": "nvr" if is_dahua and 80 in open_ports else "cctv",
                "ptz": False,
                "audio": False,
                "port": 37777 if is_dahua else rtsp_port,
                "rtsp_url": rtsp_url,
                "username": custom_user,
                "password": custom_pwd,
                "resolution": f"{w}x{h}" if playable else "1280x720",
                "fps": fps if playable else 25,
                "codec": codec if playable else "h264",
                "playable": playable
            }

    # Reject/Discard if it does not match ONVIF, RTSP (554), or Dahua SDK (37777)
    # This prevents non-CCTV webservers/printers on Port 80/8080 from appearing.
    return False, {}

async def expand_nvr_device(dev: Dict[str, Any], channel: int = None) -> List[Dict[str, Any]]:
    """Probe an NVR to find all connected active channels and return them as separate devices."""
    if dev.get("device_type") != "nvr":
        return [dev]
        
    ip = dev["ip"]
    manufacturer = dev.get("manufacturer", "Generic")
    username = dev.get("username") or ""
    password = dev.get("password") or ""
    port = dev.get("port", 554)
    mac = dev.get("mac", "")
    
    rtsp_port = 554
    orig_rtsp = dev.get("rtsp_url")
    if orig_rtsp and ":" in orig_rtsp.split("@")[-1]:
        try:
            rtsp_port = int(orig_rtsp.split("@")[-1].split("/")[0].split(":")[1])
        except Exception:
            pass
            
    brand_lower = manufacturer.lower()
    is_dahua = "dahua" in brand_lower
    is_hik = "hikvision" in brand_lower
    
    active_channels = []
    
    # Query exact number of channels dynamically
    num_channels = 16
    if username and password:
        onvif_count = probe_nvr_channels_onvif(ip, port, username, password)
        if onvif_count > 0:
            num_channels = onvif_count
            
    # If a specific channel is requested, only probe that one
    ch_range = [channel] if channel is not None else list(range(1, num_channels + 1))
    
    sem = asyncio.Semaphore(8)
    
    async def probe_ch(ch_idx: int) -> Dict[str, Any] | None:
        async with sem:
            # Dahua URL
            dahua_url = f"rtsp://{username}:{password}@{ip}:{rtsp_port}/cam/realmonitor?channel={ch_idx}&subtype=0"
            # Hikvision URL
            hik_url = f"rtsp://{username}:{password}@{ip}:{rtsp_port}/Streaming/Channels/{ch_idx}01"
            
            urls = []
            if is_dahua:
                urls = [dahua_url, hik_url]
            elif is_hik:
                urls = [hik_url, dahua_url]
            else:
                urls = [dahua_url, hik_url]
                
            for url in urls:
                try:
                    playable, codec, w, h, fps = await validate_rtsp_stream(url)
                    if playable:
                        return {
                            "ip": ip,
                            "mac": mac,
                            "status": "Online",
                            "manufacturer": manufacturer,
                            "model": f"{dev.get('model', 'NVR')} (Channel {ch_idx})",
                            "device_type": "cctv",
                            "ptz": dev.get("ptz", False),
                            "audio": dev.get("audio", False),
                            "port": port,
                            "rtsp_url": url,
                            "username": username,
                            "password": password,
                            "resolution": f"{w}x{h}",
                            "fps": fps,
                            "codec": codec,
                            "channel_index": ch_idx,
                            "playable": True
                        }
                except Exception:
                    pass
            return None

    tasks = [probe_ch(ch) for ch in ch_range]
    results = await asyncio.gather(*tasks)
    
    expanded = [r for r in results if r is not None]
    
    if not expanded:
        # Fallback: if no active channels are found, return the NVR device itself
        if channel is not None:
            # If specifically testing a channel that failed, return it as offline
            url = f"rtsp://{username}:{password}@{ip}:{rtsp_port}/cam/realmonitor?channel={channel}&subtype=0" if is_dahua else f"rtsp://{username}:{password}@{ip}:{rtsp_port}/Streaming/Channels/{channel}01"
            return [{
                "ip": ip,
                "mac": mac,
                "status": "Offline",
                "manufacturer": manufacturer,
                "model": f"{dev.get('model', 'NVR')} (Channel {channel})",
                "device_type": "cctv",
                "ptz": False,
                "audio": False,
                "port": port,
                "rtsp_url": url,
                "username": username,
                "password": password,
                "channel_index": channel,
                "playable": False
            }]
        return [dev]
        
    return expanded

async def scan_network(subnet_prefix: str, custom_user: str = "", custom_pwd: str = "", channel: int = None) -> List[Dict[str, Any]]:
    """Scan subnet and probe all active IPs concurrently or test a single IP."""
    if subnet_prefix.count(".") == 3:
        logger.info("Probing single IP: %s", subnet_prefix)
        sem = asyncio.Semaphore(1)
        _, open_ports = await check_ip_ports(subnet_prefix, sem)
        if not open_ports:
            return []
        is_cam, dev = await probe_device(subnet_prefix, open_ports, custom_user, custom_pwd)
        if not is_cam:
            return []
        return await expand_nvr_device(dev, channel)

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
    
    # 3. Expand NVRs into separate channels
    # During a full subnet scan, we DO NOT expand NVRs synchronously.
    # We return the root NVR devices as-is, and the frontend will retrieve their channels in the background.
    return devices
