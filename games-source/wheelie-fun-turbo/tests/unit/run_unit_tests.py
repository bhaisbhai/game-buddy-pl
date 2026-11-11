#!/usr/bin/env python3
"""Runs every Wheelie Fun test that works on any OS:

  1. Python unit tests  (tests/unit/test_*.py)       - server logic, WebSocket framing, build, data
  2. JavaScript unit tests (tests/unit/js/*.test.mjs) - online client, room host, upgrades, live game
  3. Track geometry checks (tests/validate_tracks.py)
  4. Online server integration test (tests/test_online_server.py)

Usage:  python tests/unit/run_unit_tests.py
Needs Python 3.10+ and Node 22+. The live-game JS test also needs Chrome or Edge and internet
(it skips itself otherwise). Exit code is non-zero if anything failed.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ENV = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}


def run(title: str, cmd: list[str], cwd: Path) -> bool:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}", flush=True)
    ok = subprocess.run(cmd, cwd=str(cwd), env=ENV).returncode == 0
    print(f"--> {'PASSED' if ok else 'FAILED'}: {title}", flush=True)
    return ok


def main() -> int:
    results = {}
    results["Python unit tests"] = run(
        "Python unit tests", [sys.executable, "-m", "unittest", "discover", "-s", str(HERE), "-p", "test_*.py", "-v"], HERE)
    node = shutil.which("node")
    if node:
        tests = sorted(str(p) for p in (HERE / "js").glob("*.test.mjs"))
        results["JavaScript unit tests"] = run("JavaScript unit tests", [node, "--test", *tests], ROOT)
    else:
        print("\n(node not found - skipping JavaScript unit tests)")
    results["Track geometry"] = run("Track geometry", [sys.executable, str(ROOT / "tests" / "validate_tracks.py")], ROOT)
    results["Online server integration"] = run(
        "Online server integration", [sys.executable, str(ROOT / "tests" / "test_online_server.py")], ROOT)

    print(f"\n{'=' * 70}\nSUMMARY\n{'=' * 70}")
    for name, ok in results.items():
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
