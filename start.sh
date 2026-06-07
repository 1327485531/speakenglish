#!/bin/bash
# 英语口语提词器 — 一键启动
# 用法: ./start.sh [端口号]

PORT=${1:-8080}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=================================="
echo "  英语口语提词器"
echo "=================================="
echo ""

# 优先用 python3，其次 python
if command -v python3 &> /dev/null; then
  echo "[启动] 使用 Python3 HTTP 服务器 (端口 $PORT)"
  echo "[访问] http://localhost:$PORT"
  echo "[停止] Ctrl+C"
  echo ""
  cd "$DIR" && python3 -m http.server "$PORT"
elif command -v python &> /dev/null; then
  echo "[启动] 使用 Python HTTP 服务器 (端口 $PORT)"
  echo "[访问] http://localhost:$PORT"
  echo "[停止] Ctrl+C"
  echo ""
  cd "$DIR" && python -m http.server "$PORT"
elif command -v node &> /dev/null; then
  echo "[启动] 使用 Node.js http-server"
  echo "[访问] http://localhost:$PORT"
  echo "[停止] Ctrl+C"
  echo ""
  npx --yes http-server "$DIR" -p "$PORT" -c-1
else
  echo "错误: 未找到 python 或 node，请安装其中之一。"
  exit 1
fi
