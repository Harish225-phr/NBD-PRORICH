# Render Deployment Guide for NBD CRM Python Backend

Step-by-step guide to deploy the Python backend to Render.com (with free tier option).

## Prerequisites

- Render.com account (free tier available: https://render.com)
- GitHub account with code pushed
- The code files: `main.py` and `requirements.txt`

## Deployment Steps

### Step 1: Push Code to GitHub

1. Create a GitHub repository (or use existing)
2. Push this folder to GitHub:
```bash
git add .
git commit -m "Add NBD CRM Python backend"
git push origin main
```

Your GitHub should have:
```
repository/
├── main.py
├── requirements.txt
└── README.md
```

### Step 2: Create Render Account (Free Tier)

1. Go to https://render.com
2. Sign up (GitHub login recommended)
3. Complete email verification

### Step 3: Create Web Service

1. **Dashboard → New** → **Web Service**
2. **Connect Repository:**
   - Select "GitHub" as provider
   - Select your repository
   - Click "Connect" (may need to authorize GitHub)

3. **Configure Service:**
   - **Name:** `nbd-crm-api` (or your preferred name)
   - **Runtime:** Select `Python 3.11`
   - **Region:** Choose closest region (or default)
   - **Branch:** `main`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 10000`

4. **Pricing Plan:**
   - Free tier: 0.5GB RAM, 50ms CPU, limited bandwidth
   - Good for up to 1000 concurrent requests/day
   - Sufficient for typical CRM usage

5. **Click Create Web Service**

### Step 4: Wait for Deployment

- Render will:
  1. Clone your repository
  2. Install dependencies (`pip install -r requirements.txt`)
  3. Start the service (`uvicorn main:app...`)
  4. Assign you a public URL

- This typically takes 2-5 minutes
- Check the "Events" tab for deployment logs

### Step 5: Get Your Deployment URL

Once deployment is complete (green "Live" status):

1. You'll see a URL like: `https://nbd-crm-api.onrender.com`
2. Copy this URL
3. Test the API:
   ```bash
   curl https://nbd-crm-api.onrender.com/health
   ```
   You should get: `{"status":"healthy","timestamp":"..."}`

### Step 6: Update Apps Script

In Google Apps Script (code.gs), update:

```javascript
// === PYTHON API CONFIGURATION ===
const PYTHON_API_URL = 'https://nbd-crm-api.onrender.com';
// Replace 'nbd-crm-api' with your actual Render service name
```

### Step 7: Test the Integration

In Google Apps Script, run a test:

```javascript
function testPythonIntegration() {
  const response = UrlFetchApp.fetch(PYTHON_API_URL + '/health', {
    muteHttpExceptions: true
  });
  Logger.log('Response Code: ' + response.getResponseCode());
  Logger.log('Response: ' + response.getContentText());
}
```

Expected output:
```
Response Code: 200
Response: {"status":"healthy","timestamp":"2026-03-06T..."}
```

## Performance Monitoring

### View Logs

1. Render Dashboard → Your Service → "Logs"
2. Real-time logs of API requests
3. Errors shown in red
4. Search by time/request ID

### Monitor Metrics

1. **CPU/Memory:** Dashboard shows resource usage
2. **Response Time:** Check average request time
3. **Errors:** Monitor error rate (should be <1%)

### Cold Start Behavior

- **First request after 15 min:** May take 5-10 seconds (Render  spins up container)
- **Subsequent requests:** Sub-100ms
- **Typical pattern:** App is always "warm" during business hours

## Upgrading from Free Tier

If you hit free tier limits:

1. Go to your service settings
2. **Plan:** Change to "Standard" ($7/month)
3. Render auto-upgrades without downtime

Free → Standard gives you:
- 2x CPU power
- 512MB RAM (instead of 256MB)
- No sleep/cold starts
- Priority support

## Troubleshooting Deployment

### Build Failed
- Check `pip install -r requirements.txt`
- Verify requirements.txt syntax
- Check Python version compatibility

**Solution:**
```bash
# Test locally first
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 10000
```

### Service Won't Start
- Check "Start Command" is exactly:
  ```
  uvicorn main:app --host 0.0.0.0 --port 10000
  ```
- Port must be `10000` (or match your code)
- Check logs for Python errors

### API Returns 500 Error
- Check Logs tab in Render
- Look for Python exception stack trace
- Verify request format matches endpoint specification

### High Latency / Timeouts
- Render free tier has 30-second timeout
- Large datasets might timeout
- Solution: Upgrade to Standard tier or optimize payload size

## Auto-Deploy on Code Push

Render automatically redeploys when you push to GitHub:

1. Make code changes
2. `git commit` and `git push`
3. Render automatically redeploys (2-5 minutes)
4. Zero downtime during deployment
5. Rollback available in case of issues

## Environment Variables (Optional)

To add configuration without changing code:

1. Render Dashboard → Service → Environment
2. **Add Environment Variable:**
   ```
   Name: LOG_LEVEL
   Value: INFO
   ```
3. Access in Python:
   ```python
   import os
   log_level = os.getenv('LOG_LEVEL', 'INFO')
   ```

## Connecting to Apps Script

### One-Time Setup

Add at top of your `code.gs`:

```javascript
// For Render deployment (replace with your actual URL)
const PYTHON_API_URL = 'https://YOUR-SERVICE-NAME.onrender.com';

// Function to verify connectivity
function testPythonConnection() {
  if (!PYTHON_API_URL) {
    return { success: false, message: 'PYTHON_API_URL not configured' };
  }
  
  try {
    const response = UrlFetchApp.fetch(PYTHON_API_URL + '/health', {
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return { 
        success: true, 
        message: 'Python API is alive!',
        data: data 
      };
    } else {
      return { 
        success: false, 
        message: 'Python API returned: ' + response.getResponseCode() 
      };
    }
  } catch (e) {
    return { 
      success: false, 
      message: 'Cannot reach Python API: ' + e.message 
    };
  }
}
```

Then run:
```javascript
testPythonConnection();
```

Check Apps Script logs for result.

## Cost Estimate

### Free Tier
- **Cost:** $0/month
- **Suitable for:** Testing, development, light production use
- **Limits:** 0.5GB RAM, ~50 concurrent builds
- **Sleep:** Suspends after 15 min inactivity

### Standard Tier
- **Cost:** $7/month
- **Suitable for:** Production deployment
- **Includes:** 512MB RAM, no sleep, priority support

### Pro Tier
- **Cost:** $25+/month
- **For:** High-traffic deployments (10,000+ concurrent users)

**Recommendation:** Start with Free, upgrade to Standard once live.

## Backup & Recovery

### Manual Backup
- GitHub is your backup (code is versioned)
- Python backend is stateless (no data to backup)
- All data stays in Google Sheets

### Disaster Recovery
- If Render goes down: Switch back to local processing
  ```javascript
  const PYTHON_API_URL = ''; // Disable Python backend
  ```
  CRM continues working with local processing (slower but functional)

## Next Steps

1. ✅ Deploy to Render
2. ✅ Get deployment URL
3. ✅ Update Apps Script config
4. ✅ Test the integration
5. ✅ Monitor for 24 hours
6. ✅ Set up alerts (optional)

## Support

- Render Docs: https://render.com/docs
- FastAPI Docs: https://fastapi.tiangolo.com/
- Issues? Check service logs in Render dashboard

## Version Info

- **Python:** 3.11
- **FastAPI:** 0.104.1
- **Uvicorn:** 0.24.0

---

**Deployed successfully?** Your NBD CRM system is now 5-10x faster! 🚀

---

**Still need help?** Refer back to [../OPTIMIZATION_GUIDE.md](../OPTIMIZATION_GUIDE.md) for architecture details.
