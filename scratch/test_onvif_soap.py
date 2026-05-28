import urllib.request
import xml.etree.ElementTree as ET

SOAP_GET_DEVICE_INFO = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <soap:Body>
    <tds:GetDeviceInformation/>
  </soap:Body>
</soap:Envelope>"""

SOAP_GET_SERVICES = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <soap:Body>
    <tds:GetServices>
      <tds:IncludeCapability>false</tds:IncludeCapability>
    </tds:GetServices>
  </soap:Body>
</soap:Envelope>"""

def send_soap_request(ip, port, path, payload):
    url = f"http://{ip}:{port}{path}"
    req = urllib.request.Request(
        url,
        data=payload.encode('utf-8'),
        headers={'Content-Type': 'application/soap+xml; charset=utf-8'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    ip = "172.16.0.122"
    # Try different ports: 80, 8899, 8000
    for port in [80, 8899, 8000]:
        print(f"Trying http://{ip}:{port}/onvif/device_service ...")
        res = send_soap_request(ip, port, "/onvif/device_service", SOAP_GET_DEVICE_INFO)
        if "GetDeviceInformationResponse" in res:
            print("SUCCESS! Response:")
            print(res)
            
            print("\nQuerying GetServices...")
            res_services = send_soap_request(ip, port, "/onvif/device_service", SOAP_GET_SERVICES)
            print(res_services[:1000])
            break
        else:
            print("Failed or error:", res)
