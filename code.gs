// ============================================
// NBD LEAD MANAGEMENT SYSTEM - BACKEND
// Google Apps Script | Production Ready
// Performance Optimized with Python FastAPI Backend
// ============================================

// === CONFIGURATION ===
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEETS = {
  USERS: 'USERS',
  LEADS_MASTER: 'LEADS_MASTER',
  TELE_ACTIVITY_LOG: 'TELE_ACTIVITY_LOG',
  SC_ACTIVITY_LOG: 'SC_ACTIVITY_LOG',
  MEETING_LOG: 'MEETING_LOG',
  CONVERTED_LOG: 'CONVERTED_LOG'
};

// === PYTHON API CONFIGURATION ===
// Set this to your Python FastAPI backend URL (e.g., https://your-render-app.onrender.com)
// Leave empty to use local/direct processing (for testing without Python backend)
const PYTHON_API_URL = 'https://nbd-prorich.onrender.com';

// === Performance Cache (30 seconds) ===
const CACHE_DURATION = 30000; // milliseconds
let lastFetchTime = 0;
let cachedLeads = null;
let cachedUsers = null;

// === HELPER: Fetch all leads from sheet (cached) ===
function getAllLeadsFromSheet() {
  const now = new Date().getTime();
  
  // Return cached data if still fresh (< 30 seconds)
  if (cachedLeads && (now - lastFetchTime < CACHE_DURATION)) {
    Logger.log('Using cached leads data (age: ' + (now - lastFetchTime) + 'ms)');
    return cachedLeads;
  }
  
  const sheet = getSheet(SHEETS.LEADS_MASTER);
  if (!sheet) return [];
  
  cachedLeads = sheetToObjects(sheet);
  lastFetchTime = now;
  Logger.log('Fetched ' + cachedLeads.length + ' leads from sheet');
  return cachedLeads;
}

// === HELPER: Fetch all users from sheet ===
function getAllUsersFromSheet() {
  const sheet = getSheet(SHEETS.USERS);
  if (!sheet) return [];
  return sheetToObjects(sheet);
}

// === HELPER: Fetch activity logs from sheet ===
function getTeleActivityLog() {
  const sheet = getSheet(SHEETS.TELE_ACTIVITY_LOG);
  if (!sheet) return [];
  return sheetToObjects(sheet);
}

// === HELPER: Fetch meeting logs from sheet ===
function getMeetingLog() {
  const sheet = getSheet(SHEETS.MEETING_LOG);
  if (!sheet) return [];
  return sheetToObjects(sheet);
}

// === HELPER: Call Python API for lead processing ===
function callPythonAPI(endpoint, payload) {
  if (!PYTHON_API_URL) {
    Logger.log('PYTHON_API_URL not configured. Using local processing.');
    return null;
  }
  
  try {
    // Log the payload size to debug large data issues
    const payloadStr = JSON.stringify(payload);
    Logger.log('Payload size: ' + payloadStr.length + ' bytes');
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: payloadStr,
      muteHttpExceptions: true,
      timeout: 120000 // 120 second timeout (increased from 30s)
    };
    
    const url = PYTHON_API_URL.replace(/\/$/, '') + endpoint;
    Logger.log('Calling Python API: ' + url);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('Python API Response Code: ' + responseCode);
    Logger.log('Response Text (first 500 chars): ' + responseText.substring(0, 500));
    
    if (responseCode === 200) {
      try {
        return JSON.parse(responseText);
      } catch (parseErr) {
        Logger.log('Error parsing Python response: ' + parseErr.message);
        return null;
      }
    } else {
      Logger.log('Python API error: ' + responseCode + ' - ' + responseText);
      return null;
    }
  } catch (e) {
    Logger.log('Error calling Python API: ' + e.message);
    Logger.log('Error stack: ' + e.stack);
    return null;
  }
}

// === MAIN ENTRY POINT ===
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('NBD Lead Management System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// === DEBUG FUNCTION - Call this to test data ===
function debugLeadsData() {
  const sheet = getSheet(SHEETS.LEADS_MASTER);
  if (!sheet) {
    Logger.log('ERROR: LEADS_MASTER sheet not found!');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  Logger.log('Total rows (including header): ' + data.length);
  
  if (data.length > 0) {
    Logger.log('Headers: ' + JSON.stringify(data[0]));
  }
  
  if (data.length > 1) {
    Logger.log('First data row: ' + JSON.stringify(data[1]));
    
    // Check specific columns
    const headers = data[0];
    const firstRow = data[1];
    
    const telecallerIdx = headers.indexOf('telecaller_id');
    const stageIdx = headers.indexOf('current_stage');
    
    Logger.log('telecaller_id column index: ' + telecallerIdx);
    Logger.log('current_stage column index: ' + stageIdx);
    
    if (telecallerIdx >= 0) {
      Logger.log('First row telecaller_id: [' + firstRow[telecallerIdx] + ']');
    }
    if (stageIdx >= 0) {
      Logger.log('First row current_stage: [' + firstRow[stageIdx] + ']');
    }
  }
  
  // Also check USERS sheet
  const usersSheet = getSheet(SHEETS.USERS);
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    Logger.log('USERS sheet rows: ' + usersData.length);
    if (usersData.length > 1) {
      Logger.log('Users headers: ' + JSON.stringify(usersData[0]));
      Logger.log('First user: ' + JSON.stringify(usersData[1]));
    }
  }
}

// === TEST FUNCTION - Run this to test listLeadsByRole ===
function testListLeadsByRole() {
  // Test with U001 TELECALLER and TODAY filter
  const result = listLeadsByRole('U001', 'TELECALLER', 'TODAY');
  Logger.log('=== TEST RESULT ===');
  Logger.log('Success: ' + result.success);
  Logger.log('Leads count: ' + (result.leads ? result.leads.length : 0));
  if (result.leads && result.leads.length > 0) {
    Logger.log('First lead: ' + JSON.stringify(result.leads[0]));
  }
  if (result.message) {
    Logger.log('Message: ' + result.message);
  }
  return result;
}

// === HELPER FUNCTIONS ===
function getSheet(sheetName) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
}

function generateId(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

function getTimestamp() {
  return new Date().toISOString();
}

function safeExecute(callback) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getNextWorkingDay() {
  const today = new Date();
  const nextDay = new Date(today);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // If next day is Sunday (0), shift to Monday
  if (nextDay.getDay() === 0) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay.toISOString().split('T')[0];
}

function isValidFollowupDate(dateStr) {
  const nextWorking = getNextWorkingDay();
  if (dateStr !== nextWorking) {
    return false;
  }
  return true;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, idx) => {
      let value = row[idx];
      // Convert Date objects to ISO string to prevent serialization issues
      if (value instanceof Date) {
        value = value.toISOString();
      }
      obj[header] = value;
    });
    return obj;
  });
}

function findRowByColumn(sheet, columnName, value) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(columnName);
  if (colIdx === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIdx] === value) return i + 1;
  }
  return -1;
}

function updateRowByLeadId(sheet, leadId, updates) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdIdx = headers.indexOf('lead_id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      Object.keys(updates).forEach(key => {
        const colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(updates[key]);
        }
      });
      return true;
    }
  }
  return false;
}

// === RECORD ASSIGNMENT EVENT (Internal - stores in TELE_ACTIVITY_LOG with special action type) ===
function recordAssignmentEvent(leadId, assignedToUserId, assignedByUserId, assignmentType, timestamp) {
  try {
    const logSheet = getSheet(SHEETS.TELE_ACTIVITY_LOG);
    if (!logSheet) return false;
    
    const logId = generateId('ASSIGN');
    const now = timestamp || getTimestamp();
    
    // Create assignment event record (header-aware to handle column order)
    // We store it with action='ASSIGNMENT' for easy identification in history
    const assignHeaders = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
    const assignMap = {
      'log_id': logId,
      'lead_id': leadId,
      'telecaller_id': assignedByUserId,
      'action': 'ASSIGNMENT',
      'remark': assignmentType,
      'followup_datetime': assignedToUserId,
      'tele_plan_time': '',
      'tele_actual_time': now,
      'phone_call': '',
      'whatsapp_call': '',
      'whatsapp_message': '',
      'email_sent': '',
      'created_at': now
    };
    const assignmentEntry = assignHeaders.map(h => assignMap[h] !== undefined ? assignMap[h] : '');
    logSheet.appendRow(assignmentEntry);
    return true;
  } catch (e) {
    Logger.log('Error recording assignment: ' + e.message);
    return false;
  }
}

// === AUTHENTICATION ===
function checkLogin(username, password) {
  try {
    const sheet = getSheet(SHEETS.USERS);
    if (!sheet) {
      return { success: false, message: 'USERS sheet not found. Please run setupSheets() first.' };
    }
    
    const users = sheetToObjects(sheet);
    if (users.length === 0) {
      return { success: false, message: 'No users found. Please run createDemoUsers() first.' };
    }
    
    // Find user with flexible matching
    const user = users.find(u => {
      const usernameMatch = String(u.username || '').trim().toLowerCase() === String(username || '').trim().toLowerCase();
      const passwordMatch = String(u.password || '').trim() === String(password || '').trim();
      const isActive = u.active === true || u.active === 'TRUE' || u.active === 'true' || u.active === 1 || String(u.active).toUpperCase() === 'TRUE';
      return usernameMatch && passwordMatch && isActive;
    });
    
    if (user) {
      return {
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      };
    }
    return { success: false, message: 'Invalid username or password' };
  } catch (e) {
    return { success: false, message: 'Login error: ' + e.message };
  }
}

// === DEBUG FUNCTION (Run this to check users) ===
function testCheckUsers() {
  const sheet = getSheet(SHEETS.USERS);
  if (!sheet) {
    Logger.log('USERS sheet not found!');
    return 'USERS sheet not found!';
  }
  
  const data = sheet.getDataRange().getValues();
  Logger.log('Total rows: ' + data.length);
  Logger.log('Headers: ' + JSON.stringify(data[0]));
  
  if (data.length > 1) {
    Logger.log('First user row: ' + JSON.stringify(data[1]));
    Logger.log('Active value type: ' + typeof data[1][5] + ', value: ' + data[1][5]);
  }
  
  // Test login
  const result = checkLogin('admin', 'admin123');
  Logger.log('Login test result: ' + JSON.stringify(result));
  
  return 'Check Logs for details. Login result: ' + JSON.stringify(result);
}

// === GET ALL USERS BY ROLE ===
function getUsersByRole(role) {
  try {
    const sheet = getSheet(SHEETS.USERS);
    const users = sheetToObjects(sheet);
    return users.filter(u => {
      const isActive = u.active === true || u.active === 'TRUE' || u.active === 'true' || u.active === 1 || String(u.active).toUpperCase() === 'TRUE';
      return u.role === role && isActive;
    }).map(u => ({
      user_id: u.user_id,
      name: u.name,
      username: u.username
    }));
  } catch (e) {
    return [];
  }
}

function getTelecallers() {
  return getUsersByRole('TELECALLER');
}

function getSalesPersons() {
  return getUsersByRole('SALES PERSON');
}

function getSCs() {
  return getUsersByRole('SALES COORDINATOR');
}

// === GET USER NAME BY ID ===
function getUserNameById(userId) {
  try {
    const sheet = getSheet(SHEETS.USERS);
    const users = sheetToObjects(sheet);
    const user = users.find(u => u.user_id === userId);
    return user ? user.name : userId;
  } catch (e) {
    return userId;
  }
}

// === LEAD CREATION ===
function createLead(leadData, creatorId, creatorRole) {
  if (!['TELECALLER', 'SALES COORDINATOR', 'ADMIN'].includes(creatorRole)) {
    return { success: false, message: 'Unauthorized to create leads' };
  }
  
  // Validate required fields
  const required = ['customer_name', 'phone', 'telecaller_id', 'lead_source', 'lead_type'];
  for (const field of required) {
    if (!leadData[field]) {
      return { success: false, message: `Missing required field: ${field}` };
    }
  }
  
  return safeExecute(() => {
    try {
      const sheet = getSheet(SHEETS.LEADS_MASTER);
      const leadId = generateId('LEAD');
      const now = getTimestamp();
      
      const newLead = [
        leadId,                           // lead_id
        leadData.enquiry_date || now.split('T')[0], // enquiry_date
        leadData.lead_source,             // lead_source
        leadData.lead_type,               // lead_type
        leadData.customer_name,           // customer_name
        leadData.phone,                   // phone
        leadData.email || '',             // email
        leadData.company || '',           // company
        leadData.requirement || '',       // requirement
        leadData.telecaller_id,           // telecaller_id
        creatorRole === 'SALES COORDINATOR' ? creatorId : (leadData.sc_id || ''), // sc_id
        '',                               // sales_id
        'TELE',                           // current_stage
        leadData.telecaller_id,           // current_owner
        'NEW',                            // current_status
        '',                               // latest_tele_remark
        '',                               // latest_sc_remark
        '',                               // meeting_mode
        '',                               // meeting_datetime
        now,                              // created_at
        now,                              // updated_at
        '',                               // current_sales_person_id
        '',                               // previous_sales_person_id
        0,                                // sales_followups_count
        'NO',                             // sales_person_changed
        leadData.state                    // state (Column Z)
      ];
      
      sheet.appendRow(newLead);
      
      // Record assignment event: SC/Admin assigns lead to Telecaller
      const scName = getUserNameById(creatorId);
      const teleAssignmentType = 'SC → Telecaller Assignment';
      recordAssignmentEvent(leadId, leadData.telecaller_id, creatorId, teleAssignmentType, now);
      
      return { success: true, lead_id: leadId, message: 'Lead created successfully' };
    } catch (e) {
      return { success: false, message: 'Error creating lead: ' + e.message };
    }
  });
}

// === LIST LEADS BY ROLE ===
// === LIST LEADS BY ROLE (OPTIMIZED with Python Backend) ===
function listLeadsByRole(userId, role, filter) {
  try {
    Logger.log('=== listLeadsByRole START ===');
    Logger.log('userId: [' + userId + '], role: [' + role + '], filter: [' + filter + ']');
    
    // Fetch all leads from sheet (cached)
    const leads = getAllLeadsFromSheet();
    Logger.log('Total leads fetched: ' + leads.length);
    
    // Try to use Python API if configured
    if (PYTHON_API_URL) {
      Logger.log('Using Python API for processing...');
      const pythonResult = callPythonAPI('/process-leads', {
        leads: leads,
        user_id: userId,
        role: role,
        filter_type: filter
      });
      
      if (pythonResult && pythonResult.success) {
        Logger.log('Python API returned ' + pythonResult.count + ' leads');
        return { success: true, leads: pythonResult.leads || [] };
      }
      Logger.log('Python API failed, falling back to local processing');
    }
    
    // FALLBACK: Local Processing (if Python not configured or fails)
    let filtered = [];
    
    switch (role) {
      case 'TELECALLER':
        const myUserId = String(userId || '').trim();
        let teleLeads = leads.filter(l => String(l.telecaller_id || '').trim() === myUserId);
        
        if (filter === 'TODAY') {
          filtered = teleLeads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'TELE');
        } else if (filter === 'FOLLOWUP_DUE') {
          filtered = teleLeads.filter(l => 
            String(l.current_stage || '').trim().toUpperCase() === 'TELE' && 
            String(l.current_status || '').trim().toUpperCase() === 'NOT CONNECTED'
          );
        } else {
          filtered = teleLeads;
        }
        
        filtered = filtered.map(lead => ({
          ...lead,
          meeting_remark: getMeetingRemark(lead.lead_id)
        }));
        break;
        
      case 'SALES COORDINATOR':
        if (filter === 'NOT_QUALIFIED') {
          filtered = leads.filter(l => 
            String(l.current_stage || '').trim().toUpperCase() === 'SC' && 
            String(l.current_status || '').trim().toUpperCase() === 'NOT QUALIFIED'
          );
        } else if (filter === 'JUNK') {
          filtered = leads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'JUNK');
        } else {
          filtered = leads;
        }
        filtered = filtered.map(lead => {
          if (String(lead.current_stage || '').trim().toUpperCase() === 'SALES') {
            const followupCount = getSalesPersonFollowupCount(lead.lead_id, lead.sales_id);
            return {
              ...lead,
              current_sales_person: lead.sales_id,
              followups_done: followupCount,
              followups_remaining: 3 - followupCount,
              can_reassign: followupCount >= 1
            };
          }
          return lead;
        });
        break;
        
      case 'SALES PERSON':
        let salesLeads = leads.filter(l => 
          String(l.current_stage || '').trim().toUpperCase() === 'SALES' && 
          String(l.sales_id || '').trim() === String(userId).trim()
        );
        
        if (filter === 'TODAY') {
          const today = new Date().toISOString().split('T')[0];
          filtered = salesLeads.filter(l => {
            const stage = String(l.current_stage || '').trim().toUpperCase();
            const status = String(l.current_status || '').trim().toUpperCase();
            if (stage === 'WON' || stage === 'CLOSED' || stage === 'JUNK' || status === 'CONVERTED' || status === 'LOST') return false;
            const meetingDate = String(l.meeting_datetime || '').split('T')[0];
            if (meetingDate === today) return true;
            const createdDate = String(l.created_at || '').split('T')[0];
            if (createdDate === today && !l.meeting_datetime) return true;
            return false;
          });
        } else if (filter === 'FOLLOWUP_DUE') {
          const today = new Date().toISOString().split('T')[0];
          filtered = salesLeads.filter(l => {
            const stage = String(l.current_stage || '').trim().toUpperCase();
            const status = String(l.current_status || '').trim().toUpperCase();
            if (stage === 'WON' || stage === 'CLOSED' || stage === 'JUNK' || status === 'CONVERTED' || status === 'LOST') return false;
            const meetingDate = String(l.meeting_datetime || '').split('T')[0];
            const hasFollowUpStatus = (status === 'FOLLOW UP' || status === 'FOLLOW-UP' || status === 'FOLLOWUP' || status === 'RESCHEDULED' || status === 'NOT CONNECTED' || status === 'MEETING DONE' || status === 'VISITED');
            if (hasFollowUpStatus && meetingDate && meetingDate !== today) return true;
            return false;
          });
        } else {
          filtered = salesLeads;
        }
        
        filtered = filtered.map(lead => ({
          ...lead,
          followups_done: getSalesPersonFollowupCount(lead.lead_id, userId),
          followups_remaining: 3 - getSalesPersonFollowupCount(lead.lead_id, userId),
          can_do_followup: getSalesPersonFollowupCount(lead.lead_id, userId) < 3,
          sales_person_changed: lead.sales_person_changed === 'YES',
          meeting_remark: getMeetingRemark(lead.lead_id)
        }));
        break;
        
      case 'ADMIN':
        filtered = leads.map(lead => {
          if (String(lead.current_stage || '').trim().toUpperCase() === 'SALES') {
            const followupCount = getSalesPersonFollowupCount(lead.lead_id, lead.sales_id);
            return {
              ...lead,
              current_sales_person: lead.sales_id,
              followups_done: followupCount,
              followups_remaining: 3 - followupCount,
              can_reassign: followupCount >= 1,
              has_been_reassigned: lead.sales_person_changed === 'YES'
            };
          }
          return lead;
        });
        break;
        
      default:
        return { success: false, message: 'Invalid role' };
    }
    
    // Sort by created_at descending
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });
    
    Logger.log('Returning ' + filtered.length + ' leads');
    return { success: true, leads: filtered };
    
  } catch (e) {
    Logger.log('ERROR in listLeadsByRole: ' + e.message);
    return { success: false, message: 'Error: ' + e.message };
  }
}

// === GET SALES LEADS WITH DATE FILTER ===
function getSalesLeadsWithDateFilter(userId, filter, dateFilter) {
  try {
    const sheet = getSheet(SHEETS.LEADS_MASTER);
    if (!sheet) {
      return { success: false, message: 'LEADS_MASTER sheet not found' };
    }
    
    const leads = sheetToObjects(sheet);
    
    // Filter for SALES PERSON
    let salesLeads = leads.filter(l => 
      String(l.current_stage || '').trim().toUpperCase() === 'SALES' && 
      String(l.sales_id || '').trim() === String(userId).trim()
    );
    
    let filtered = [];
    
    // Apply date filter first (if not ALL)
    if (dateFilter && dateFilter !== 'ALL') {
      salesLeads = salesLeads.filter(l => {
        // Filter by meeting date - this is what matters for sales follow-ups
        const meetingDate = String(l.meeting_datetime || '').split('T')[0];
        return meetingDate === dateFilter;
      });
    }
    
    // Apply filter type (TODAY, FOLLOWUP_DUE, ALL)
    if (filter === 'TODAY') {
      const today = new Date().toISOString().split('T')[0];
      filtered = salesLeads.filter(l => {
        const stage = String(l.current_stage || '').trim().toUpperCase();
        const status = String(l.current_status || '').trim().toUpperCase();
        
        // Exclude WON, CLOSED and JUNK leads
        if (stage === 'WON' || stage === 'CLOSED' || stage === 'JUNK' || status === 'CONVERTED' || status === 'LOST') {
          return false;
        }
        
        const meetingDate = String(l.meeting_datetime || '').split('T')[0];
        if (meetingDate === today) return true;
        
        const createdDate = String(l.created_at || '').split('T')[0];
        if (createdDate === today && !l.meeting_datetime) return true;
        
        return false;
      });
    } else if (filter === 'FOLLOWUP_DUE') {
      const today = new Date().toISOString().split('T')[0];
      filtered = salesLeads.filter(l => {
        const stage = String(l.current_stage || '').trim().toUpperCase();
        const status = String(l.current_status || '').trim().toUpperCase();
        
        // Exclude WON, CLOSED and JUNK
        if (stage === 'WON' || stage === 'CLOSED' || stage === 'JUNK' || status === 'CONVERTED' || status === 'LOST') {
          return false;
        }
        
        const meetingDate = String(l.meeting_datetime || '').split('T')[0];
        const hasFollowUpStatus = (status === 'FOLLOW UP' || status === 'FOLLOW-UP' || status === 'FOLLOWUP' || 
                                   status === 'RESCHEDULED' || status === 'NOT CONNECTED' || 
                                   status === 'MEETING DONE' || status === 'VISITED');
        
        if (hasFollowUpStatus && meetingDate && meetingDate !== today) return true;
        
        return false;
      });
    } else if (filter === 'ALL') {
      filtered = salesLeads;
    } else {
      filtered = salesLeads;
    }
    
    // Enhance with follow-up data
    filtered = filtered.map(lead => {
      const followupCount = getSalesPersonFollowupCount(lead.lead_id, userId);
      return {
        ...lead,
        followups_done: followupCount,
        followups_remaining: 3 - followupCount,
        can_do_followup: followupCount < 3,
        sales_person_changed: lead.sales_person_changed === 'YES',
        meeting_remark: getMeetingRemark(lead.lead_id)
      };
    });
    
    // Sort by meeting_datetime (upcoming first) then by created_at
    filtered.sort((a, b) => {
      const dateA = new Date(a.meeting_datetime || a.created_at || 0);
      const dateB = new Date(b.meeting_datetime || b.created_at || 0);
      return dateB - dateA;
    });
    
    return { success: true, leads: filtered };
  } catch (e) {
    Logger.log('ERROR in getSalesLeadsWithDateFilter: ' + e.message);
    return { success: false, message: 'Error: ' + e.message };
  }
}

// === GET SINGLE LEAD ===
function getLeadById(leadId) {
  try {
    const sheet = getSheet(SHEETS.LEADS_MASTER);
    const leads = sheetToObjects(sheet);
    const lead = leads.find(l => l.lead_id === leadId);
    
    if (lead) {
      return { success: true, lead: lead };
    }
    return { success: false, message: 'Lead not found' };
  } catch (e) {
    return { success: false, message: 'Error fetching lead: ' + e.message };
  }
}

// === GET LEAD HISTORY WITH ASSIGNMENT EVENTS ===
function getLeadHistory(leadId) {
  try {
    const teleSheet = getSheet(SHEETS.TELE_ACTIVITY_LOG);
    const scSheet = getSheet(SHEETS.SC_ACTIVITY_LOG);
    const meetingSheet = getSheet(SHEETS.MEETING_LOG);
    const masterSheet = getSheet(SHEETS.LEADS_MASTER);
    const usersSheet = getSheet(SHEETS.USERS);
    const convertedSheet = getSheet(SHEETS.CONVERTED_LOG);
    
    // Get user map for name lookups
    const users = sheetToObjects(usersSheet);
    const userMap = {};
    users.forEach(u => {
      userMap[u.user_id] = { name: u.name, role: u.role };
    });
    
    // Get lead details
    const leads = sheetToObjects(masterSheet);
    const lead = leads.find(l => l.lead_id === leadId);
    
    // Add creator info from sc_id (SC or Admin who created the lead)
    if (lead && lead.sc_id) {
      lead.created_by = lead.sc_id;
    }
    
    const teleHistory = sheetToObjects(teleSheet).filter(l => l.lead_id === leadId);
    const scHistory = sheetToObjects(scSheet).filter(l => l.lead_id === leadId);
    const meetingHistory = sheetToObjects(meetingSheet).filter(l => l.lead_id === leadId);
    
    // Get converted deal details if exists
    let convertedDetails = null;
    if (convertedSheet) {
      const convertedData = sheetToObjects(convertedSheet).filter(c => c.lead_id === leadId);
      if (convertedData.length > 0) {
        // Get the latest converted entry (in case of multiple)
        convertedDetails = convertedData.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
      }
    }
    
    // Enhance with user info
    teleHistory.forEach(h => {
      h.telecaller_name = userMap[h.telecaller_id] ? userMap[h.telecaller_id].name : h.telecaller_id;
      h.telecaller_role = 'TELECALLER';
    });
    
    scHistory.forEach(h => {
      h.sc_name = userMap[h.sc_id] ? userMap[h.sc_id].name : h.sc_id;
      h.sc_role = 'SALES COORDINATOR';
    });
    
    meetingHistory.forEach(h => {
      h.sales_person_name = userMap[h.sales_id] ? userMap[h.sales_id].name : h.sales_id;
      h.scheduled_by_name = userMap[h.scheduled_by] ? userMap[h.scheduled_by].name : h.scheduled_by;
      h.scheduled_by_role = userMap[h.scheduled_by] ? userMap[h.scheduled_by].role : 'USER';
      h.sales_person_role = 'SALES PERSON';
    });
    
    return {
      success: true,
      history: {
        telecaller: teleHistory,
        sc: scHistory,
        meetings: meetingHistory
      },
      userMap: userMap,
      lead: lead || { lead_id: leadId },
      convertedDetails: convertedDetails
    };
  } catch (e) {
    return { success: false, message: 'Error fetching history: ' + e.message };
  }
}

// === SAVE TELECALLER ACTION ===
function saveTeleAction(actionData, telecallerId) {
  // Validate required fields based on action
  if (!actionData.lead_id || !actionData.action) {
    return { success: false, message: 'Missing required fields' };
  }
  
  if (actionData.action === 'NOT CONNECTED') {
    if (!actionData.followup_datetime || !actionData.remark) {
      return { success: false, message: 'Follow-up date and remark are required for NOT CONNECTED' };
    }
    
    // Validate follow-up date is next working day
    if (!isValidFollowupDate(actionData.followup_datetime)) {
      const nextWorking = getNextWorkingDay();
      return { success: false, message: 'Follow-up date must be ' + nextWorking + ' (next working day only)' };
    }
    
    // Validate at least one activity is selected
    const hasActivity = actionData.phone_call === 'YES' || 
                       actionData.whatsapp_call === 'YES' || 
                       actionData.whatsapp_message === 'YES' || 
                       actionData.email_sent === 'YES';
    
    if (!hasActivity) {
      return { success: false, message: 'Please select at least one activity performed' };
    }
  }
  
  if (actionData.action === 'NOT QUALIFIED') {
    if (!actionData.remark) {
      return { success: false, message: 'Remark is required for NOT QUALIFIED' };
    }
  }

  if (actionData.action === 'NOT PICKED') {
    if (!actionData.remark) {
      return { success: false, message: 'Remark is required for NOT PICKED' };
    }
  }
  
  return safeExecute(() => {
    try {
      const logSheet = getSheet(SHEETS.TELE_ACTIVITY_LOG);
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const now = getTimestamp();
      const logId = generateId('TELE_LOG');
      
      // Save to TELE_ACTIVITY_LOG (header-aware to handle column order)
      const teleHeaders = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
      const teleMap = {
        'log_id': logId,
        'lead_id': actionData.lead_id,
        'telecaller_id': telecallerId,
        'action': actionData.action,
        'remark': actionData.remark || '',
        'followup_datetime': actionData.followup_datetime || '',
        'tele_plan_time': actionData.tele_plan_time || '',
        'tele_actual_time': now,
        'phone_call': actionData.phone_call || 'NO',
        'whatsapp_call': actionData.whatsapp_call || 'NO',
        'whatsapp_message': actionData.whatsapp_message || 'NO',
        'email_sent': actionData.email_sent || 'NO',
        'created_at': now
      };
      const logEntry = teleHeaders.map(h => teleMap[h] !== undefined ? teleMap[h] : '');
      logSheet.appendRow(logEntry);
      
      // Update LEADS_MASTER
      const updates = {
        current_status: actionData.action,
        latest_tele_remark: actionData.remark || '',
        updated_at: now
      };
      
      if (actionData.action === 'NOT QUALIFIED') {
        updates.current_stage = 'SC';
        updates.current_owner = ''; // Will be picked by SC
      } else if (actionData.action === 'NOT PICKED') {
        updates.current_stage = 'CLOSED';
        updates.current_owner = ''; // Lead is closed
      } else if (actionData.action === 'QUALIFIED') {
        // Stage will be updated after meeting is scheduled
        updates.current_status = 'QUALIFIED';
      }
      
      updateRowByLeadId(masterSheet, actionData.lead_id, updates);
      
      return { 
        success: true, 
        message: 'Action saved successfully',
        action: actionData.action,
        requiresMeeting: actionData.action === 'QUALIFIED'
      };
    } catch (e) {
      return { success: false, message: 'Error saving action: ' + e.message };
    }
  });
}

// === SAVE FIRST MEETING (By Telecaller after QUALIFIED) ===
function saveFirstMeeting(meetingData, scheduledBy) {
  // Validate required fields
  const required = ['lead_id', 'sales_id', 'meeting_mode', 'meeting_datetime'];
  for (const field of required) {
    if (!meetingData[field]) {
      return { success: false, message: `Missing required field: ${field}` };
    }
  }
  
  return safeExecute(() => {
    try {
      const meetingSheet = getSheet(SHEETS.MEETING_LOG);
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const now = getTimestamp();
      const logId = generateId('MTG');
      
      // Save to MEETING_LOG
      const meetingEntry = [
        logId,                              // log_id
        meetingData.lead_id,                // lead_id
        scheduledBy,                        // scheduled_by
        meetingData.sales_id,               // sales_id
        meetingData.meeting_mode,           // meeting_mode
        meetingData.meeting_datetime,       // meeting_datetime
        meetingData.meeting_remark || '',   // meeting_remark
        'SCHEDULED',                        // meeting_status
        now                                 // created_at
      ];
      meetingSheet.appendRow(meetingEntry);
      
      // Update LEADS_MASTER - Initialize sales person tracking
      const updates = {
        current_stage: 'SALES',
        current_owner: meetingData.sales_id,
        sales_id: meetingData.sales_id,
        current_sales_person_id: meetingData.sales_id,
        previous_sales_person_id: '',
        sales_followups_count: 0,
        sales_person_changed: 'NO',
        meeting_mode: meetingData.meeting_mode,
        meeting_datetime: meetingData.meeting_datetime,
        current_status: 'MEETING SCHEDULED',
        updated_at: now
      };
      
      updateRowByLeadId(masterSheet, meetingData.lead_id, updates);
      
      // Record assignment event: Telecaller assigns lead to Sales Person
      const teleAssignmentType = 'Telecaller → Sales Person Assignment';
      recordAssignmentEvent(meetingData.lead_id, meetingData.sales_id, scheduledBy, teleAssignmentType, now);
      
      return { success: true, message: 'Meeting scheduled successfully' };
    } catch (e) {
      return { success: false, message: 'Error scheduling meeting: ' + e.message };
    }
  });
}

// === SAVE SC VERIFICATION ===
function saveSCVerification(verificationData, scId) {
  // Validate required fields
  if (!verificationData.lead_id || !verificationData.sc_decision) {
    return { success: false, message: 'Missing required fields' };
  }
  
  if (!verificationData.sc_remark) {
    return { success: false, message: 'SC Remark is required' };
  }
  
  if (verificationData.sc_decision === 'QUALIFIED') {
    if (!verificationData.sales_id || !verificationData.meeting_mode || !verificationData.meeting_datetime) {
      return { success: false, message: 'Sales Person, Meeting Mode and DateTime are required for QUALIFIED' };
    }
  }
  
  return safeExecute(() => {
    try {
      const scSheet = getSheet(SHEETS.SC_ACTIVITY_LOG);
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const meetingSheet = getSheet(SHEETS.MEETING_LOG);
      const now = getTimestamp();
      const logId = generateId('SC_LOG');
      
      // Save to SC_ACTIVITY_LOG
      const logEntry = [
        logId,                              // log_id
        verificationData.lead_id,           // lead_id
        scId,                               // sc_id
        verificationData.sc_decision,       // sc_decision
        verificationData.sc_remark,         // sc_remark
        verificationData.sc_plan_time || '',// sc_plan_time
        now,                                // sc_actual_time
        now                                 // created_at
      ];
      scSheet.appendRow(logEntry);
      
      // Update LEADS_MASTER based on decision
      const updates = {
        latest_sc_remark: verificationData.sc_remark,
        sc_id: scId,
        updated_at: now
      };
      
      if (verificationData.sc_decision === 'QUALIFIED') {
        // SC qualifies -> Goes back to Telecaller for meeting scheduling
        updates.current_stage = 'TELE';
        updates.current_status = 'SC QUALIFIED';
        updates.current_owner = ''; // Get original telecaller
        
        // Get original telecaller_id
        const leadResult = getLeadById(verificationData.lead_id);
        if (leadResult.success) {
          updates.current_owner = leadResult.lead.telecaller_id;
        }
        
        // Also create a meeting entry if SC provides meeting details
        const meetingEntry = [
          generateId('MTG'),                    // log_id
          verificationData.lead_id,             // lead_id
          scId,                                 // scheduled_by
          verificationData.sales_id,            // sales_id
          verificationData.meeting_mode,        // meeting_mode
          verificationData.meeting_datetime,    // meeting_datetime
          verificationData.sc_remark,           // meeting_remark
          'SCHEDULED',                          // meeting_status
          now                                   // created_at
        ];
        meetingSheet.appendRow(meetingEntry);
        
        updates.sales_id = verificationData.sales_id;
        updates.meeting_mode = verificationData.meeting_mode;
        updates.meeting_datetime = verificationData.meeting_datetime;
        updates.current_stage = 'SALES';
        updates.current_owner = verificationData.sales_id;
        updates.current_status = 'MEETING SCHEDULED';
        
      } else if (verificationData.sc_decision === 'NOT QUALIFIED') {
        updates.current_stage = 'CLOSED';
        updates.current_status = 'SC DISQUALIFIED';
        updates.current_owner = '';
      }
      
      updateRowByLeadId(masterSheet, verificationData.lead_id, updates);
      
      return { success: true, message: 'SC Verification saved successfully' };
    } catch (e) {
      return { success: false, message: 'Error saving verification: ' + e.message };
    }
  });
}

// === MOVE LEAD TO JUNK (SC Action) ===
function moveLeadToJunk(leadId, scRemark, scId) {
  // Validate required fields
  if (!leadId || !scRemark || !scId) {
    return { success: false, message: 'Missing required fields' };
  }
  
  return safeExecute(() => {
    try {
      const scSheet = getSheet(SHEETS.SC_ACTIVITY_LOG);
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const now = getTimestamp();
      const logId = generateId('SC_LOG');
      
      // Save to SC_ACTIVITY_LOG
      const logEntry = [
        logId,                              // log_id
        leadId,                             // lead_id
        scId,                               // sc_id
        'JUNK',                             // sc_decision
        scRemark,                           // sc_remark
        '',                                 // sc_plan_time
        now,                                // sc_actual_time
        now                                 // created_at
      ];
      scSheet.appendRow(logEntry);
      
      // Update LEADS_MASTER
      const updates = {
        latest_sc_remark: scRemark,
        sc_id: scId,
        current_stage: 'JUNK',
        current_status: 'JUNK',
        current_owner: '',
        updated_at: now
      };
      
      updateRowByLeadId(masterSheet, leadId, updates);
      
      return { success: true, message: 'Lead moved to Junk successfully' };
    } catch (e) {
      return { success: false, message: 'Error moving lead to Junk: ' + e.message };
    }
  });
}

// === SAVE SALES MEETING UPDATE ===
function saveSalesMeeting(meetingData, salesId) {
  // Validate required fields
  if (!meetingData.lead_id || !meetingData.meeting_status) {
    return { success: false, message: 'Missing required fields' };
  }
  
  return safeExecute(() => {
    try {
      const meetingSheet = getSheet(SHEETS.MEETING_LOG);
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const now = getTimestamp();
      const logId = generateId('MTG');
      
      // Check follow-up count if sales person is doing a follow-up
      // NOT CONNECTED does NOT count as a follow-up
      const isFollowup = meetingData.meeting_status !== 'NOT CONNECTED' && 
                         ['MEETING DONE', 'VISITED', 'FOLLOWUP', 'FOLLOW UP', 'COMPLETED', 'RESCHEDULED'].includes(meetingData.meeting_status);
      
      if (isFollowup) {
        const followupCount = getSalesPersonFollowupCount(meetingData.lead_id, salesId);
        if (followupCount >= 3) {
          return { 
            success: false, 
            message: 'Cannot add more follow-ups. Sales person has reached the maximum limit of 3 follow-ups for this lead. SC/Admin must reassign to another sales person.' 
          };
        }
      }
      
      // Save new meeting log entry
      const meetingEntry = [
        logId,                                  // log_id
        meetingData.lead_id,                    // lead_id
        salesId,                                // scheduled_by
        salesId,                                // sales_id
        meetingData.meeting_mode || '',         // meeting_mode
        meetingData.next_followup || '',        // meeting_datetime (next followup)
        meetingData.meeting_notes || '',        // meeting_remark
        meetingData.meeting_status,             // meeting_status
        now                                     // created_at
      ];
      meetingSheet.appendRow(meetingEntry);
      
      // If CONVERTED with deal details, save to CONVERTED_LOG
      if (meetingData.meeting_status === 'CONVERTED' && meetingData.converted_data) {
        try {
          const convertedSheet = getSheet(SHEETS.CONVERTED_LOG);
          if (!convertedSheet) {
            Logger.log('ERROR: CONVERTED_LOG sheet not found! Please create this sheet with headers: lead_id, status, remark, product, qty, per_mt_price, created_at');
            return { success: false, message: 'CONVERTED_LOG sheet not found. Please contact admin to create this sheet.' };
          }
          
          const convertedEntry = [
            meetingData.converted_data.lead_id,      // lead_id (A)
            meetingData.converted_data.status,       // status (B)
            meetingData.converted_data.remark || '', // remark (C)
            meetingData.converted_data.product,      // product (D)
            meetingData.converted_data.qty,          // qty (E)
            meetingData.converted_data.per_mt_price, // per_mt_price (F)
            now                                      // created_at (G)
          ];
          
          Logger.log('Saving to CONVERTED_LOG: ' + JSON.stringify(convertedEntry));
          convertedSheet.appendRow(convertedEntry);
          Logger.log('Successfully saved deal details to CONVERTED_LOG');
          
        } catch (convertError) {
          Logger.log('Error saving to CONVERTED_LOG: ' + convertError.message);
          return { success: false, message: 'Error saving deal details: ' + convertError.message };
        }
      }
      
      // Update LEADS_MASTER
      const updates = {
        current_status: meetingData.meeting_status,
        current_stage: 'SALES', // Keep in SALES stage unless explicitly converted/lost
        updated_at: now
      };
      
      // Increment follow-up count if this is a follow-up action
      if (isFollowup) {
        // Get the count AFTER appending the new entry
        const updatedCount = getSalesPersonFollowupCount(meetingData.lead_id, salesId);
        updates.sales_followups_count = updatedCount;
        Logger.log('Follow-up count updated: ' + updatedCount + ' for lead ' + meetingData.lead_id + ' and sales person ' + salesId);
      }
      
      if (meetingData.next_followup) {
        updates.meeting_datetime = meetingData.next_followup;
      }
      
      if (meetingData.meeting_status === 'CONVERTED') {
        updates.current_stage = 'WON';
      } else if (meetingData.meeting_status === 'LOST') {
        updates.current_stage = 'CLOSED';
      }
      
      updateRowByLeadId(masterSheet, meetingData.lead_id, updates);
      
      return { success: true, message: 'Meeting update saved successfully' };
    } catch (e) {
      return { success: false, message: 'Error saving meeting update: ' + e.message };
    }
  });
}

// === GET MEETING REMARK FOR A LEAD (Latest SCHEDULED meeting) ===
function getMeetingRemark(leadId) {
  try {
    const meetingSheet = getSheet(SHEETS.MEETING_LOG);
    if (!meetingSheet) return '';
    
    const meetings = sheetToObjects(meetingSheet);
    // Get the latest SCHEDULED meeting for this lead
    const scheduledMeetings = meetings.filter(m => 
      m.lead_id === leadId && 
      String(m.meeting_status || '').trim().toUpperCase() === 'SCHEDULED'
    );
    
    if (scheduledMeetings.length === 0) return '';
    
    // Sort by created_at descending (latest first)
    scheduledMeetings.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    
    return scheduledMeetings[0].meeting_remark || '';
  } catch (e) {
    return '';
  }
}

// === COUNT SALES PERSON FOLLOW-UPS FOR A LEAD ===
// Only counts follow-ups AFTER the last reassignment to this sales person
function getSalesPersonFollowupCount(leadId, salesPersonId) {
  try {
    const meetingSheet = getSheet(SHEETS.MEETING_LOG);
    const meetingHistory = sheetToObjects(meetingSheet);
    
    // Find the latest REASSIGNED entry for this lead where new sales person = salesPersonId
    // This marks the point after which we should start counting
    let lastReassignDate = null;
    meetingHistory.forEach(m => {
      if (m.lead_id === leadId && 
          String(m.meeting_status || '').trim().toUpperCase() === 'REASSIGNED' &&
          m.sales_id === salesPersonId) {
        const entryDate = new Date(m.created_at || 0);
        if (!lastReassignDate || entryDate > lastReassignDate) {
          lastReassignDate = entryDate;
        }
      }
    });
    
    // Count follow-up entries AFTER the last reassignment (or all if never reassigned)
    const followups = meetingHistory.filter(m => {
      if (m.lead_id !== leadId || m.sales_id !== salesPersonId) return false;
      
      const status = String(m.meeting_status || '').trim().toUpperCase();
      if (status === 'NOT CONNECTED' || status === 'REASSIGNED' || status === 'SCHEDULED') return false;
      
      const isFollowupStatus = (status === 'MEETING DONE' || status === 'VISITED' || 
                                 status === 'FOLLOWUP' || status === 'FOLLOW UP' || 
                                 status === 'COMPLETED' || status === 'RESCHEDULED');
      if (!isFollowupStatus) return false;
      
      // If there was a reassignment, only count entries AFTER it
      if (lastReassignDate) {
        const entryDate = new Date(m.created_at || 0);
        return entryDate > lastReassignDate;
      }
      
      return true;
    });
    
    return followups.length;
  } catch (e) {
    Logger.log('Error counting follow-ups: ' + e.message);
    return 0;
  }
}

// === REASSIGN LEAD TO DIFFERENT SALES PERSON (SC/Admin Only) ===
function reassignLeadToSalesPerson(leadId, newSalesPersonId, reassignedBy, reassignedByRole) {
  // Only SC and ADMIN can reassign
  if (!['SALES COORDINATOR', 'ADMIN'].includes(reassignedByRole)) {
    return { success: false, message: 'Unauthorized to reassign leads' };
  }
  
  return safeExecute(() => {
    try {
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const meetingSheet = getSheet(SHEETS.MEETING_LOG);
      const now = getTimestamp();
      
      // Get current lead
      const leadResult = getLeadById(leadId);
      if (!leadResult.success) {
        return { success: false, message: 'Lead not found' };
      }
      
      const lead = leadResult.lead;
      const previousSalesPersonId = lead.sales_id || '';
      
      // SC/Admin can reassign anytime - no follow-up check required
      
      // Update LEADS_MASTER with new sales person
      const updates = {
        sales_id: newSalesPersonId,
        current_sales_person_id: newSalesPersonId,
        previous_sales_person_id: previousSalesPersonId,
        sales_followups_count: 0, // Reset count for new sales person
        sales_person_changed: 'YES',
        current_owner: newSalesPersonId,
        current_stage: 'SALES', // Ensure lead is in SALES stage for new person to see it
        updated_at: now
      };
      
      updateRowByLeadId(masterSheet, leadId, updates);
      
      // Create a reassignment entry in MEETING_LOG for history
      const reassignmentEntry = [
        generateId('REASSIGN'),              // log_id
        leadId,                              // lead_id
        reassignedBy,                        // scheduled_by (who reassigned)
        newSalesPersonId,                    // sales_id (new sales person)
        '',                                  // meeting_mode
        '',                                  // meeting_datetime
        'Reassigned from ' + getUserNameById(previousSalesPersonId) + ' to ' + getUserNameById(newSalesPersonId), // meeting_remark
        'REASSIGNED',                        // meeting_status (special status for reassignment)
        now                                  // created_at
      ];
      meetingSheet.appendRow(reassignmentEntry);
      
      // Record assignment event
      const assignmentType = 'SC/Admin → Sales Person Reassignment';
      recordAssignmentEvent(leadId, newSalesPersonId, reassignedBy, assignmentType, now);
      
      return { 
        success: true, 
        message: 'Lead successfully reassigned',
        previous_sales_person: previousSalesPersonId,
        new_sales_person: newSalesPersonId
      };
    } catch (e) {
      return { success: false, message: 'Error reassigning lead: ' + e.message };
    }
  });
}

// === REASSIGN LEAD TO SALES PERSON WITH FOLLOW-UP DATE ===
function reassignLeadToSalesPersonWithFollowup(reassignData) {
  // Only SC and ADMIN can reassign
  if (!['SALES COORDINATOR', 'ADMIN'].includes(reassignData.reassignedByRole)) {
    return { success: false, message: 'Unauthorized to reassign leads' };
  }
  
  return safeExecute(() => {
    try {
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const meetingSheet = getSheet(SHEETS.MEETING_LOG);
      const now = getTimestamp();
      
      // Get current lead
      const leadResult = getLeadById(reassignData.leadId);
      if (!leadResult.success) {
        return { success: false, message: 'Lead not found' };
      }
      
      const lead = leadResult.lead;
      const previousSalesPersonId = lead.sales_id || '';
      
      // Update LEADS_MASTER with new sales person and follow-up date
      const updates = {
        sales_id: reassignData.newSalesPersonId,
        current_sales_person_id: reassignData.newSalesPersonId,
        previous_sales_person_id: previousSalesPersonId,
        sales_followups_count: 0, // Reset count for new sales person
        sales_person_changed: 'YES',
        current_owner: reassignData.newSalesPersonId,
        current_stage: 'SALES', // Ensure lead is in SALES stage for new person to see it
        meeting_datetime: reassignData.followupDate, // Set follow-up date
        updated_at: now
      };
      
      updateRowByLeadId(masterSheet, reassignData.leadId, updates);
      
      // Create a reassignment entry in MEETING_LOG for history
      const reassignmentRemark = 'Reassigned from ' + getUserNameById(previousSalesPersonId) + ' to ' + getUserNameById(reassignData.newSalesPersonId) + 
                                 '. Reason: ' + reassignData.reason + 
                                 '. Follow-up scheduled for: ' + new Date(reassignData.followupDate).toLocaleString('en-IN');
      
      const reassignmentEntry = [
        generateId('REASSIGN'),              // log_id
        reassignData.leadId,                 // lead_id
        reassignData.reassignedBy,           // scheduled_by (who reassigned)
        reassignData.newSalesPersonId,       // sales_id (new sales person)
        '',                                  // meeting_mode
        reassignData.followupDate,           // meeting_datetime (follow-up date set by SC)
        reassignmentRemark,                  // meeting_remark
        'REASSIGNED_WITH_FOLLOWUP',          // meeting_status (special status for reassignment with followup)
        now                                  // created_at
      ];
      meetingSheet.appendRow(reassignmentEntry);
      
      // Record assignment event
      const assignmentType = 'SC/Admin → Sales Person Reassignment with Follow-up';
      recordAssignmentEvent(reassignData.leadId, reassignData.newSalesPersonId, reassignData.reassignedBy, assignmentType, now);
      
      return { 
        success: true, 
        message: 'Lead successfully reassigned with follow-up date set',
        previous_sales_person: previousSalesPersonId,
        new_sales_person: reassignData.newSalesPersonId,
        followup_date: reassignData.followupDate
      };
    } catch (e) {
      return { success: false, message: 'Error reassigning lead: ' + e.message };
    }
  });
}

// === GET SALES PERSON FOLLOW-UP DATA FOR A LEAD ===
function getSalesPersonFollowupData(leadId) {
  try {
    const masterSheet = getSheet(SHEETS.LEADS_MASTER);
    const meetingSheet = getSheet(SHEETS.MEETING_LOG);
    const usersSheet = getSheet(SHEETS.USERS);
    
    const leads = sheetToObjects(masterSheet);
    const lead = leads.find(l => l.lead_id === leadId);
    
    if (!lead) {
      return { success: false, message: 'Lead not found' };
    }
    
    const currentSalesPersonId = lead.sales_id || lead.current_sales_person_id;
    const previousSalesPersonId = lead.previous_sales_person_id || '';
    const salesPersonChanged = lead.sales_person_changed === 'YES';
    
    // Count follow-ups by current sales person
    const followupCount = getSalesPersonFollowupCount(leadId, currentSalesPersonId);
    const remainingFollowups = 3 - followupCount;
    
    // Get meeting history for this lead
    const meetingHistory = sheetToObjects(meetingSheet).filter(m => m.lead_id === leadId);
    
    return {
      success: true,
      lead_id: leadId,
      current_sales_person: currentSalesPersonId,
      current_sales_person_name: getUserNameById(currentSalesPersonId),
      previous_sales_person: previousSalesPersonId,
      previous_sales_person_name: previousSalesPersonId ? getUserNameById(previousSalesPersonId) : '',
      previous_sales_person_changed: salesPersonChanged,
      followups_done: followupCount,
      followups_remaining: remainingFollowups,
      followups_limit: 3,
      can_do_followup: remainingFollowups > 0,
      meeting_history: meetingHistory
    };
  } catch (e) {
    return { success: false, message: 'Error fetching follow-up data: ' + e.message };
  }
}

// === GET ALL LEADS FOR SALES PERSON (Current AND Previous) ===
function getAllLeadsForSalesPerson(salesPersonId) {
  try {
    const masterSheet = getSheet(SHEETS.LEADS_MASTER);
    const meetingSheet = getSheet(SHEETS.MEETING_LOG);
    const leads = sheetToObjects(masterSheet);
    const meetings = sheetToObjects(meetingSheet);
    
    // Find all leads where sales person is current owner
    const currentLeads = leads.filter(l => l.sales_id === salesPersonId && String(l.current_stage || '').toUpperCase() === 'SALES');
    
    // Find all leads where sales person was previously assigned
    const previousLeads = leads.filter(l => l.previous_sales_person_id === salesPersonId);
    
    // Combine and mark as current/previous
    const result = [];
    
    currentLeads.forEach(lead => {
      const followups = getSalesPersonFollowupCount(lead.lead_id, salesPersonId);
      result.push({
        ...lead,
        assignment_type: 'CURRENT',
        can_edit: true,
        followups_done: followups,
        followups_remaining: 3 - followups
      });
    });
    
    previousLeads.forEach(lead => {
      const followups = getSalesPersonFollowupCount(lead.lead_id, salesPersonId);
      result.push({
        ...lead,
        assignment_type: 'PREVIOUS',
        can_edit: false,
        followups_done: followups,
        current_sales_person: lead.sales_id,
        note: 'Reassigned to ' + getUserNameById(lead.sales_id) + '. You can view but not edit.'
      });
    });
    
    // Sort by created_at in descending order (newest first)
    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });
    
    return { success: true, leads: result };
  } catch (e) {
    return { success: false, message: 'Error fetching sales person leads: ' + e.message };
  }
}

// === GET LEAD REASSIGNMENT HISTORY (SC/Admin) ===
function getLeadReassignmentHistory(leadId) {
  try {
    const masterSheet = getSheet(SHEETS.LEADS_MASTER);
    const meetingSheet = getSheet(SHEETS.MEETING_LOG);
    const usersSheet = getSheet(SHEETS.USERS);
    
    const leads = sheetToObjects(masterSheet);
    const lead = leads.find(l => l.lead_id === leadId);
    
    if (!lead) {
      return { success: false, message: 'Lead not found' };
    }
    
    const meetings = sheetToObjects(meetingSheet);
    
    // Get all reassignment entries for this lead
    const reassignments = meetings.filter(m => 
      m.lead_id === leadId && 
      m.meeting_status === 'REASSIGNED'
    );
    
    // Get user info
    const users = sheetToObjects(usersSheet);
    const userMap = {};
    users.forEach(u => {
      userMap[u.user_id] = { name: u.name, role: u.role };
    });
    
    // Enhance reassignment entries with user info
    const enhancedReassignments = reassignments.map(r => ({
      date: r.created_at || '',
      reassigned_by: r.scheduled_by,
      reassigned_by_name: userMap[r.scheduled_by] ? userMap[r.scheduled_by].name : r.scheduled_by,
      new_sales_person: r.sales_id,
      new_sales_person_name: userMap[r.sales_id] ? userMap[r.sales_id].name : r.sales_id,
      details: r.meeting_remark || 'Reassignment'
    }));
    
    return {
      success: true,
      lead_id: leadId,
      current_sales_person: lead.sales_id,
      current_sales_person_name: getUserNameById(lead.sales_id),
      has_been_reassigned: lead.sales_person_changed === 'YES',
      reassignment_history: enhancedReassignments
    };
  } catch (e) {
    return { success: false, message: 'Error fetching reassignment history: ' + e.message };
  }
}

// === DAILY DASHBOARD DATA (Date-filtered for Telecaller & Sales Person) ===
// === DAILY DASHBOARD DATA (OPTIMIZED with Python Backend) ===
function getDailyDashboardData(userId, role, dateStr) {
  try {
    // Fetch all required data from sheets (cached)
    const leads = getAllLeadsFromSheet();
    const teleLog = getTeleActivityLog();
    const meetingLog = getMeetingLog();
    const users = getAllUsersFromSheet();
    
    // Try to use Python API if configured
    if (PYTHON_API_URL) {
      Logger.log('Using Python API for daily dashboard...');
      const pythonResult = callPythonAPI('/daily-dashboard', {
        leads: leads,
        tele_activity_log: teleLog,
        meeting_log: meetingLog,
        user_id: userId,
        role: role,
        date_str: dateStr,
        users: users
      });
      
      if (pythonResult && pythonResult.success) {
        Logger.log('Python API returned daily stats');
        return pythonResult;
      }
      Logger.log('Python API failed, falling back to local processing');
    }
    
    // FALLBACK: Local Processing
    const leadsMap = {};
    leads.forEach(l => { leadsMap[l.lead_id] = l; });
    
    if (role === 'TELECALLER') {
      const myUserId = String(userId || '').trim();
      const filteredLog = teleLog.filter(l =>
        String(l.telecaller_id || '').trim() === myUserId &&
        l.action !== 'ASSIGNMENT' &&
        String(l.tele_actual_time || l.created_at || '').split('T')[0] === dateStr
      );
      
      const meetingsScheduled = meetingLog.filter(m =>
        String(m.scheduled_by || '').trim() === myUserId &&
        String(m.meeting_status || '').trim().toUpperCase() === 'SCHEDULED' &&
        String(m.created_at || '').split('T')[0] === dateStr
      );
      
      let qualified = 0, not_connected = 0, not_qualified = 0, not_picked = 0;
      filteredLog.forEach(e => {
        const a = String(e.action || '').trim().toUpperCase();
        if (a === 'QUALIFIED') qualified++;
        else if (a === 'NOT CONNECTED') not_connected++;
        else if (a === 'NOT QUALIFIED') not_qualified++;
        else if (a === 'NOT PICKED') not_picked++;
      });
      
      const latestByLead = {};
      filteredLog.forEach(e => {
        const lid = e.lead_id;
        const eTime = new Date(e.tele_actual_time || e.created_at || 0).getTime();
        if (!latestByLead[lid] || eTime > new Date(latestByLead[lid].tele_actual_time || latestByLead[lid].created_at || 0).getTime()) {
          latestByLead[lid] = e;
        }
      });
      const uniqueTeleLog = Object.values(latestByLead);
      
      const activities = uniqueTeleLog.map(e => {
        const lead = leadsMap[e.lead_id] || {};
        return {
          time: e.tele_actual_time || e.created_at,
          lead_id: e.lead_id,
          customer_name: lead.customer_name || '',
          phone: lead.phone || '',
          company: lead.company || '',
          action: e.action,
          remark: e.remark || '',
          phone_call: e.phone_call,
          whatsapp_call: e.whatsapp_call,
          whatsapp_message: e.whatsapp_message,
          email_sent: e.email_sent
        };
      });
      
      return {
        success: true,
        role: 'TELECALLER',
        date: dateStr,
        stats: { 
          total: uniqueTeleLog.length, 
          qualified: qualified, 
          not_connected: not_connected, 
          not_qualified: not_qualified, 
          not_picked: not_picked, 
          meetings_scheduled: meetingsScheduled.length 
        },
        activities: activities
      };
      
    } else if (role === 'SALES PERSON') {
      const myUserId = String(userId || '').trim();
      // For Sales Person, filter by meeting_datetime (scheduled date), not created_at
      const filteredMeetings = meetingLog.filter(m =>
        String(m.sales_id || '').trim() === myUserId &&
        String(m.meeting_datetime || m.created_at || '').split('T')[0] === dateStr &&
        String(m.meeting_status || '').trim().toUpperCase() !== 'REASSIGNED'
      );
      
      Logger.log('SALES PERSON ' + myUserId + ' meetings for ' + dateStr + ': ' + filteredMeetings.length);
      
      let scheduled = 0, meeting_done = 0, follow_up = 0, converted = 0, lost = 0, no_show = 0;
      filteredMeetings.forEach(m => {
        const s = String(m.meeting_status || '').trim().toUpperCase();
        if (s === 'SCHEDULED') scheduled++;
        else if (s === 'MEETING DONE' || s === 'VISITED') meeting_done++;
        else if (s === 'FOLLOW UP' || s === 'FOLLOWUP' || s === 'RESCHEDULED') follow_up++;
        else if (s === 'CONVERTED' || s === 'COMPLETED') converted++;
        else if (s === 'LOST') lost++;
        else if (s === 'NOT CONNECTED') no_show++;
      });
      
      const latestByLead = {};
      filteredMeetings.forEach(m => {
        const lid = m.lead_id;
        const mTime = new Date(m.meeting_datetime || m.created_at || 0).getTime();
        if (!latestByLead[lid] || mTime > new Date(latestByLead[lid].meeting_datetime || latestByLead[lid].created_at || 0).getTime()) {
          latestByLead[lid] = m;
        }
      });
      const uniqueMeetings = Object.values(latestByLead);
      
      const activities = uniqueMeetings.map(m => {
        const lead = leadsMap[m.lead_id] || {};
        return {
          time: m.meeting_datetime || m.created_at,
          lead_id: m.lead_id,
          customer_name: lead.customer_name || '',
          phone: lead.phone || '',
          company: lead.company || '',
          meeting_mode: m.meeting_mode || '',
          status: m.meeting_status,
          remark: m.meeting_remark || ''
        };
      });
      
      return {
        success: true,
        role: 'SALES PERSON',
        date: dateStr,
        stats: { 
          total: uniqueMeetings.length, 
          scheduled: scheduled, 
          meeting_done: meeting_done, 
          follow_up: follow_up, 
          converted: converted, 
          lost: lost, 
          no_show: no_show 
        },
        activities: activities
      };
    }
    
    return { success: false, message: 'Not available for this role' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.message };
  }
}

// === DASHBOARD STATS ===
// === DASHBOARD STATS (OPTIMIZED with Python Backend) ===
function getDashboardStats(userId, role) {
  try {
    // Fetch cached leads
    const leads = getAllLeadsFromSheet();
    
    // Try to use Python API if configured
    if (PYTHON_API_URL) {
      Logger.log('Using Python API for dashboard stats...');
      const pythonResult = callPythonAPI('/dashboard-stats', {
        leads: leads,
        user_id: userId,
        role: role
      });
      
      if (pythonResult && pythonResult.success) {
        Logger.log('Python API returned stats');
        return { success: true, stats: pythonResult.stats || {} };
      }
      Logger.log('Python API failed, falling back to local processing');
    }
    
    // FALLBACK: Local Processing
    const today = new Date().toISOString().split('T')[0];
    let stats = {};
    
    switch (role) {
      case 'TELECALLER':
        const teleLeads = leads.filter(l => 
          String(l.telecaller_id || '').trim() === String(userId).trim() && 
          String(l.current_stage || '').trim().toUpperCase() === 'TELE'
        );
        const allTeleLeads = leads.filter(l => 
          String(l.telecaller_id || '').trim() === String(userId).trim()
        );
        stats = {
          total: allTeleLeads.length,
          new_today: teleLeads.filter(l => String(l.created_at || '').split('T')[0] === today).length,
          followup_due: teleLeads.filter(l => String(l.current_status || '').trim().toUpperCase() === 'NOT CONNECTED').length,
          qualified: allTeleLeads.filter(l => {
            const status = String(l.current_status || '').trim().toUpperCase();
            return status === 'QUALIFIED' || status.includes('QUALIFIED') || status === 'SC QUALIFIED' || status === 'MEETING SCHEDULED' || status === 'CONVERTED' || status === 'WON';
          }).length
        };
        break;
        
      case 'SALES COORDINATOR':
        const scStageLeads = leads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'SC');
        stats = {
          total: leads.length,
          pending_verification: scStageLeads.filter(l => String(l.current_status || '').trim().toUpperCase() === 'NOT QUALIFIED').length,
          verified_today: leads.filter(l => String(l.sc_id || '').trim() === String(userId).trim() && String(l.updated_at || '').split('T')[0] === today).length,
          created_today: leads.filter(l => String(l.created_at || '').split('T')[0] === today).length
        };
        break;
        
      case 'SALES PERSON':
        const spLeads = leads.filter(l => 
          String(l.sales_id || '').trim() === String(userId).trim() && 
          String(l.current_stage || '').trim().toUpperCase() === 'SALES'
        );
        stats = {
          total: spLeads.length,
          meetings_scheduled: spLeads.filter(l => String(l.current_status || '').trim().toUpperCase() === 'MEETING SCHEDULED').length,
          meetings_today: spLeads.filter(l => String(l.meeting_datetime || '').split('T')[0] === today).length,
          converted: leads.filter(l => String(l.sales_id || '').trim() === String(userId).trim() && String(l.current_stage || '').trim().toUpperCase() === 'WON').length
        };
        break;
        
      case 'ADMIN':
        stats = {
          total_leads: leads.length,
          in_tele: leads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'TELE').length,
          in_sc: leads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'SC').length,
          in_sales: leads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'SALES').length,
          won: leads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'WON').length,
          closed: leads.filter(l => String(l.current_stage || '').trim().toUpperCase() === 'CLOSED').length
        };
        break;
    }
    
    return { success: true, stats: stats };
  } catch (e) {
    return { success: false, message: 'Error fetching stats: ' + e.message };
  }
}

// === SETUP SHEETS (Run once to create headers) ===
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // USERS Sheet
  let sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.USERS);
    sheet.appendRow(['user_id', 'username', 'password', 'name', 'role', 'active']);
  }
  
  // LEADS_MASTER Sheet
  sheet = ss.getSheetByName(SHEETS.LEADS_MASTER);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.LEADS_MASTER);
    sheet.appendRow(['lead_id', 'enquiry_date', 'lead_source', 'lead_type', 'customer_name', 'phone', 'email', 'company', 'requirement', 'telecaller_id', 'sc_id', 'sales_id', 'current_stage', 'current_owner', 'current_status', 'latest_tele_remark', 'latest_sc_remark', 'meeting_mode', 'meeting_datetime', 'created_at', 'updated_at', 'current_sales_person_id', 'previous_sales_person_id', 'sales_followups_count', 'sales_person_changed', 'state']);
  } else {
    // Ensure new columns exist for sales person tracking and state
    const data = sheet.getDataRange().getValues();
    if (data.length > 0) {
      const headers = data[0];
      const newColumns = ['current_sales_person_id', 'previous_sales_person_id', 'sales_followups_count', 'sales_person_changed', 'state'];
      let lastCol = headers.length;
      
      newColumns.forEach(col => {
        if (!headers.includes(col)) {
          sheet.getRange(1, lastCol + 1).setValue(col);
          lastCol++;
        }
      });
    }
  }
  
  // TELE_ACTIVITY_LOG Sheet
  sheet = ss.getSheetByName(SHEETS.TELE_ACTIVITY_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.TELE_ACTIVITY_LOG);
    sheet.appendRow(['log_id', 'lead_id', 'telecaller_id', 'action', 'remark', 'followup_datetime', 'tele_plan_time', 'tele_actual_time', 'phone_call', 'whatsapp_call', 'whatsapp_message', 'email_sent', 'created_at']);
  } else {
    // Ensure new columns exist for activity tracking
    const data = sheet.getDataRange().getValues();
    if (data.length > 0) {
      const headers = data[0];
      const newColumns = ['phone_call', 'whatsapp_call', 'whatsapp_message', 'email_sent'];
      let lastCol = headers.length;
      
      newColumns.forEach(col => {
        if (!headers.includes(col)) {
          sheet.getRange(1, lastCol + 1).setValue(col);
          lastCol++;
        }
      });
    }
  }
  
  // SC_ACTIVITY_LOG Sheet
  sheet = ss.getSheetByName(SHEETS.SC_ACTIVITY_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.SC_ACTIVITY_LOG);
    sheet.appendRow(['log_id', 'lead_id', 'sc_id', 'sc_decision', 'sc_remark', 'sc_plan_time', 'sc_actual_time', 'created_at']);
  }
  
  // MEETING_LOG Sheet
  sheet = ss.getSheetByName(SHEETS.MEETING_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.MEETING_LOG);
    sheet.appendRow(['log_id', 'lead_id', 'scheduled_by', 'sales_id', 'meeting_mode', 'meeting_datetime', 'meeting_remark', 'meeting_status', 'created_at']);
  }
  
  return 'All sheets created successfully!';
}

// === GET ALL LEADS FOR ADMIN (with optional date filter) ===
function getAllLeadsAdmin(dateStr) {
  try {
    var masterSheet = getSheet(SHEETS.LEADS_MASTER);
    if (!masterSheet) return { success: false, message: 'LEADS_MASTER sheet not found' };
    
    var leads = sheetToObjects(masterSheet);
    
    // If date filter is provided, filter leads by activity on that date
    if (dateStr && dateStr !== 'ALL') {
      var teleSheet = getSheet(SHEETS.TELE_ACTIVITY_LOG);
      var scSheet = getSheet(SHEETS.SC_ACTIVITY_LOG);
      var meetingSheet = getSheet(SHEETS.MEETING_LOG);
      
      // Use plain object instead of Set for compatibility
      var activeLeadIds = {};
      
      // Check telecaller activity
      if (teleSheet) {
        sheetToObjects(teleSheet).forEach(function(log) {
          if (log.action !== 'ASSIGNMENT') {
            var logDate = String(log.tele_actual_time || log.created_at || '').split('T')[0];
            if (logDate === dateStr) activeLeadIds[log.lead_id] = true;
          }
        });
      }
      
      // Check SC activity
      if (scSheet) {
        sheetToObjects(scSheet).forEach(function(log) {
          var logDate = String(log.sc_actual_time || log.created_at || '').split('T')[0];
          if (logDate === dateStr) activeLeadIds[log.lead_id] = true;
        });
      }
      
      // Check meeting activity
      if (meetingSheet) {
        sheetToObjects(meetingSheet).forEach(function(log) {
          if (String(log.meeting_status || '').toUpperCase() !== 'REASSIGNED') {
            var logDate = String(log.created_at || '').split('T')[0];
            if (logDate === dateStr) activeLeadIds[log.lead_id] = true;
          }
        });
      }
      
      // Also include leads created on this date
      leads.forEach(function(l) {
        var createdDate = String(l.created_at || '').split('T')[0];
        if (createdDate === dateStr) activeLeadIds[l.lead_id] = true;
      });
      
      leads = leads.filter(function(l) { return activeLeadIds[l.lead_id] === true; });
    }
    
    // Enhance with user info
    var usersSheet = getSheet(SHEETS.USERS);
    var users = sheetToObjects(usersSheet);
    var userMap = {};
    users.forEach(function(u) { userMap[u.user_id] = u.name; });
    
    // Read meeting log ONCE for bulk followup counting (avoid per-lead sheet reads)
    var meetingSheetBulk = getSheet(SHEETS.MEETING_LOG);
    var allMeetings = meetingSheetBulk ? sheetToObjects(meetingSheetBulk) : [];
    
    // Pre-compute the latest reassignment date per lead+salesPerson
    var lastReassignDates = {};
    allMeetings.forEach(function(m) {
      var status = String(m.meeting_status || '').trim().toUpperCase();
      if (status === 'REASSIGNED' && m.lead_id && m.sales_id) {
        var key = m.lead_id + '__' + m.sales_id;
        var entryDate = new Date(m.created_at || 0);
        if (!lastReassignDates[key] || entryDate > lastReassignDates[key]) {
          lastReassignDates[key] = entryDate;
        }
      }
    });
    
    // Pre-compute followup counts: { "leadId__salesId": count }
    // Only count entries AFTER the last reassignment for that lead+salesPerson
    var followupCounts = {};
    allMeetings.forEach(function(m) {
      var status = String(m.meeting_status || '').trim().toUpperCase();
      if (status !== 'NOT CONNECTED' && status !== 'REASSIGNED' && status !== 'SCHEDULED' &&
          (status === 'MEETING DONE' || status === 'VISITED' || status === 'FOLLOWUP' ||
           status === 'FOLLOW UP' || status === 'COMPLETED' || status === 'RESCHEDULED')) {
        var key = m.lead_id + '__' + m.sales_id;
        // Check if there was a reassignment - only count entries after it
        var lastReassign = lastReassignDates[key];
        if (lastReassign) {
          var entryDate = new Date(m.created_at || 0);
          if (entryDate <= lastReassign) return; // Skip entries before reassignment
        }
        followupCounts[key] = (followupCounts[key] || 0) + 1;
      }
    });
    
    leads = leads.map(function(lead) {
      var enhanced = {};
      // Copy all properties
      Object.keys(lead).forEach(function(k) { enhanced[k] = lead[k]; });
      enhanced.telecaller_name = userMap[lead.telecaller_id] || lead.telecaller_id || '-';
      enhanced.sc_name = userMap[lead.sc_id] || lead.sc_id || '-';
      enhanced.sales_name = userMap[lead.sales_id] || lead.sales_id || '-';
      enhanced.owner_name = userMap[lead.current_owner] || lead.current_owner || '-';
      
      if (String(lead.current_stage || '').trim().toUpperCase() === 'SALES') {
        var key = lead.lead_id + '__' + lead.sales_id;
        var count = followupCounts[key] || 0;
        enhanced.followups_done = count;
        enhanced.followups_remaining = 3 - count;
        enhanced.can_reassign = count >= 1;
      }
      return enhanced;
    });
    
    // Sort newest first
    leads.sort(function(a, b) {
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });
    
    return { success: true, leads: leads };
  } catch (e) {
    Logger.log('getAllLeadsAdmin ERROR: ' + e.message);
    return { success: false, message: 'Error: ' + e.message };
  }
}

// === VERIFY LOST LEAD (SC Action) ===
function verifyLostLead(verificationData, scId) {
  // Validate required fields
  if (!verificationData.lead_id || !verificationData.verification_result || !verificationData.verification_remark || !scId) {
    return { success: false, message: 'Missing required fields' };
  }
  
  return safeExecute(() => {
    try {
      const masterSheet = getSheet(SHEETS.LEADS_MASTER);
      const scSheet = getSheet(SHEETS.SC_ACTIVITY_LOG);
      const meetingSheet = getSheet(SHEETS.MEETING_LOG);
      const now = getTimestamp();
      const logId = generateId('SC_LOG');
      
      // Log the verification in SC_ACTIVITY_LOG
      const scLogEntry = [
        logId,                                    // log_id
        verificationData.lead_id,                 // lead_id
        scId,                                     // sc_id
        verificationData.verification_result,     // sc_decision (ACTUALLY_LOST or STILL_VALID)
        verificationData.verification_remark,     // sc_remark
        '',                                       // sc_plan_time
        now,                                      // sc_actual_time
        now                                       // created_at
      ];
      scSheet.appendRow(scLogEntry);
      
      if (verificationData.verification_result === 'ACTUALLY_LOST') {
        // SC confirms the lead is actually lost - move to Junk since it's useless now
        const updates = {
          current_stage: 'JUNK',                    // Move to Junk instead of keeping in CLOSED
          current_status: 'SC CONFIRMED LOST',
          current_owner: '',                        // Remove owner since it's in Junk
          latest_sc_remark: verificationData.verification_remark,
          sc_id: scId,
          updated_at: now
        };
        updateRowByLeadId(masterSheet, verificationData.lead_id, updates);
        
        return { success: true, message: 'Lead confirmed as lost and moved to Junk category.' };
        
      } else if (verificationData.verification_result === 'STILL_VALID') {
        // SC found the lead is still valid - reassign to new sales person
        if (!verificationData.reassign_to || !verificationData.followup_date) {
          return { success: false, message: 'Reassignment details are required when lead is still valid' };
        }
        
        // Record the reassignment in meeting log
        const reassignMeetingEntry = [
          generateId('MTG'),                        // log_id
          verificationData.lead_id,                 // lead_id
          scId,                                     // scheduled_by (SC doing the reassignment)
          verificationData.reassign_to,             // sales_id (new sales person)
          'Phone Call',                             // meeting_mode (default for reassignment)
          verificationData.followup_date,           // meeting_datetime (next followup)
          verificationData.reassign_remark || 'Lead reassigned after SC verification - lead is still valid', // meeting_remark
          'REASSIGNED_FROM_LOST',                   // meeting_status (special status for this case)
          now                                       // created_at
        ];
        meetingSheet.appendRow(reassignMeetingEntry);
        
        // Update lead master with new sales person
        const updates = {
          current_stage: 'SALES',                   // Move back to sales stage
          current_status: 'SC VERIFIED - REASSIGNED', // New status
          current_owner: verificationData.reassign_to,
          sales_id: verificationData.reassign_to,
          previous_sales_person_id: '',             // Reset previous since this is a fresh assignment
          sales_followups_count: 0,                 // Reset follow-up count
          sales_person_changed: 'YES',              // Mark as changed
          meeting_datetime: verificationData.followup_date,
          latest_sc_remark: verificationData.verification_remark,
          sc_id: scId,
          updated_at: now
        };
        updateRowByLeadId(masterSheet, verificationData.lead_id, updates);
        
        // Record assignment event
        recordAssignmentEvent(
          verificationData.lead_id, 
          verificationData.reassign_to, 
          scId, 
          'SC_LOST_VERIFICATION_REASSIGNMENT', 
          now
        );
        
        return { success: true, message: 'Lead verified as still valid and reassigned to new sales person successfully.' };
      }
      
      return { success: false, message: 'Invalid verification result' };
      
    } catch (e) {
      Logger.log('verifyLostLead ERROR: ' + e.message);
      return { success: false, message: 'Error processing verification: ' + e.message };
    }
  });
}

// === GET ADMIN ACTIVITY SUMMARY FOR A DATE ===
function getAdminDailySummary(dateStr) {
  try {
    var masterSheet = getSheet(SHEETS.LEADS_MASTER);
    var teleSheet = getSheet(SHEETS.TELE_ACTIVITY_LOG);
    var scSheet = getSheet(SHEETS.SC_ACTIVITY_LOG);
    var meetingSheet = getSheet(SHEETS.MEETING_LOG);
    var usersSheet = getSheet(SHEETS.USERS);
    
    var leads = sheetToObjects(masterSheet);
    var leadsMap = {};
    leads.forEach(function(l) { leadsMap[l.lead_id] = l; });
    
    var users = sheetToObjects(usersSheet);
    var userMap = {};
    users.forEach(function(u) { userMap[u.user_id] = { name: u.name, role: u.role }; });
    
    // Stats
    var teleActions = 0, scActions = 0, meetingActions = 0;
    var qualified = 0, not_connected = 0, not_qualified = 0, not_picked = 0;
    var meetings_scheduled = 0, meeting_done = 0, converted = 0, lost = 0, no_show = 0;
    var leadsCreated = 0;
    
    // Telecaller activity on this date
    var teleLog = teleSheet ? sheetToObjects(teleSheet).filter(function(l) {
      return l.action !== 'ASSIGNMENT' &&
        String(l.tele_actual_time || l.created_at || '').split('T')[0] === dateStr;
    }) : [];
    
    teleLog.forEach(function(e) {
      teleActions++;
      var a = String(e.action || '').trim().toUpperCase();
      if (a === 'QUALIFIED') qualified++;
      else if (a === 'NOT CONNECTED') not_connected++;
      else if (a === 'NOT QUALIFIED') not_qualified++;
      else if (a === 'NOT PICKED') not_picked++;
    });
    
    // SC activity on this date
    var scLog = scSheet ? sheetToObjects(scSheet).filter(function(l) {
      return String(l.sc_actual_time || l.created_at || '').split('T')[0] === dateStr;
    }) : [];
    scActions = scLog.length;
    
    // Meeting activity on this date
    var meetingLog = meetingSheet ? sheetToObjects(meetingSheet).filter(function(m) {
      return String(m.created_at || '').split('T')[0] === dateStr &&
        String(m.meeting_status || '').trim().toUpperCase() !== 'REASSIGNED';
    }) : [];
    
    meetingLog.forEach(function(m) {
      meetingActions++;
      var s = String(m.meeting_status || '').trim().toUpperCase();
      if (s === 'SCHEDULED') meetings_scheduled++;
      else if (s === 'MEETING DONE' || s === 'VISITED') meeting_done++;
      else if (s === 'CONVERTED' || s === 'COMPLETED') converted++;
      else if (s === 'LOST') lost++;
      else if (s === 'NOT CONNECTED') no_show++;
    });
    
    // Leads created on this date
    leads.forEach(function(l) {
      if (String(l.created_at || '').split('T')[0] === dateStr) leadsCreated++;
    });
    
    // Build combined activity list (all events on this date)
    var activities = [];
    
    // Deduplicate telecaller log by lead_id (keep latest per lead)
    var teleByLead = {};
    teleLog.forEach(function(e) {
      var lid = e.lead_id;
      var eTime = new Date(e.tele_actual_time || e.created_at || 0).getTime();
      if (!teleByLead[lid] || eTime > new Date(teleByLead[lid].tele_actual_time || teleByLead[lid].created_at || 0).getTime()) {
        teleByLead[lid] = e;
      }
    });
    Object.keys(teleByLead).forEach(function(key) {
      var e = teleByLead[key];
      var lead = leadsMap[e.lead_id] || {};
      var userName = userMap[e.telecaller_id] ? userMap[e.telecaller_id].name : e.telecaller_id;
      var teleName = userMap[lead.telecaller_id] ? userMap[lead.telecaller_id].name : (lead.telecaller_id || '-');
      var salName = userMap[lead.sales_id] ? userMap[lead.sales_id].name : (lead.sales_id || '-');
      activities.push({
        time: e.tele_actual_time || e.created_at,
        type: 'TELECALLER',
        user_name: userName,
        lead_id: e.lead_id,
        customer_name: lead.customer_name || '',
        phone: lead.phone || '',
        company: lead.company || '',
        action: e.action,
        remark: e.remark || '',
        phone_call: e.phone_call,
        whatsapp_call: e.whatsapp_call,
        whatsapp_message: e.whatsapp_message,
        email_sent: e.email_sent,
        telecaller_name: teleName,
        sales_name: salName
      });
    });
    
    scLog.forEach(function(e) {
      var lead = leadsMap[e.lead_id] || {};
      var userName = userMap[e.sc_id] ? userMap[e.sc_id].name : e.sc_id;
      var teleName = userMap[lead.telecaller_id] ? userMap[lead.telecaller_id].name : (lead.telecaller_id || '-');
      var salName = userMap[lead.sales_id] ? userMap[lead.sales_id].name : (lead.sales_id || '-');
      activities.push({
        time: e.sc_actual_time || e.created_at,
        type: 'SC',
        user_name: userName,
        lead_id: e.lead_id,
        customer_name: lead.customer_name || '',
        phone: lead.phone || '',
        company: lead.company || '',
        action: e.sc_decision,
        remark: e.sc_remark || '',
        telecaller_name: teleName,
        sales_name: salName
      });
    });
    
    // Deduplicate meetings by lead_id (keep latest per lead)
    var meetByLead = {};
    meetingLog.forEach(function(m) {
      var lid = m.lead_id;
      var mTime = new Date(m.created_at || 0).getTime();
      if (!meetByLead[lid] || mTime > new Date(meetByLead[lid].created_at || 0).getTime()) {
        meetByLead[lid] = m;
      }
    });
    Object.keys(meetByLead).forEach(function(key) {
      var m = meetByLead[key];
      var lead = leadsMap[m.lead_id] || {};
      var userName = userMap[m.sales_id] ? userMap[m.sales_id].name : m.sales_id;
      var teleName = userMap[lead.telecaller_id] ? userMap[lead.telecaller_id].name : (lead.telecaller_id || '-');
      var salName = userMap[lead.sales_id] ? userMap[lead.sales_id].name : (lead.sales_id || '-');
      activities.push({
        time: m.created_at,
        type: 'SALES',
        user_name: userName,
        lead_id: m.lead_id,
        customer_name: lead.customer_name || '',
        phone: lead.phone || '',
        company: lead.company || '',
        action: m.meeting_status,
        remark: m.meeting_remark || '',
        meeting_mode: m.meeting_mode || '',
        telecaller_name: teleName,
        sales_name: salName
      });
    });
    
    // Sort activities by time DESC
    activities.sort(function(a, b) { return new Date(b.time || 0) - new Date(a.time || 0); });
    
    return {
      success: true,
      date: dateStr,
      stats: {
        leads_created: leadsCreated,
        tele_actions: teleActions,
        qualified: qualified,
        not_connected: not_connected,
        not_qualified: not_qualified,
        not_picked: not_picked,
        sc_actions: scActions,
        meeting_actions: meetingActions,
        meetings_scheduled: meetings_scheduled,
        meeting_done: meeting_done,
        converted: converted,
        lost: lost,
        no_show: no_show
      },
      activities: activities
    };
  } catch (e) {
    Logger.log('getAdminDailySummary ERROR: ' + e.message);
    return { success: false, message: 'Error: ' + e.message };
  }
}
