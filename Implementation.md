Viewed AssetTable.tsx:70-101
Viewed docker-compose.yml:1-55
Viewed config.yml:1-53
Listed directory main
Listed directory tensorrt

To fully utilize your RTX 5060 Ti GPU and make the system run perfectly smooth with all features enabled, we need to offload the two heaviest tasks to it: **Video Decoding** and **AI Object Detection**.

Currently, we are only using your GPU for *transcoding* H.265 to H.264 (via `go2rtc`), but the heavy AI object detection is disabled because it was previously crashing the CPU.

Here is exactly what needs to be configured to fully unlock the GPU:

### 1. Enable TensorRT for AI Object Detection
This is the most important step. Object detection is computationally expensive. Right now, your system tries to use `onnx` on the CPU, which causes massive lag. We need to switch this to **TensorRT**, NVIDIA's high-performance AI inference engine.

To do this, we need to change your `docker-compose.yml` to build the specific NVIDIA TensorRT Docker image instead of the standard CPU one:
```yaml
# In docker-compose.yml
build:
  context: .
  dockerfile: docker/tensorrt/Dockerfile.amd64 # Switched from docker/main/Dockerfile
```

Then, we update your `local_data/config.yml` to point to the TensorRT detector:
```yaml
detectors:
  tensorrt:
    type: tensorrt
    device: 0

model:
  path: /config/yolov8n.onnx # Frigate will automatically compile this into a blazing fast .trt file on first boot!
  width: 640
  height: 640
  input_tensor: nchw
  input_pixel_format: rgb
  input_dtype: float
```

### 2. Enable Hardware-Accelerated Video Decoding
Right now, FFmpeg is using your CPU to decode the raw video feeds. We can offload this to the GPU to free up CPU cycles. We previously disabled this to stabilize your system, but once we are on the TensorRT image with the proper NVIDIA drivers, we can safely re-enable it in `local_data/config.yml`:

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
```

### Want me to apply this?
I can make these configuration changes for you. However, please be aware that building the TensorRT Docker image will take several minutes as it needs to download gigabytes of NVIDIA CUDA and TensorRT libraries. 

Would you like me to go ahead and configure the GPU for AI and Hardware Decoding, and trigger the rebuild?