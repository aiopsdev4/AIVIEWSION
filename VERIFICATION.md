Perform a deep technical audit of our CCTV discovery, registration, and device classification implementation.

The current system incorrectly detects and registers CCTV devices that are not actually connected to the network. Some cameras are detected accurately, but there are false positives, ghost devices, duplicate entries, and potentially incorrect device metadata.

Your task is to validate whether the implementation is enterprise-grade and behaves similarly to Dahua DSS or other professional VMS systems.

Audit Requirements:

1. Camera Discovery Validation

* Verify whether the discovery implementation is correctly using:

  * ONVIF WS-Discovery
  * RTSP probing
  * multicast/broadcast scanning
  * subnet scanning
  * ARP/network discovery
* Check if stale responses, cached devices, or old IP mappings are causing ghost cameras to appear.
* Validate whether the discovery process confirms active device existence before registration.
* Ensure devices are not added solely because:

  * an IP responded once
  * an RTSP URL format exists
  * a cached ONVIF response exists
  * SSDP/multicast packets were previously received

2. False Positive Detection Audit

* Investigate why non-existent CCTV devices are being registered.
* Detect:

  * stale registry entries
  * duplicate camera IDs
  * duplicate MAC addresses
  * recycled IP addresses
  * phantom ONVIF devices
  * fake RTSP-positive detections
  * cached discovery results
  * invalid heartbeat assumptions
* Ensure devices are removed if:

  * heartbeat fails repeatedly
  * RTSP stream cannot actually deliver frames
  * ONVIF authentication fails
  * no valid media profile exists

3. Active Verification Requirements
   Before a device is officially registered:

* Verify ONVIF authentication succeeds
* Verify media profiles exist
* Verify RTSP stream is playable
* Verify frames are actually received
* Verify the device responds consistently
* Verify device metadata matches real capabilities

The system must NOT trust:

* ping success alone
* open TCP ports alone
* stale cached metadata
* incomplete ONVIF responses

4. Device Classification Accuracy
   Audit whether the implementation correctly identifies:

* IP Camera
* NVR
* DVR
* Encoder
* Unknown device

Validate whether the following metadata is accurate:

* PTZ support
* audio support
* microphone support
* speaker support
* video codec
* resolution
* FPS
* manufacturer
* serial number
* firmware version
* model
* stream profiles
* AI capability
* motion detection capability

Check whether the system incorrectly assumes:

* every ONVIF device supports PTZ
* every RTSP stream is a camera
* audio exists when no audio channel exists
* an NVR is a direct camera
* all channels are valid streams

5. PTZ Validation
   Ensure PTZ capability is verified using actual ONVIF PTZ services.
   The implementation must:

* confirm PTZ node existence
* verify PTZ configuration
* verify PTZ commands succeed
* distinguish fixed cameras from PTZ cameras

The system must not mark PTZ=true solely from:

* manufacturer assumptions
* ONVIF profile presence
* guessed metadata

6. Audio Capability Validation
   Ensure audio support is verified through:

* ONVIF audio encoder configs
* SDP/RTSP stream inspection
* actual audio channel existence

Detect false audio assumptions.

7. NVR vs Camera Detection
   Validate that:

* NVRs are detected separately from cameras
* channels inside NVRs are mapped correctly
* the system distinguishes:

  * physical cameras
  * virtual channels
  * rebroadcasted streams
  * duplicated RTSP feeds

Prevent:

* duplicate channel registration
* NVR channels appearing as independent cameras
* recursive stream registration

8. Stream Validation
   Audit whether:

* RTSP streams actually deliver frames
* streams freeze silently
* stream latency is tracked
* FPS is measured correctly
* reconnect logic works
* zombie streams exist
* stale stream sessions persist

Validate frame-based health checking instead of socket-only checking.

9. Health Monitoring Audit
   Ensure the implementation:

* continuously validates live frame arrival
* updates heartbeat timestamps correctly
* removes dead devices
* marks unstable streams properly
* calculates health scores accurately

10. Database and Registry Audit
    Inspect:

* stale camera cleanup
* duplicate entries
* registry synchronization
* orphaned streams
* outdated metadata
* race conditions during registration

11. Network Layer Audit
    Check for:

* subnet overlap issues
* multicast flooding
* ONVIF timeout issues
* incorrect IP reuse handling
* ARP cache problems
* NAT-related misdetections

12. Required Output
    Generate:

* complete audit findings
* logical flaws
* inaccurate assumptions
* false positive causes
* metadata reliability analysis
* PTZ verification analysis
* audio verification analysis
* NVR classification analysis
* stream validation analysis
* recommended fixes
* enterprise-grade redesign suggestions
* production-grade validation flow
* improved discovery architecture

The final audit must identify why non-existent CCTV devices are appearing and whether the system can reliably distinguish:

* real cameras
* offline devices
* NVRs
* PTZ cameras
* audio-capable devices
* ghost/stale devices
* rebroadcasted streams
* invalid RTSP endpoints

The analysis must be brutally strict and assume the current implementation is unreliable until every capability is actively verified through live validation.