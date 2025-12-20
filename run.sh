#!/bin/bash

APP_MODULE="api.index:app"
HOST="0.0.0.0"
PORT="8000"
PID_FILE="shynote.pid"
LOG_FILE="shynote.log"

start() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Service is already running with PID $PID"
            return
        else
            echo "PID file exists but process is not running. Cleaning up..."
            rm "$PID_FILE"
        fi
    fi

    echo "Starting SHYNOTE..."
    nohup uv run uvicorn "$APP_MODULE" --host "$HOST" --port "$PORT" --reload > "$LOG_FILE" 2>&1 &
    
    PID=$!
    echo "$PID" > "$PID_FILE"
    echo "Service started with PID $PID"
    echo "Logs are being written to $LOG_FILE"
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "Service is not running (PID file not found)"
        return
    fi

    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Stopping SHYNOTE (PID $PID)..."
        kill "$PID"
        
        # Wait for process to exit
        while ps -p "$PID" > /dev/null 2>&1; do
            sleep 0.5
        done
        
        echo "Service stopped"
    else
        echo "Process $PID is not running"
    fi
    
    rm "$PID_FILE"
}

restart() {
    stop
    sleep 1
    start
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac
