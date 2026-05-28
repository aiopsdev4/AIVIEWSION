import urllib.request
from test_onvif_auth import query_onvif

if __name__ == "__main__":
    ip = "172.16.0.122"
    username = "admin"
    password = "password1"
    
    res_cap = query_onvif(ip, 80, "<tds:GetCapabilities/>", username, password)
    
    print("PTZ service URL in XML?", "/ptz" in res_cap)
    print("Audio sources in XML?", "Audio" in res_cap or "audio" in res_cap)
    
    # Write full capabilities xml to a file to examine
    with open("scratch/capabilities_response.xml", "w") as f:
        f.write(res_cap)
        
    print("Capabilities xml written to scratch/capabilities_response.xml")
