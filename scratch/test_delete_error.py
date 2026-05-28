import sys
import ruamel.yaml
from io import StringIO
from pydantic import ValidationError

sys.path.insert(0, '/home/hypernet-dev/AIVIEWSION')
from frigate.config import FrigateConfig

# Read the current config.yml
with open('/home/hypernet-dev/AIVIEWSION/local_data/config.yml', 'r') as f:
    raw_config = f.read()

# Define the deletion helper logic
import re
def remove_camera_from_yaml(raw_yaml: str, cam_id: str) -> str:
    regex = re.compile(
        rf'\n\s{{2}}{cam_id}:[\s\S]*?(?=\n\s{{2}}[a-zA-Z0-9_-]+:|\n[a-zA-Z0-9_-]+:|$)'
    )
    return regex.sub("", raw_yaml)

print("--- Original Config ---")
print(raw_config)

# Remove 'nvr' camera
updated_config = remove_camera_from_yaml(raw_config, "nvr")

print("--- Updated Config ---")
print(updated_config)

# Validate config
try:
    FrigateConfig.parse_yaml(updated_config)
    print("Validation passed!")
except ValidationError as e:
    print("Validation error:")
    for error in e.errors():
         print(error)
except Exception as e:
    print(f"Other exception: {e}")
