import urllib.request
from test_onvif_auth import query_onvif

if __name__ == "__main__":
    ip = "172.16.0.122"
    username = "admin"
    password = "password1"
    
    res = query_onvif(ip, 80, "<tds:GetNetworkInterfaces/>", username, password)
    print("GetNetworkInterfaces Response:")
    print(res)
    
    # Check if HwAddress exists in the response
    if "<tt:HwAddress>" in res:
        mac = res.split("<tt:HwAddress>")[1].split("</tt:HwAddress>")[0]
        print(f"Parsed MAC address: {mac}")
    else:
        print("HwAddress not found in response.")
