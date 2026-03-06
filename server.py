"""
Startup script for Render deployment with proper uvicorn configuration
"""
import uvicorn
import os
from main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        timeout_keep_alive=120,       # Keep connections alive longer
        timeout_notify=120,           # Graceful shutdown timeout
        limit_concurrency=1000,       # Allow more concurrent requests
        limit_max_requests=10000,     # Restart worker after 10k requests
        ws_max_size=16777216,         # 16MB for WebSocket payloads
        access_log=False,             # Reduce overhead from logging
    )
