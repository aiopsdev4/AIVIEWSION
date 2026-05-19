import axios from "axios";

/**
 * Saves the provided YAML configuration payload to the backend and triggers a system restart.
 * @param yamlPayload The full raw YAML string configuration.
 */
export const saveAndRestartConfig = async (yamlPayload: string): Promise<void> => {
  await axios.post(`config/save?save_option=restart`, yamlPayload, {
    headers: { "Content-Type": "text/plain" },
  });
};
