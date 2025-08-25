#!/bin/bash

# 定期同步状态文件到golf_content目录
while true; do
    if [ -f "system_status_realtime.json" ]; then
        cp system_status_realtime.json golf_content/
    fi
    sleep 5
done