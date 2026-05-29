import axios from "axios";

/**
 * Saves the provided YAML configuration payload to the backend and triggers a system restart.
 * @param yamlPayload The full raw YAML string configuration.
 */
export const saveAndRestartConfig = async (
  yamlPayload: string,
): Promise<void> => {
  await axios.post(`config/save?save_option=restart`, yamlPayload, {
    headers: { "Content-Type": "text/plain" },
  });
};

/**
 * Saves a new camera asset to the configuration backend.
 * @param name The descriptive name of the camera.
 * @param rtspUrl The RTSP streaming URL.
 */
export const registerCamera = async (
  name: string,
  rtspUrl: string,
): Promise<any> => {
  const response = await axios.post("cameras", {
    name,
    rtsp_url: rtspUrl,
  });
  return response.data;
};

/**
 * Deletes a camera asset from the configuration backend.
 * @param cameraName The unique identifier name of the camera.
 */
export const deleteCamera = async (cameraName: string): Promise<any> => {
  const response = await axios.delete(`cameras/${cameraName}`);
  return response.data;
};
