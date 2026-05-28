import urllib.request
import hashlib
import base64
import os
import time

SOAP_BODY_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  {auth_header}
  <soap:Body>
    {body_content}
  </soap:Body>
</soap:Envelope>"""

def get_auth_header(username, password):
    nonce = os.urandom(16)
    nonce_b64 = base64.b64encode(nonce).decode('utf-8')
    created = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    
    hasher = hashlib.sha1()
    hasher.update(nonce + created.encode('utf-8') + password.encode('utf-8'))
    digest = base64.b64encode(hasher.digest()).decode('utf-8')
    
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

def query_onvif(ip, port, body_content, username, password):
    auth_header = get_auth_header(username, password)
    payload = SOAP_BODY_TEMPLATE.format(auth_header=auth_header, body_content=body_content)
    
    url = f"http://{ip}:{port}/onvif/device_service"
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
    username = "admin"
    password = "password1"
    
    print("Querying GetDeviceInformation...")
    res = query_onvif(ip, 80, "<tds:GetDeviceInformation/>", username, password)
    print(res)
    
    print("\nQuerying GetCapabilities...")
    res_cap = query_onvif(ip, 80, "<tds:GetCapabilities/>", username, password)
    print(res_cap[:1000])
