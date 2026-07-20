import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from data.seed_db import seed

def reset_normal():
    print("🔄 Resetting SENTINEL platform to normal baseline state...")
    try:
        seed()
        print("🟢 Reset complete. All zones returned to NORMAL operating baseline.")
    except Exception as e:
        print(f"❌ Error resetting state: {e}")

if __name__ == "__main__":
    reset_normal()
