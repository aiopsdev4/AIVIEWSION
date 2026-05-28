import asyncio
import time

PORTS_TO_SCAN = [80, 554, 8000, 8899, 37777]

async def check_ip_ports(ip, sem):
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

async def scan_subnet(subnet_prefix):
    sem = asyncio.Semaphore(100)
    tasks = []
    for i in range(1, 255):
        ip = f"{subnet_prefix}.{i}"
        tasks.append(check_ip_ports(ip, sem))
        
    start_time = time.time()
    results = await asyncio.gather(*tasks)
    end_time = time.time()
    
    active_devices = {ip: ports for ip, ports in results if ports}
    print(f"Scanned subnet in {end_time - start_time:.2f} seconds.")
    print("Active devices found:")
    for ip, ports in active_devices.items():
        print(f"  {ip}: {ports}")
    return active_devices

if __name__ == "__main__":
    asyncio.run(scan_subnet("172.16.0"))
