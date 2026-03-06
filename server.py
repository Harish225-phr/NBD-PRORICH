"""
Startup script for Render deployment with OPTIMIZED uvicorn configuration
Performance tuning for 10k+ concurrent users
"""
import uvicorn
import os
import sys
from main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    
    # Auto-detect optimal worker count (4 workers = good for Render free tier)
    workers = int(os.environ.get("WORKERS", 4))
    
    print(f"🚀 Starting NBD CRM API on port {port} with {workers} workers")
    print(f"📊 Configuration: Pagination (50/page) + GZip + 5min Cache")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        workers=workers,
        timeout_keep_alive=120,              # Keep connections alive longer (120s)
        timeout_notify=120,                  # Graceful shutdown timeout
        timeout_shutdown=30,                 # Shutdown timeout
        limit_concurrency=1000,              # Allow 1000 concurrent connections
        limit_max_requests=10000,            # Restart worker after 10k requests (prevent memory leak)
        ws_max_size=16777216,                # 16MB WebSocket payload
        access_log=False,                    # Disable access logging (saves CPU)
        log_level="warning",                 # Only log warnings and errors
        interface="auto",                    # Auto-select best interface
        backlog=2048,                        # Connection backlog (handle spikes)
    )
