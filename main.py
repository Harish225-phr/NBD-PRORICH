"""
NBD CRM System - Python FastAPI Backend
Handles heavy processing: filtering, searching, sorting, aggregation
Google Sheets data is read by Apps Script and sent here for processing
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

app = FastAPI(title="NBD CRM API", version="1.0.0")

# Enable CORS for Apps Script communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# DATA MODELS
# ============================================================

class LeadData(BaseModel):
    leads: List[Dict[str, Any]]
    activity_logs: Optional[Dict[str, Any]] = None
    meeting_logs: Optional[List[Dict[str, Any]]] = None
    users: Optional[List[Dict[str, Any]]] = None

class FilterRequest(BaseModel):
    leads: List[Dict[str, Any]]
    user_id: str
    role: str
    filter_type: str
    metadata: Optional[Dict[str, Any]] = None

class SearchRequest(BaseModel):
    leads: List[Dict[str, Any]]
    query: str
    fields: Optional[List[str]] = None

class DashboardRequest(BaseModel):
    leads: List[Dict[str, Any]]
    user_id: str
    role: str

class DailyDashboardRequest(BaseModel):
    leads: List[Dict[str, Any]]
    tele_activity_log: List[Dict[str, Any]]
    meeting_log: List[Dict[str, Any]]
    user_id: str
    role: str
    date_str: str
    users: Optional[List[Dict[str, Any]]] = None

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def str_trim_upper(value):
    """Safely convert value to uppercase string and trim"""
    if value is None:
        return ""
    return str(value).strip().upper()

def get_date_part(datetime_str):
    """Extract date part (YYYY-MM-DD) from timestamp"""
    if not datetime_str:
        return ""
    return str(datetime_str).split('T')[0]

def build_user_map(users: Optional[List[Dict[str, Any]]]) -> Dict[str, Dict[str, str]]:
    """Build a map of user_id -> {name, role}"""
    user_map = {}
    if not users:
        return user_map
    
    for user in users:
        user_id = user.get('user_id', '')
        user_map[user_id] = {
            'name': user.get('name', user_id),
            'role': user.get('role', '')
        }
    return user_map

def count_sales_followups(lead_id: str, sales_id: str, meeting_logs: List[Dict[str, Any]]) -> int:
    """Count follow-ups for a sales person on a lead (excluding reassignments)"""
    count = 0
    last_reassign_date = None
    
    # First pass: find the latest reassignment date for this lead+sales combo
    for m in meeting_logs:
        if (m.get('lead_id') == lead_id and 
            m.get('sales_id') == sales_id and
            str_trim_upper(m.get('meeting_status', '')) == 'REASSIGNED'):
            try:
                entry_date = datetime.fromisoformat(str(m.get('created_at', '')).replace('Z', '+00:00'))
                if not last_reassign_date or entry_date > last_reassign_date:
                    last_reassign_date = entry_date
            except:
                pass
    
    # Second pass: count follow-ups after the last reassignment
    for m in meeting_logs:
        if m.get('lead_id') != lead_id or m.get('sales_id') != sales_id:
            continue
        
        status = str_trim_upper(m.get('meeting_status', ''))
        
        # Skip these statuses
        if status in ('NOT CONNECTED', 'REASSIGNED', 'SCHEDULED'):
            continue
        
        # Count only these statuses as follow-ups
        if status in ('MEETING DONE', 'VISITED', 'FOLLOWUP', 'FOLLOW UP', 'COMPLETED', 'RESCHEDULED'):
            # If there was a reassignment, only count entries AFTER it
            if last_reassign_date:
                try:
                    entry_date = datetime.fromisoformat(str(m.get('created_at', '')).replace('Z', '+00:00'))
                    if entry_date > last_reassign_date:
                        count += 1
                except:
                    count += 1
            else:
                count += 1
    
    return count

# ============================================================
# MAIN API ENDPOINTS
# ============================================================

@app.post("/process-leads")
async def process_leads(request: FilterRequest):
    """
    Filter and process leads based on user role and filter type.
    Heavy filtering logic moved from Apps Script.
    """
    try:
        leads = request.leads
        user_id = str(request.user_id).strip()
        role = request.role.upper()
        filter_type = request.filter_type.upper()
        metadata = request.metadata or {}
        
        filtered = []
        
        if role == 'TELECALLER':
            # For TELECALLER - show leads assigned to them
            filtered = [
                l for l in leads 
                if str_trim_upper(l.get('telecaller_id', '')) == user_id
            ]
            
            # Apply filter
            if filter_type == 'TODAY':
                # Show only leads in TELE stage
                filtered = [
                    l for l in filtered
                    if str_trim_upper(l.get('current_stage', '')) == 'TELE'
                ]
            elif filter_type == 'FOLLOWUP_DUE':
                # Show leads in TELE stage with NOT CONNECTED status
                filtered = [
                    l for l in filtered
                    if (str_trim_upper(l.get('current_stage', '')) == 'TELE' and
                        str_trim_upper(l.get('current_status', '')) == 'NOT CONNECTED')
                ]
            elif filter_type != 'ALL':
                pass  # Default: all leads assigned to them
        
        elif role == 'SALES COORDINATOR':
            if filter_type == 'NOT_QUALIFIED':
                filtered = [
                    l for l in leads
                    if (str_trim_upper(l.get('current_stage', '')) == 'SC' and
                        str_trim_upper(l.get('current_status', '')) == 'NOT QUALIFIED')
                ]
            elif filter_type == 'JUNK':
                filtered = [
                    l for l in leads
                    if str_trim_upper(l.get('current_stage', '')) == 'JUNK'
                ]
            else:
                # SC can see ALL leads
                filtered = leads
        
        elif role == 'SALES PERSON':
            # For SALES PERSON - show leads in SALES stage assigned to them
            sales_leads = [
                l for l in leads
                if (str_trim_upper(l.get('current_stage', '')) == 'SALES' and
                    str_trim_upper(l.get('sales_id', '')) == user_id)
            ]
            
            # Apply filter
            if filter_type == 'TODAY':
                today = datetime.now().strftime('%Y-%m-%d')
                filtered = [
                    l for l in sales_leads
                    if (str_trim_upper(l.get('current_stage', '')) != 'WON' and
                        str_trim_upper(l.get('current_status', '')) not in ('CONVERTED', 'LOST') and
                        get_date_part(l.get('meeting_datetime', '')) == today)
                ]
            elif filter_type == 'FOLLOWUP_DUE':
                today = datetime.now().strftime('%Y-%m-%d')
                filtered = [
                    l for l in sales_leads
                    if (str_trim_upper(l.get('current_stage', '')) != 'WON' and
                        str_trim_upper(l.get('current_status', '')) not in ('CONVERTED', 'LOST') and
                        str_trim_upper(l.get('current_status', '')) in ('FOLLOW UP', 'FOLLOW-UP', 'FOLLOWUP', 
                                                                           'RESCHEDULED', 'NOT CONNECTED', 
                                                                           'MEETING DONE', 'VISITED') and
                        get_date_part(l.get('meeting_datetime', '')) and
                        get_date_part(l.get('meeting_datetime', '')) != today)
                ]
            else:
                filtered = sales_leads
        
        elif role == 'ADMIN':
            filtered = leads
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
        
        # Sort by created_at descending (newest first)
        filtered.sort(
            key=lambda x: datetime.fromisoformat(
                str(x.get('created_at', '1970-01-01')).replace('Z', '+00:00')
            ) if x.get('created_at') else datetime.fromisoformat('1970-01-01'),
            reverse=True
        )
        
        return {
            "success": True,
            "count": len(filtered),
            "leads": filtered
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing leads: {str(e)}")

@app.post("/search-leads")
async def search_leads(request: SearchRequest):
    """
    Search leads by query string across multiple fields
    """
    try:
        leads = request.leads
        query = request.query.lower()
        fields = request.fields or ['customer_name', 'phone', 'email', 'company', 'requirement']
        
        # Filter leads that match the query in any of the specified fields
        results = []
        for lead in leads:
            for field in fields:
                value = str(lead.get(field, '')).lower()
                if query in value:
                    results.append(lead)
                    break
        
        # Sort by relevance (best matches first) by customer_name
        results.sort(key=lambda x: x.get('customer_name', ''))
        
        return {
            "success": True,
            "count": len(results),
            "leads": results
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching leads: {str(e)}")

@app.post("/filter-leads")
async def filter_leads(request: FilterRequest):
    """
    Advanced filtering with multiple criteria
    """
    try:
        leads = request.leads
        metadata = request.metadata or {}
        
        filtered = leads
        
        # Filter by lead_source if provided
        if 'lead_source' in metadata and metadata['lead_source']:
            source = metadata['lead_source'].upper()
            filtered = [l for l in filtered if str_trim_upper(l.get('lead_source', '')) == source]
        
        # Filter by lead_type if provided
        if 'lead_type' in metadata and metadata['lead_type']:
            ltype = metadata['lead_type'].upper()
            filtered = [l for l in filtered if str_trim_upper(l.get('lead_type', '')) == ltype]
        
        # Filter by current_stage if provided
        if 'current_stage' in metadata and metadata['current_stage']:
            stage = metadata['current_stage'].upper()
            filtered = [l for l in filtered if str_trim_upper(l.get('current_stage', '')) == stage]
        
        # Filter by current_status if provided
        if 'current_status' in metadata and metadata['current_status']:
            status = metadata['current_status'].upper()
            filtered = [l for l in filtered if str_trim_upper(l.get('current_status', '')) == status]
        
        # Filter by date range if provided
        if 'start_date' in metadata and metadata['start_date']:
            start_date = metadata['start_date']
            filtered = [l for l in filtered if get_date_part(l.get('created_at', '')) >= start_date]
        
        if 'end_date' in metadata and metadata['end_date']:
            end_date = metadata['end_date']
            filtered = [l for l in filtered if get_date_part(l.get('created_at', '')) <= end_date]
        
        # Sort by created_at descending
        filtered.sort(
            key=lambda x: datetime.fromisoformat(
                str(x.get('created_at', '1970-01-01')).replace('Z', '+00:00')
            ) if x.get('created_at') else datetime.fromisoformat('1970-01-01'),
            reverse=True
        )
        
        return {
            "success": True,
            "count": len(filtered),
            "leads": filtered
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error filtering leads: {str(e)}")

@app.post("/dashboard-stats")
async def dashboard_stats(request: DashboardRequest):
    """
    Calculate dashboard statistics based on user role
    """
    try:
        leads = request.leads
        user_id = str(request.user_id).strip()
        role = request.role.upper()
        today = datetime.now().strftime('%Y-%m-%d')
        
        stats = {}
        
        if role == 'TELECALLER':
            # Leads assigned to this telecaller in TELE stage
            tele_leads = [
                l for l in leads
                if (str_trim_upper(l.get('telecaller_id', '')) == user_id and
                    str_trim_upper(l.get('current_stage', '')) == 'TELE')
            ]
            
            # All leads assigned to telecaller (regardless of stage)
            all_tele_leads = [
                l for l in leads
                if str_trim_upper(l.get('telecaller_id', '')) == user_id
            ]
            
            stats = {
                "total": len(all_tele_leads),
                "new_today": len([
                    l for l in tele_leads
                    if get_date_part(l.get('created_at', '')) == today
                ]),
                "followup_due": len([
                    l for l in tele_leads
                    if str_trim_upper(l.get('current_status', '')) == 'NOT CONNECTED'
                ]),
                "qualified": len([
                    l for l in all_tele_leads
                    if str(l.get('current_status', '')).upper() in (
                        'QUALIFIED', 'SC QUALIFIED', 'MEETING SCHEDULED', 'CONVERTED', 'WON'
                    ) or 'QUALIFIED' in str(l.get('current_status', '')).upper()
                ])
            }
        
        elif role == 'SALES COORDINATOR':
            sc_stage_leads = [
                l for l in leads
                if str_trim_upper(l.get('current_stage', '')) == 'SC'
            ]
            
            stats = {
                "total": len(leads),
                "pending_verification": len([
                    l for l in sc_stage_leads
                    if str_trim_upper(l.get('current_status', '')) == 'NOT QUALIFIED'
                ]),
                "verified_today": len([
                    l for l in leads
                    if (str_trim_upper(l.get('sc_id', '')) == user_id and
                        get_date_part(l.get('updated_at', '')) == today)
                ]),
                "created_today": len([
                    l for l in leads
                    if get_date_part(l.get('created_at', '')) == today
                ])
            }
        
        elif role == 'SALES PERSON':
            sp_leads = [
                l for l in leads
                if (str_trim_upper(l.get('sales_id', '')) == user_id and
                    str_trim_upper(l.get('current_stage', '')) == 'SALES')
            ]
            
            stats = {
                "total": len(sp_leads),
                "meetings_scheduled": len([
                    l for l in sp_leads
                    if str_trim_upper(l.get('current_status', '')) == 'MEETING SCHEDULED'
                ]),
                "meetings_today": len([
                    l for l in sp_leads
                    if get_date_part(l.get('meeting_datetime', '')) == today
                ]),
                "converted": len([
                    l for l in leads
                    if (str_trim_upper(l.get('sales_id', '')) == user_id and
                        str_trim_upper(l.get('current_stage', '')) == 'WON')
                ])
            }
        
        elif role == 'ADMIN':
            stats = {
                "total_leads": len(leads),
                "in_tele": len([l for l in leads if str_trim_upper(l.get('current_stage', '')) == 'TELE']),
                "in_sc": len([l for l in leads if str_trim_upper(l.get('current_stage', '')) == 'SC']),
                "in_sales": len([l for l in leads if str_trim_upper(l.get('current_stage', '')) == 'SALES']),
                "won": len([l for l in leads if str_trim_upper(l.get('current_stage', '')) == 'WON']),
                "closed": len([l for l in leads if str_trim_upper(l.get('current_stage', '')) == 'CLOSED'])
            }
        
        return {
            "success": True,
            "stats": stats
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating stats: {str(e)}")

@app.post("/daily-dashboard")
async def daily_dashboard(request: DailyDashboardRequest):
    """
    Get daily dashboard data with activity summary for a specific date
    """
    try:
        leads = request.leads
        tele_log = request.tele_activity_log or []
        meeting_log = request.meeting_log or []
        user_id = str(request.user_id).strip()
        role = request.role.upper()
        date_str = request.date_str
        users = request.users or []
        
        user_map = build_user_map(users)
        leads_map = {l.get('lead_id'): l for l in leads}
        
        if role == 'TELECALLER':
            # Filter telecaller's activity on this date
            tele_activity = [
                e for e in tele_log
                if (str_trim_upper(e.get('telecaller_id', '')) == user_id and
                    e.get('action') != 'ASSIGNMENT' and
                    get_date_part(e.get('tele_actual_time', e.get('created_at', ''))) == date_str)
            ]
            
            # Meetings scheduled by telecaller on this date
            meetings_scheduled = [
                m for m in meeting_log
                if (str_trim_upper(m.get('scheduled_by', '')) == user_id and
                    str_trim_upper(m.get('meeting_status', '')) == 'SCHEDULED' and
                    get_date_part(m.get('created_at', '')) == date_str)
            ]
            
            # Calculate stats
            stats = {
                "total": len(tele_activity),
                "qualified": len([e for e in tele_activity if str_trim_upper(e.get('action', '')) == 'QUALIFIED']),
                "not_connected": len([e for e in tele_activity if str_trim_upper(e.get('action', '')) == 'NOT CONNECTED']),
                "not_qualified": len([e for e in tele_activity if str_trim_upper(e.get('action', '')) == 'NOT QUALIFIED']),
                "not_picked": len([e for e in tele_activity if str_trim_upper(e.get('action', '')) == 'NOT PICKED']),
                "meetings_scheduled": len(meetings_scheduled)
            }
            
            # Deduplicate by lead_id (keep latest action per lead)
            latest_by_lead = {}
            for e in tele_activity:
                lid = e.get('lead_id')
                time = datetime.fromisoformat(
                    str(e.get('tele_actual_time', e.get('created_at', ''))).replace('Z', '+00:00')
                ) if e.get('tele_actual_time') or e.get('created_at') else datetime.min
                
                if lid not in latest_by_lead or time > datetime.fromisoformat(
                    str(latest_by_lead[lid].get('tele_actual_time', latest_by_lead[lid].get('created_at', ''))).replace('Z', '+00:00')
                ) if latest_by_lead[lid].get('tele_actual_time') or latest_by_lead[lid].get('created_at') else datetime.min:
                    latest_by_lead[lid] = e
            
            # Build activities list
            activities = []
            for e in latest_by_lead.values():
                lead = leads_map.get(e.get('lead_id'), {})
                activities.append({
                    "time": e.get('tele_actual_time', e.get('created_at')),
                    "lead_id": e.get('lead_id'),
                    "customer_name": lead.get('customer_name',  ''),
                    "phone": lead.get('phone', ''),
                    "company": lead.get('company', ''),
                    "action": e.get('action'),
                    "remark": e.get('remark', ''),
                    "phone_call": e.get('phone_call'),
                    "whatsapp_call": e.get('whatsapp_call'),
                    "whatsapp_message": e.get('whatsapp_message'),
                    "email_sent": e.get('email_sent')
                })
            
            return {
                "success": True,
                "role": "TELECALLER",
                "date": date_str,
                "stats": stats,
                "activities": activities
            }
        
        elif role == 'SALES PERSON':
            # Filter sales person's meetings on this date
            meetings = [
                m for m in meeting_log
                if (str_trim_upper(m.get('sales_id', '')) == user_id and
                    str_trim_upper(m.get('meeting_status', '')) != 'REASSIGNED' and
                    get_date_part(m.get('created_at', '')) == date_str)
            ]
            
            # Calculate stats
            status_counts = {}
            for m in meetings:
                status = str_trim_upper(m.get('meeting_status', ''))
                status_counts[status] = status_counts.get(status, 0) + 1
            
            stats = {
                "total": len(meetings),
                "scheduled": status_counts.get('SCHEDULED', 0),
                "meeting_done": status_counts.get('MEETING DONE', 0) + status_counts.get('VISITED', 0),
                "follow_up": len([m for m in meetings if str_trim_upper(m.get('meeting_status', '')) in 
                                 ('FOLLOW UP', 'FOLLOWUP', 'RESCHEDULED')]),
                "converted": status_counts.get('CONVERTED', 0) + status_counts.get('COMPLETED', 0),
                "lost": status_counts.get('LOST', 0),
                "no_show": status_counts.get('NOT CONNECTED', 0)
            }
            
            # Deduplicate by lead_id (keep latest meeting per lead)
            latest_by_lead = {}
            for m in meetings:
                lid = m.get('lead_id')
                time = datetime.fromisoformat(
                    str(m.get('created_at', '')).replace('Z', '+00:00')
                ) if m.get('created_at') else datetime.min
                
                if lid not in latest_by_lead or time > datetime.fromisoformat(
                    str(latest_by_lead[lid].get('created_at', '')).replace('Z', '+00:00')
                ) if latest_by_lead[lid].get('created_at') else datetime.min:
                    latest_by_lead[lid] = m
            
            # Build activities list
            activities = []
            for m in latest_by_lead.values():
                lead = leads_map.get(m.get('lead_id'), {})
                activities.append({
                    "time": m.get('created_at'),
                    "lead_id": m.get('lead_id'),
                    "customer_name": lead.get('customer_name', ''),
                    "phone": lead.get('phone', ''),
                    "company": lead.get('company', ''),
                    "meeting_mode": m.get('meeting_mode', ''),
                    "status": m.get('meeting_status'),
                    "remark": m.get('meeting_remark', '')
                })
            
            return {
                "success": True,
                "role": "SALES PERSON",
                "date": date_str,
                "stats": stats,
                "activities": activities
            }
        
        return {
            "success": False,
            "message": "Daily dashboard not available for this role"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting daily dashboard: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ============================================================
# ERROR HANDLING
# ============================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "NBD CRM Python Backend",
        "version": "1.0.0",
        "endpoints": {
            "/process-leads": "POST - Filter and process leads by role",
            "/search-leads": "POST - Search leads by query",
            "/filter-leads": "POST - Advanced filtering",
            "/dashboard-stats": "POST - Calculate dashboard stats",
            "/daily-dashboard": "POST - Get daily dashboard data",
            "/health": "GET - Health check"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)