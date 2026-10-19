"""Run the demo server: python -m server [--port N]  (binds to 127.0.0.1 only)."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # repo root, independent of cwd

import uvicorn  # noqa: E402

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    uvicorn.run("server.api:app", host="127.0.0.1", port=args.port, log_level="warning")
