#!/usr/bin/env bash
set -e
PYTHON_CMD="python"
if command -v python.exe &>/dev/null; then
  PYTHON_CMD="python.exe"
elif command -v python3 &>/dev/null; then
  PYTHON_CMD="python3"
fi
$PYTHON_CMD "$(dirname "$0")/test_t400_qa.py"
