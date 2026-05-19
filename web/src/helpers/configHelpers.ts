/**
 * Removes a specific camera block from the raw YAML configuration string.
 * Uses Regex to identify and remove the block up to the next sibling key.
 */
export const removeCameraFromYaml = (rawYaml: string, camId: string): string => {
  const regex = new RegExp(`\\n\\s{2}${camId}:[\\s\\S]*?(?=\\n\\s{2}[a-zA-Z0-9_-]+:|\\n[a-zA-Z0-9_-]+:|$)`);
  return rawYaml.replace(regex, '');
};

/**
 * Appends a new camera block into the global 'cameras:' block of the raw YAML.
 * Returns the modified YAML or throws an Error if the block cannot be found.
 */
export const addCameraToYaml = (rawYaml: string, camId: string, rtspUrl: string): string => {
  const newCameraYaml = `\n  ${camId}:
    ffmpeg:
      inputs:
      - path: ${rtspUrl}
        roles:
        - record
        - detect
    detect:
      enabled: true
      width: 1280
      height: 720
      fps: 2\n`;

  if (rawYaml.includes("cameras:\n")) {
    return rawYaml.replace("cameras:\n", `cameras:${newCameraYaml}`);
  }
  
  throw new Error("Cannot find global 'cameras:' block in configuration.");
};
