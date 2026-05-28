import socket
import uuid
import select
import time

PROBE_MSG = """<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <Header>
    <MessageID xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">uuid:{uuid_str}</MessageID>
    <To xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2004:08:discovery</To>
    <Action xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2004/08/discovery/Probe</Action>
  </Header>
  <Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2004/08/discovery">
      <Types>dn:NetworkVideoTransmitter</Types>
    </Probe>
  </Body>
</Envelope>"""

def discover_cameras():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    
    # Bind to any port, send to multicast
    msg = PROBE_MSG.format(uuid_str=str(uuid.uuid4())).encode('utf-8')
    multicast_group = ('239.255.255.250', 3702)
    
    print("Sending WS-Discovery Probe...")
    sock.sendto(msg, multicast_group)
    
    sock.setblocking(0)
    start = time.time()
    devices = []
    
    while time.time() - start < 3.0:
        ready = select.select([sock], [], [], 0.5)
        if ready[0]:
            data, addr = sock.recvfrom(65535)
            print(f"Received response from {addr}:")
            # Just print the first 200 chars or find ONVIF XAddrs
            xml_str = data.decode('utf-8', errors='ignore')
            print(xml_str[:500])
            devices.append((addr[0], xml_str))
            
    return devices

if __name__ == "__main__":
    discover_cameras()
