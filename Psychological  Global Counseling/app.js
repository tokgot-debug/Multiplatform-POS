/* VANBRANSA App Engine - Global Practice Operations Logic & Prototype Expansion */

// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) { alert(message); return; }

  const icons = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-text">${message}</span>
    <button class="toast-dismiss" onclick="this.parentElement.classList.add('toast-fade-out'); setTimeout(() => this.parentElement.remove(), 300);">×</button>
  `;

  container.appendChild(toast);

  // Auto-dismiss after 4.5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

// --- 1. STATE & DATABASES ---

const STATE = {
  activeRole: 'joel', // Default role
  activeView: 'dashboard-view',
  selectedClientId: null,
  selectedInvoiceId: null,
  breakGlassAuthorized: false,
  alarmCountdown: 60,
  alarmTimer: null,
  isRecording: false,
  recordingInterval: null,
  activePaymentTab: 'mpesa',
  athenaeumSearchMode: 'lexical',
  activeKairosView: 'canvas',
  activeModalitySub: 'genogram',
  
  // New Expansion States
  activeJurisdiction: 'kenya',
  videoPlaybackActive: false,
  videoTimeSeconds: 322,
  videoInterval: null,
  selectedGenoNodes: [],
  
  // Jurisdiction Policies Profiles (M22)
  jurisdictions: {
    kenya: {
      name: 'Kenya DPA 2019',
      ageOfMajority: 18,
      breachSLA: '72 hours',
      residency: 'Nairobi Cell (Primary)',
      consents: ['Psychological Treatment Consent', 'Telehealth Consent', 'Sage AI note drafting', 'KRA eTIMS Statutory Consent']
    },
    gdpr: {
      name: 'EU GDPR / EEA Health',
      ageOfMajority: 16,
      breachSLA: '72 hours',
      residency: 'Frankfurt Cell (Primary)',
      consents: ['Treatment Consent', 'Telehealth Consent', 'Sage AI note drafting', 'EU Art 49 Data Transfer Consent']
    },
    hipaa: {
      name: 'USA HIPAA Compliance',
      ageOfMajority: 18,
      breachSLA: '60 days',
      residency: 'Virginia Cell (Primary)',
      consents: ['Treatment Consent', 'Telehealth Consent', 'Sage AI note drafting', 'HIPAA BAA (Business Associate)']
    },
    popia: {
      name: 'South Africa POPIA',
      ageOfMajority: 18,
      breachSLA: 'Reasonable SLA',
      residency: 'Johannesburg Cell (Primary)',
      consents: ['Treatment Consent', 'Telehealth Consent', 'Sage AI note drafting', 'Section 72 Cross-border Transfer']
    }
  },

  // Staff Licensure Registry & Specialisms (M17 / M5)
  staffCredentials: [
    {
      name: 'Joel Mwangi',
      role: 'Staff Psychologist',
      license: 'KCP Board Lic #7731',
      expiresInDays: 12,
      status: 'expiring',
      specialties: ['individual', 'marriage', 'educational', 'group'],
      specialtiesLabels: ['Individual/Personal', 'Marriage & Couples', 'Educational/School', 'Group Support'],
      load: '65%',
      payoutSplit: '70/30'
    },
    {
      name: 'Dr. Amina',
      role: 'Clinical Director',
      license: 'KMPDC Board Lic #0822',
      expiresInDays: 124,
      status: 'active',
      specialties: ['individual', 'marriage', 'health', 'group'],
      specialtiesLabels: ['Individual/Personal', 'Marriage & Couples', 'Health & Rehabilitation', 'Group Support'],
      load: '40%',
      payoutSplit: '80/20'
    },
    {
      name: 'Dr. Osei',
      role: 'Clinical Supervisor',
      license: 'SACSSP Board Lic #9182',
      expiresInDays: 245,
      status: 'active',
      specialties: ['trauma', 'substance', 'spiritual', 'individual', 'career'],
      specialtiesLabels: ['Trauma & Crisis', 'Substance Use & Addiction', 'Spiritual/Pastoral', 'Individual/Personal', 'Career & Vocational'],
      load: '50%',
      payoutSplit: '75/25'
    }
  ],

  // Caseload & Client Record (M4)
  clients: [
    {
      id: 'c_001',
      name: 'Amina Omondi',
      avatar: 'A',
      dob: '1992-04-12',
      gender: 'Female',
      location: 'Nairobi, Kenya',
      phone: '+254 712 345678',
      language: 'English / Kiswahili',
      eapSponsor: 'Safaricom EAP',
      caseloadOwner: 'joel',
      areaOfPractice: 'individual',
      areaOfPracticeLabel: 'Individual/Personal Counseling',
      referralReason: 'Workplace Anxiety / Panic Attacks',
      consent: {
        treatment: true,
        telehealth: true,
        ai: true,
        recording: false
      },
      safetyPlan: {
        warningSigns: 'Feeling tightness in chest, avoidance of social phone calls.',
        copingStrategies: '4-7-8 breathing exercise, walking in the garden.',
        contacts: 'Peter Omondi (+254 722 000000)',
        crisisLines: 'Nairobi Mind-Care Help (+254 800 123456)'
      },
      outcomeHistory: {
        phq9: [18, 16, 15, 12, 10, 6],
        gad7: [16, 14, 13, 11, 8, 5]
      },
      notes: [
        {
          id: 'n_01',
          date: '2026-08-06',
          author: 'Joel Mwangi',
          type: 'SOAP Note',
          body: 'S: Client reports feeling significant relief from workplace-induced panic symptoms. Practiced boundary setting.\nO: Attentive, well-groomed, cooperative. Clear speech.\nA: Anxiety indices showing clinically significant reduction (Reliable Change Index = 8.2).\nP: Continue CBT behavioral experiments; next check-in scheduled for weekly interval.'
        }
      ],
      homework: [
        {
          id: 'hw_01',
          date: '2026-08-15',
          event: 'Had to present Q3 results to executive panel.',
          thoughts: 'They will see my hands shaking and realize I am incompetent.',
          distortion: 'Catastrophizing',
          rational: 'A little anxiety is normal. I am fully prepared and know the data better than anyone else.',
          suds: 4
        }
      ],
      processNotes: 'Client expressed feelings of impostor syndrome related to recent leadership promotion. Explored childhood sibling competition issues.'
    },
    {
      id: 'c_002',
      name: 'Sarah Jenkins',
      avatar: 'S',
      dob: '1980-09-22',
      gender: 'Female',
      location: 'London, UK',
      phone: '+44 7700 900077',
      language: 'English',
      eapSponsor: 'None (Private)',
      caseloadOwner: 'joel',
      areaOfPractice: 'trauma',
      areaOfPracticeLabel: 'Trauma and Crisis Counseling',
      referralReason: 'Bereavement / Grief over Parent loss',
      consent: {
        treatment: true,
        telehealth: true,
        ai: false,
        recording: false
      },
      safetyPlan: null,
      outcomeHistory: {
        phq9: [22, 21, 22, 20, 21, 23],
        gad7: [19, 18, 20, 19, 18, 20]
      },
      notes: [
        {
          id: 'n_02',
          date: '2026-08-10',
          author: 'Joel Mwangi',
          type: 'CBT Note',
          body: 'Client reports ongoing grief and persistent depressive thoughts. Limited progress with standard exposure worksheets.'
        }
      ],
      homework: [],
      processNotes: 'Grief process is heavily tangled with financial concerns and self-blame patterns regarding parents estate details.'
    },
    {
      id: 'c_003',
      name: 'John Doe',
      avatar: 'J',
      dob: '1995-12-05',
      gender: 'Male',
      location: 'New York, USA',
      phone: '+1 212 555 0199',
      language: 'English',
      eapSponsor: 'Microsoft Wellness',
      caseloadOwner: 'dr_osei',
      areaOfPractice: 'substance',
      areaOfPracticeLabel: 'Substance Use and Addiction Counseling',
      referralReason: 'Alcohol Use Disorder / High Self-Harm risk',
      consent: {
        treatment: true,
        telehealth: true,
        ai: true,
        recording: true
      },
      safetyPlan: {
        warningSigns: 'Thoughts of escape, sleep duration < 4 hours.',
        copingStrategies: 'Listen to grounding audio, text support buddy.',
        contacts: 'Mary Doe (+1 212 555 0200)',
        crisisLines: 'US Suicide Prevention (988)'
      },
      outcomeHistory: {
        phq9: [24, 23, 25, 24],
        gad7: [20, 19, 21, 20]
      },
      notes: [
        {
          id: 'n_03',
          date: '2026-08-12',
          author: 'Dr. Osei',
          type: 'Crisis Note',
          body: 'Note locked by Dr. Osei. High risk client.'
        }
      ],
      homework: [],
      processNotes: 'Highly sensitive data. Restricted to owner.'
    }
  ],

  // Geo-crisis lookup data indices (M9)
  geoCrisisRegistry: {
    'c_001': {
      coords: '1.2921° S, 36.8219° E (Nairobi)',
      status: 'Verified Match (Nairobi Primary Cell)',
      contacts: 'Emergency Services: 999 | Local Mental Health Hospital: Mathari National Hospital (+254 20 376 3313)'
    },
    'c_002': {
      coords: '51.5074° N, 0.1278° W (London)',
      status: 'Verified Cross-Border Transfer (Nairobi to London)',
      contacts: 'Emergency Services: 999 | NHS Mental Health Crisis Team: Dial 111'
    },
    'c_003': {
      coords: '40.7128° N, 74.0060° W (New York)',
      status: 'Verified Cross-Border Transfer (Nairobi to USA Cell)',
      contacts: 'Emergency Services: 911 | US Mental Health Support Hotline: Dial 988'
    }
  },

  // Family Genogram Graph (M11)
  genogram: {
    nodes: [
      { id: 'g_1', x: 150, y: 120, gender: 'male', label: 'Spouse (Peter)', selected: false },
      { id: 'g_2', x: 300, y: 120, gender: 'female', label: 'Amina', selected: false },
      { id: 'g_3', x: 220, y: 240, gender: 'female', label: 'Child (Tanya)', selected: false }
    ],
    links: [
      { source: 'g_1', target: 'g_2', relation: 'spouse' },
      { source: 'g_2', target: 'g_3', relation: 'parent' }
    ]
  },

  // Case Supervision Annotation tracks (M12)
  supervisionNotes: [
    { time: '02:15', author: 'Joel Mwangi', text: 'Explored somatic distress indices reported during recent promotion feedback.' },
    { time: '05:22', author: 'Dr. Amina (Supervisor)', text: 'Excellent application of CBT validation scales. Guide her to challenge automatic thoughts.' }
  ],

  // Scheduler Appointments (M13)
  appointments: [
    {
      id: 'apt_01',
      clientName: 'Amina Omondi',
      timeStr: '09:00 AM',
      duration: '50 min',
      timezone: 'EAT (Nairobi)',
      noShowProb: '5%',
      noShowSeverity: 'low',
      active: false
    },
    {
      id: 'apt_02',
      clientName: 'Sarah Jenkins',
      timeStr: '11:00 AM',
      duration: '50 min',
      timezone: 'BST (London)',
      noShowProb: '12%',
      noShowSeverity: 'low',
      active: false
    },
    {
      id: 'apt_03',
      clientName: 'John Doe',
      timeStr: '02:00 PM',
      duration: '50 min',
      timezone: 'EST (New York)',
      noShowProb: '38%',
      noShowSeverity: 'high',
      active: true
    }
  ],

  // Pulse Event & Alerts Fabric (M16)
  alerts: [
    {
      id: 'alt_01',
      severity: 's1',
      source: 'Risk Engine (M9)',
      type: 'Acute Risk Flag',
      message: 'Client John Doe endorsed positive suicidal ideation in intake screening checklist.',
      timestamp: '2026-08-20 18:15:32',
      status: 'pending',
      details: 'Item 9 on PHQ-9 endorsed at level 3. Local crisis resources prepared for New York (EST).'
    },
    {
      id: 'alt_02',
      severity: 's2',
      source: 'Trajectory (M8)',
      type: 'Off-Track Treatment Alert',
      message: 'Client Sarah Jenkins shows zero clinically significant improvement at Session #6.',
      timestamp: '2026-08-20 19:42:01',
      status: 'pending',
      details: 'Normative curve indicates reliable recovery curve is missed. Check alliance score and protocol alignment.'
    },
    {
      id: 'alt_03',
      severity: 's4',
      source: 'Compliance (M22)',
      type: 'Overdue Documentation',
      message: 'Session note for Amina Omondi (2026-08-18) is unsigned at T+48 hours.',
      timestamp: '2026-08-20 20:00:00',
      status: 'pending',
      details: 'Note locked date approaching (72h limit). Compliance checklist incomplete.'
    },
    {
      id: 'alt_04',
      severity: 's5',
      source: 'Billing Gateway (M18)',
      type: 'Failed STK Push Callback',
      message: 'M-Pesa STK transaction for Invoice INV-2026-003 timed out.',
      timestamp: '2026-08-20 20:10:15',
      status: 'pending',
      details: 'Safaricom Daraja API response code 1032 (Transaction cancelled by user or timeout).'
    }
  ],

  // Invoices (M18)
  invoices: [
    {
      id: 'INV-2026-004',
      clientName: 'Amina Omondi',
      amountNum: 6500.00,
      currency: 'KES',
      amount: 'KES 6,500.00',
      date: '2026-08-20',
      status: 'Unpaid',
      eTimsSig: 'Pending Signature',
      buyerPin: 'A009187364B',
      desc: 'Psychotherapy Evaluation (Session #6)',
      paymentChannel: 'N/A',
      paymentRef: 'N/A'
    },
    {
      id: 'INV-2026-003',
      clientName: 'Sarah Jenkins',
      amountNum: 120.00,
      currency: 'GBP',
      amount: 'GBP 120.00',
      date: '2026-08-18',
      status: 'Unpaid',
      eTimsSig: 'N/A (UK Exempt)',
      buyerPin: '',
      desc: 'Bereavement/Grief Consultation Protocol',
      paymentChannel: 'N/A',
      paymentRef: 'N/A'
    },
    {
      id: 'INV-2026-002',
      clientName: 'John Doe',
      amountNum: 150.00,
      currency: 'USD',
      amount: 'USD 150.00',
      date: '2026-08-12',
      status: 'Paid',
      eTimsSig: 'N/A (US Exempt)',
      buyerPin: '',
      desc: 'Clinical Addiction Risk Triage Evaluation',
      paymentChannel: 'Visa Card',
      paymentRef: 'TXN-CARD-991A'
    }
  ],

  // Athenaeum Resources (M20)
  resources: [
    {
      title: 'CBT Cognitive Restructuring Worksheet',
      authors: 'Beck Institute',
      year: 2021,
      doi: '10.1016/j.cpr.2021.102022',
      evidenceLevel: 'Systematic Review',
      summary: 'Standard double-column worksheet for tracing automatic thoughts, cognitive distortions, and drafting balanced alternative thoughts.',
      tags: ['CBT', 'Anxiety', 'Worksheet', 'Individual']
    },
    {
      title: 'DBT Distress Tolerance Handout - TIPP Skills',
      authors: 'Linehan Research Group',
      year: 2018,
      doi: '10.1111/cpsp.12239',
      evidenceLevel: 'Randomized Controlled Trial',
      summary: 'Practical worksheets on using Temperature, Intense exercise, Paced breathing, and Paired muscle relaxation during high acute arousal states.',
      tags: ['DBT', 'Borderline', 'Worksheet', 'Trauma']
    },
    {
      title: 'Adolescent CBT Protocol for Panic Disorder',
      authors: 'Kendall et al.',
      year: 2023,
      doi: '10.1037/ccp0000789',
      evidenceLevel: 'Randomized Controlled Trial',
      summary: 'A structured 12-session manualized protocol for treating panic disorder in teenagers. Focuses on interoceptive exposure.',
      tags: ['CBT', 'Panic', 'Educational', 'Protocol']
    },
    {
      title: 'Vocational Interests & Values Sorting Guide',
      authors: 'Holland Career Center',
      year: 2020,
      doi: '10.1177/1069072720925463',
      evidenceLevel: 'Case Studies',
      summary: 'Card sorting template to determine aptitude configurations, primary RIASEC interest areas, and occupational fit metrics.',
      tags: ['Aptitude', 'Career', 'Worksheet', 'Vocational']
    },
    {
      title: 'Spiritual Assessment Framework in Clinical Practice',
      authors: 'Pargament et al.',
      year: 2019,
      doi: '10.1002/jclp.22728',
      evidenceLevel: 'Systematic Review',
      summary: 'Structured clinical protocols for integrating spiritual and faith-based resources in coping with crisis or grief.',
      tags: ['Spiritual', 'Pastoral', 'Grief', 'Protocol']
    },
    {
      title: 'Soothing the Body: Chronic Illness and Adherence Handout',
      authors: 'World Health Organization',
      year: 2022,
      doi: '10.1016/j.jpsychores.22.091',
      evidenceLevel: 'Randomized Controlled Trial',
      summary: 'Client-facing worksheets on stress management, self-care routines, and medication adherence loops for patients with chronic diagnosis.',
      tags: ['Health', 'Rehabilitation', 'HIV', 'Worksheet']
    }
  ],

  // Audit Ledger (M22) - SHA-256 Mocked block hash chain
  auditLedger: [
    {
      id: 'TX-001',
      timestamp: '2026-08-20 10:00:00',
      role: 'System Init',
      purpose: 'SYS_BOOT',
      scope: 'Global Cell',
      action: 'Nairobi primary data cell mounted successfully.',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    {
      id: 'TX-002',
      timestamp: '2026-08-20 12:45:10',
      role: 'Joel Mwangi (Clinician)',
      purpose: 'CLINICAL_SESSION',
      scope: 'c_001 (Amina Omondi)',
      action: 'Authenticated with FIDO2 WebAuthn Passkey.',
      hash: '8f3c7a01d5e6833b91a27453d8205efc8a58a69a0a2df3300f8983802e86bb5f'
    }
  ]
};

// --- 2. LAYOUT ROUTER & MENU NAVIGATION ---

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.getAttribute('data-target');
    
    // Check RBAC before navigating
    if (!checkRBACAccess(target)) {
      showToast(`[RBAC BLOCK] Access denied. Current role [${STATE.activeRole}] lacks permissions for this module.`, 'error');
      return;
    }
    
    // Set active link style
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // Automatically expand the parent group if this link is nested
    const parentGroup = link.closest('.nav-group');
    if (parentGroup) {
      parentGroup.classList.remove('collapsed');
    }

    // Switch view panel
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    
    const mainViewport = document.querySelector('.app-main');
    if (mainViewport) mainViewport.scrollTop = 0;
    
    STATE.activeView = target;
    
      // Post-navigation render actions
      if (target === 'trajectory-view') {
        renderTrajectoryChart();
      } else if (target === 'kairos-view') {
        renderKairos();
      } else if (target === 'modality-view') {
        renderGenogram();
        drawGroupRadar();
      } else if (target === 'supervision-view') {
        renderSupervisionTimeline();
      } else if (target === 'reporting-view') {
        renderReportingMetrics();
      } else if (target === 'client-homework-view') {
        renderHomeworkHistory();
      }
    
    logAudit('NAVIGATE_VIEW', target, `Navigated to view panel: ${target}`);
  });
});

// --- 3. ROLE-BASED ACCESS CONTROL (RBAC) CONTROLLER (M2) ---

function checkRBACAccess(viewId) {
  const role = STATE.activeRole;
  
  if (role === 'amina_owner') return true; // Super privileges
  
  if (role === 'joel') {
    if (viewId === 'audit-view') return false;
    return true;
  }
  
  if (role === 'grace_billing') {
    if (viewId === 'dashboard-view' || viewId === 'billing-view' || viewId === 'reporting-view') return true;
    return false;
  }
  
  if (role === 'naomi_intake') {
    if (viewId === 'dashboard-view' || viewId === 'client-records-view' || viewId === 'kairos-view') return true;
    return false;
  }
  
  if (role === 'client_amina') {
    if (viewId === 'dashboard-view' || viewId === 'billing-view' || viewId === 'trajectory-view' || viewId === 'client-homework-view') return true;
    return false;
  }
  
  return false;
}

// Apply visual changes across UI based on role permissions
function applyRBACPermissions() {
  const role = STATE.activeRole;
  const usernameEl = document.getElementById('sidebar-username');
  const roleEl = document.getElementById('sidebar-role');
  const avatarEl = document.getElementById('sidebar-avatar');
  const welcomeTitle = document.getElementById('welcome-title');
  
  if (role === 'joel') {
    usernameEl.textContent = 'Joel Mwangi';
    roleEl.textContent = 'Staff Psychologist';
    avatarEl.textContent = 'J';
    welcomeTitle.textContent = 'Joel Mwangi — Clinician Dashboard';
  } else if (role === 'amina_owner') {
    usernameEl.textContent = 'Dr. Amina';
    roleEl.textContent = 'Clinical Director (Owner)';
    avatarEl.textContent = 'A';
    welcomeTitle.textContent = 'Dr. Amina — Practice Management Command Center';
  } else if (role === 'grace_billing') {
    usernameEl.textContent = 'Grace Wanjiku';
    roleEl.textContent = 'Billing & Insurance Officer';
    avatarEl.textContent = 'G';
    welcomeTitle.textContent = 'Grace Wanjiku — Billing Operations Control';
  } else if (role === 'naomi_intake') {
    usernameEl.textContent = 'Naomi K';
    roleEl.textContent = 'Intake Coordinator';
    avatarEl.textContent = 'N';
    welcomeTitle.textContent = 'Naomi — Intake Triage Desk';
  } else if (role === 'client_amina') {
    usernameEl.textContent = 'Amina Omondi';
    roleEl.textContent = 'Client Portal';
    avatarEl.textContent = 'AO';
    welcomeTitle.textContent = 'Amina Omondi — Secure Client Portal';
  }
  
  document.getElementById('active-role-lbl').textContent = roleEl.textContent;

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    const target = link.getAttribute('data-target');
    if (checkRBACAccess(target)) {
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
  });

  renderClientList();
  renderCaseloadTriage();
  renderLicensureList();
  renderTriageMatches();
  
  document.getElementById('client-details-content').classList.add('hidden');
  document.getElementById('client-details-placeholder').classList.remove('hidden');
  document.getElementById('invoice-details-content').classList.add('hidden');
  document.getElementById('billing-details-placeholder').classList.remove('hidden');

  logAudit('ROLE_SWITCH', role, `Active role switched to: ${role}`);
}

// --- 4. EXPLICIT EMERGENCY BREAK-GLASS BYPASS (M1) ---

const breakGlassBtn = document.getElementById('break-glass-btn');
const breakGlassModal = document.getElementById('modal-break-glass');
const submitBreakGlassBtn = document.getElementById('submit-break-glass-btn');
const breakGlassReasonText = document.getElementById('break-glass-reason');
const breakGlassSelect = document.getElementById('break-glass-client-select');
const alarmBanner = document.getElementById('alarm-banner');
const countdownSpan = document.getElementById('alarm-countdown');
const deactivateAlarmBtn = document.getElementById('deactivate-alarm-btn');

breakGlassBtn.addEventListener('click', () => {
  breakGlassSelect.innerHTML = '';
  STATE.clients.forEach(c => {
    if (c.caseloadOwner !== STATE.activeRole) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.location})`;
      breakGlassSelect.appendChild(opt);
    }
  });
  
  breakGlassModal.classList.add('active');
});

submitBreakGlassBtn.addEventListener('click', () => {
  const reason = breakGlassReasonText.value.trim();
  if (reason.length < 10) {
    showToast('Please enter a clinical justification of at least 10 characters.', 'warning');
    return;
  }
  
  const targetId = breakGlassSelect.value;
  const clientObj = STATE.clients.find(c => c.id === targetId);

  STATE.breakGlassAuthorized = true;
  STATE.lastBreakGlassReason = reason;
  breakGlassModal.classList.remove('active');
  alarmBanner.classList.remove('hidden');
  
  const alertId = `alt_bg_${Date.now()}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const breakGlassAlert = {
    id: alertId,
    severity: 's1',
    source: 'Security Engine (M22)',
    type: 'BREAK-GLASS COMPROMISE',
    message: `Joel Mwangi deployed BREAK-GLASS bypass on file ${clientObj.name}. Reason: "${reason}"`,
    timestamp: timestamp,
    status: 'pending',
    details: `Emergency bypass active on record ${targetId}. Supervisor pager notified.`
  };
  STATE.alerts.unshift(breakGlassAlert);
  
  renderAlertPills();
  renderPulseLogs();
  
  logAudit('BREAK_GLASS', targetId, `BYPASS DEPLOYED. Reason: ${reason}`);

  STATE.selectedClientId = targetId;
  document.querySelectorAll('.nav-link').forEach(l => {
    if (l.getAttribute('data-target') === 'client-records-view') {
      l.click();
    }
  });
  selectClient(targetId);

  STATE.alarmCountdown = 60;
  countdownSpan.textContent = STATE.alarmCountdown;
  clearInterval(STATE.alarmTimer);
  STATE.alarmTimer = setInterval(() => {
    STATE.alarmCountdown--;
    countdownSpan.textContent = STATE.alarmCountdown;
    if (STATE.alarmCountdown <= 0) {
      clearInterval(STATE.alarmTimer);
      alert('[ALARM ESCALATION] Clinical Director callback initiated.');
    }
  }, 1000);
});

deactivateAlarmBtn.addEventListener('click', () => {
  clearInterval(STATE.alarmTimer);
  alarmBanner.classList.add('hidden');
  STATE.breakGlassAuthorized = false;
  logAudit('BREAK_GLASS_DEACTIVATE', STATE.selectedClientId, 'Break-glass session alarm acknowledged and deactivated.');
});

// --- 5. CLIENT RECORDS CONTROLLER (M4) ---

function renderClientList() {
  const container = document.getElementById('client-list-container');
  container.innerHTML = '';
  
  const query = document.getElementById('client-search-input').value.toLowerCase();
  
  const filtered = STATE.clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(query) || c.location.toLowerCase().includes(query);
    
    if (STATE.activeRole === 'joel' && !STATE.breakGlassAuthorized) {
      return matchesSearch && c.caseloadOwner === 'joel';
    }
    return matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="p-3 text-muted fs-xs">No clients matched rules.</div>';
    return;
  }

  filtered.forEach(c => {
    const div = document.createElement('div');
    div.className = `client-list-item ${STATE.selectedClientId === c.id ? 'active' : ''}`;
    div.innerHTML = `
      <div class="avatar-sm">${c.avatar}</div>
      <div class="item-meta">
        <h5>${c.name}</h5>
        <span>${c.location} | Owner: ${c.caseloadOwner}</span>
      </div>
    `;
    div.addEventListener('click', () => selectClient(c.id));
    container.appendChild(div);
  });
}

function selectClient(id) {
  STATE.selectedClientId = id;
  renderClientList();
  
  const clientObj = STATE.clients.find(c => c.id === id);
  const detailContainer = document.getElementById('client-details-content');
  const placeholder = document.getElementById('client-details-placeholder');
  
  if (STATE.activeRole === 'joel' && clientObj.caseloadOwner !== 'joel' && !STATE.breakGlassAuthorized) {
    showToast(`[RLS ROW ACCESS PREVENTED] Row-level security restricts file [${clientObj.name}] to caseload owner [${clientObj.caseloadOwner}]. Click the red "BREAK GLASS" button at the top to override.`, 'error');
    STATE.selectedClientId = null;
    renderClientList();
    return;
  }
  
  placeholder.classList.add('hidden');
  detailContainer.classList.remove('hidden');
  
  // Set demographics
  document.getElementById('c-fullname').textContent = clientObj.name;
  document.getElementById('c-avatar').textContent = clientObj.avatar;
  document.getElementById('c-location').textContent = clientObj.location;
  document.getElementById('c-gender').textContent = clientObj.gender;
  document.getElementById('c-dob').textContent = `${clientObj.dob} (${calculateAge(clientObj.dob)}yo)`;
  document.getElementById('c-language').textContent = clientObj.language;
  document.getElementById('c-phone').textContent = clientObj.phone;
  document.getElementById('c-owner').textContent = clientObj.caseloadOwner;
  
  document.getElementById('c-practice-area').textContent = clientObj.areaOfPracticeLabel;
  document.getElementById('c-referral-reason').textContent = clientObj.referralReason;
  
  const eapWrapper = document.getElementById('c-eap');
  if (eapWrapper) {
    if (STATE.activeRole === 'grace_billing') {
      eapWrapper.textContent = '[CONFIDENTIAL FILTERED]';
    } else {
      eapWrapper.textContent = clientObj.eapSponsor;
    }
  }

  const badge = document.getElementById('c-consent-badge');
  badge.textContent = clientObj.consent.ai ? 'AI Consent Active' : 'Consent Locked';
  badge.style.background = clientObj.consent.ai ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  badge.style.color = clientObj.consent.ai ? 'var(--success-color)' : 'var(--danger-color)';
  
  document.getElementById('chk-consent-treatment').checked = clientObj.consent.treatment;
  document.getElementById('chk-consent-telehealth').checked = clientObj.consent.telehealth;
  document.getElementById('chk-consent-ai').checked = clientObj.consent.ai;
  document.getElementById('chk-consent-recording').checked = clientObj.consent.recording;
  
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    const tabName = btn.getAttribute('data-tab');
    if (STATE.activeRole === 'grace_billing' && tabName === 'tab-clinical-notes') {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-block';
    }
  });

  renderNotesList(clientObj);
  renderHomeworkList(clientObj);

  const geoObj = STATE.geoCrisisRegistry[clientObj.id] || { coords: 'Unknown', status: 'Unknown', contacts: 'No resources found' };
  document.getElementById('c-geo-coords').textContent = geoObj.coords;
  document.getElementById('c-geo-status').textContent = geoObj.status;
  document.getElementById('c-crisis-contacts').textContent = geoObj.contacts;
  
  logAudit('OPEN_RECORD', id, `Inspected patient file: ${clientObj.name}`);
}

function renderNotesList(clientObj) {
  const container = document.getElementById('client-notes-list');
  container.innerHTML = '';
  
  if (clientObj.notes.length === 0) {
    container.innerHTML = '<p class="fs-xs text-muted">No clinical notes recorded.</p>';
    return;
  }
  
  clientObj.notes.forEach(note => {
    const div = document.createElement('div');
    div.className = 'note-item';
    div.innerHTML = `
      <div class="note-item-meta">
        <span>Type: <strong>${note.type}</strong> | Author: ${note.author}</span>
        <span>Date: ${note.date}</span>
      </div>
      <div class="note-item-body">${note.body}</div>
    `;
    container.appendChild(div);
  });
}

document.getElementById('save-consent-btn').addEventListener('click', () => {
  if (!STATE.selectedClientId) return;
  const clientObj = STATE.clients.find(c => c.id === STATE.selectedClientId);
  
  clientObj.consent.treatment = document.getElementById('chk-consent-treatment').checked;
  clientObj.consent.telehealth = document.getElementById('chk-consent-telehealth').checked;
  clientObj.consent.ai = document.getElementById('chk-consent-ai').checked;
  clientObj.consent.recording = document.getElementById('chk-consent-recording').checked;
  
  showToast('Granular consent contracts updated.', 'success');
  selectClient(STATE.selectedClientId);
  logAudit('CONSENT_UPDATE', clientObj.id, `Consent grants altered: AI=${clientObj.consent.ai}, REC=${clientObj.consent.recording}`);
});

document.getElementById('client-search-input').addEventListener('input', renderClientList);

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');
    const parent = btn.closest('.client-detail-pane');
    
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(target).classList.add('active');
  });
});

document.getElementById('btn-trigger-gps-mock').addEventListener('click', () => {
  if (!STATE.selectedClientId) return;
  const coordsLabel = document.getElementById('c-geo-coords');
  coordsLabel.textContent = 'Querying cellular base stations...';
  
  setTimeout(() => {
    const clientObj = STATE.clients.find(c => c.id === STATE.selectedClientId);
    const geoObj = STATE.geoCrisisRegistry[clientObj.id];
    coordsLabel.textContent = geoObj.coords + ' (Refreshed)';
    logAudit('GEO_LOCATE', clientObj.id, `Refreshed cellular session coordinates: ${geoObj.coords}`);
  }, 1000);
});

// --- 6. KAIROS SCHEDULER ENGINE (M13) ---

const viewToggleBtns = document.querySelectorAll('#kairos-view-toggle button');
viewToggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    viewToggleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const targetView = btn.getAttribute('data-view');
    STATE.activeKairosView = targetView;
    renderKairos();
  });
});

function renderKairos() {
  document.querySelectorAll('.kairos-subview').forEach(v => v.classList.remove('active'));
  
  if (STATE.activeKairosView === 'canvas') {
    document.getElementById('kairos-canvas-view').classList.add('active');
    renderCanvasAppointments();
  } else if (STATE.activeKairosView === 'orbit') {
    document.getElementById('kairos-orbit-view').classList.add('active');
  } else if (STATE.activeKairosView === 'load') {
    document.getElementById('kairos-load-view').classList.add('active');
  } else if (STATE.activeKairosView === 'cadence') {
    document.getElementById('kairos-cadence-view').classList.add('active');
  }
}

function renderCanvasAppointments() {
  const row = document.getElementById('canvas-appointments-row');
  row.innerHTML = '';
  
  STATE.appointments.forEach((apt, idx) => {
    const div = document.createElement('div');
    div.className = `apt-block ${apt.active ? 'active-session' : ''}`;
    
    const colStart = (idx * 3) + 1;
    div.style.gridColumn = `${colStart} / span 2`;
    
    div.innerHTML = `
      <div>
        <div class="apt-title">${apt.clientName}</div>
        <div class="apt-time">${apt.timeStr} (${apt.timezone})</div>
      </div>
      <div class="apt-no-show no-show-${apt.noShowSeverity}">No-Show Risk: ${apt.noShowProb}</div>
    `;
    
    row.appendChild(div);
  });
}

// --- 7. TRAJECTORY OUTCOME VISUALIZER (M8) ---

const trajectoryClientSelect = document.getElementById('trajectory-client-select');
trajectoryClientSelect.addEventListener('change', renderTrajectoryChart);
document.getElementById('trajectory-instrument-select').addEventListener('change', renderTrajectoryChart);

function populateTrajectoryClients() {
  trajectoryClientSelect.innerHTML = '';
  STATE.clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    trajectoryClientSelect.appendChild(opt);
  });
  
  const fhirSelect = document.getElementById('fhir-patient-select');
  if (fhirSelect) {
    fhirSelect.innerHTML = '';
    STATE.clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      fhirSelect.appendChild(opt);
    });
  }
}

function renderTrajectoryChart() {
  const cId = trajectoryClientSelect.value || STATE.clients[0].id;
  const clientObj = STATE.clients.find(c => c.id === cId);
  const instrument = document.getElementById('trajectory-instrument-select').value;
  
  const container = document.getElementById('chart-svg-container');
  container.innerHTML = '';
  
  document.getElementById('chart-client-title').textContent = `${clientObj.name} — Expected vs. Actual Treatment Response`;
  
  const scores = clientObj.outcomeHistory[instrument] || [];
  
  let onTrack = true;
  if (scores.length > 0) {
    const lastScore = scores[scores.length - 1];
    if (scores.length >= 4 && lastScore > 12) {
      onTrack = false;
    }
  }
  
  const alertBadge = document.getElementById('chart-alert-badge');
  alertBadge.textContent = onTrack ? 'On-Track' : 'OFF-TRACK (ALERT)';
  alertBadge.style.background = onTrack ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  alertBadge.style.color = onTrack ? 'var(--success-color)' : 'var(--danger-color)';
  alertBadge.style.border = `1px solid ${onTrack ? 'var(--success-color)' : 'var(--danger-color)'}`;

  const metricsBlock = document.getElementById('trajectory-metrics-block');
  const baseScore = scores[0] || 0;
  const currentScore = scores[scores.length - 1] || 0;
  const changeVal = baseScore - currentScore;
  const rci = (changeVal * 0.75).toFixed(1);
  
  metricsBlock.innerHTML = `
    <div class="metrics-summary-item">
      <span>Baseline Score:</span>
      <strong>${baseScore}</strong>
    </div>
    <div class="metrics-summary-item">
      <span>Current Score:</span>
      <strong>${currentScore}</strong>
    </div>
    <div class="metrics-summary-item">
      <span>Delta Reduction:</span>
      <strong class="text-success">${changeVal > 0 ? '-' + changeVal : changeVal}</strong>
    </div>
    <div class="metrics-summary-item">
      <span>Reliable Change Index (RCI):</span>
      <strong class="${rci >= 5 ? 'text-success' : 'text-danger'}">${rci} ${rci >= 5 ? '(Clinically Sig)' : '(No Change)'}</strong>
    </div>
  `;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 500 250");
  svg.style.background = "var(--bg-darker)";

  const expectedPolygon = document.createElementNS(svgNS, "polygon");
  expectedPolygon.setAttribute("points", "50,80 120,95 190,120 260,150 330,170 400,180 400,210 330,195 260,175 190,140 120,115 50,100");
  expectedPolygon.setAttribute("fill", "rgba(0, 242, 254, 0.08)");
  expectedPolygon.setAttribute("stroke", "rgba(0, 242, 254, 0.2)");
  expectedPolygon.setAttribute("stroke-dasharray", "4,4");
  svg.appendChild(expectedPolygon);

  const riskLine = document.createElementNS(svgNS, "line");
  riskLine.setAttribute("x1", "40");
  riskLine.setAttribute("y1", "150");
  riskLine.setAttribute("x2", "450");
  riskLine.setAttribute("y2", "150");
  riskLine.setAttribute("stroke", "var(--danger-color)");
  riskLine.setAttribute("stroke-dasharray", "5,5");
  riskLine.setAttribute("opacity", "0.6");
  svg.appendChild(riskLine);

  for (let i = 1; i <= 4; i++) {
    const gridY = 50 * i;
    const gridLine = document.createElementNS(svgNS, "line");
    gridLine.setAttribute("x1", "40");
    gridLine.setAttribute("y1", gridY);
    gridLine.setAttribute("x2", "450");
    gridLine.setAttribute("y2", gridY);
    gridLine.setAttribute("stroke", "rgba(255,255,255,0.03)");
    svg.appendChild(gridLine);
  }

  if (scores.length > 0) {
    let pathPoints = "";
    scores.forEach((sc, i) => {
      const x = 50 + (i * 70);
      const y = 220 - ((sc / 24) * 200);
      pathPoints += `${x},${y} `;
      
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", "5");
      circle.setAttribute("fill", "var(--neon-blue)");
      svg.appendChild(circle);
      
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", x);
      text.setAttribute("y", y - 10);
      text.setAttribute("fill", "#fff");
      text.setAttribute("font-size", "10px");
      text.setAttribute("text-anchor", "middle");
      text.textContent = sc;
      svg.appendChild(text);
    });

    const clientPath = document.createElementNS(svgNS, "polyline");
    clientPath.setAttribute("points", pathPoints.trim());
    clientPath.setAttribute("fill", "none");
    clientPath.setAttribute("stroke", "var(--neon-blue)");
    clientPath.setAttribute("stroke-width", "3");
    svg.appendChild(clientPath);
  }

  const yLabel = document.createElementNS(svgNS, "text");
  yLabel.setAttribute("x", "10");
  yLabel.setAttribute("y", "20");
  yLabel.setAttribute("fill", "var(--font-muted)");
  yLabel.setAttribute("font-size", "10px");
  yLabel.textContent = "Score";
  svg.appendChild(yLabel);

  for (let i = 0; i < 6; i++) {
    const xLabel = document.createElementNS(svgNS, "text");
    xLabel.setAttribute("x", 50 + (i * 70));
    xLabel.setAttribute("y", "240");
    xLabel.setAttribute("fill", "var(--font-muted)");
    xLabel.setAttribute("font-size", "10px");
    xLabel.setAttribute("text-anchor", "middle");
    xLabel.textContent = `S${i+1}`;
    svg.appendChild(xLabel);
  }

  container.appendChild(svg);
}

// --- 8. PULSE EVENTS & ALERTS ENGINE (M16) ---

function renderAlertPills() {
  const container = document.getElementById('alert-trigger');
  container.innerHTML = '';
  
  const categories = ['s1', 's2', 's4'];
  const colors = { s1: 's1', s2: 's2', s4: 's4' };
  
  categories.forEach(cat => {
    const count = STATE.alerts.filter(a => a.severity === cat && a.status === 'pending').length;
    
    const div = document.createElement('div');
    div.className = `alert-pill ${colors[cat]} ${count === 0 ? 'alert-clear' : ''}`;
    div.innerHTML = `
      <span class="alert-dot"></span>
      <span class="alert-lbl">${cat.toUpperCase()}</span>
      <span class="alert-count">${count}</span>
    `;
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      openAlertTriageList(cat);
    });
    container.appendChild(div);
  });
}

function openAlertTriageList(severityFilter) {
  const alertsList = STATE.alerts.filter(a => a.severity === severityFilter && a.status === 'pending');
  if (alertsList.length === 0) {
    alert(`No pending ${severityFilter.toUpperCase()} alerts.`);
    return;
  }
  
  const targetAlert = alertsList[0];
  const modal = document.getElementById('modal-alert-triage');
  document.getElementById('alert-title-modal').textContent = `Pulse Alert Details [${targetAlert.severity.toUpperCase()}]`;
  document.getElementById('alert-details-summary').innerHTML = `
    <p class="mb-2"><strong>Source Module:</strong> ${targetAlert.source}</p>
    <p class="mb-2"><strong>Alarm Type:</strong> ${targetAlert.type}</p>
    <p class="mb-3"><strong>Trigger Event:</strong> ${targetAlert.message}</p>
    <div class="alert alert-danger" style="font-family: monospace; font-size: 0.8rem; margin: 10px 0;">
      Diagnostics: ${targetAlert.details}
    </div>
    <span class="fs-xs font-muted">Incident Log: ${targetAlert.timestamp}</span>
  `;
  
  const actionBtn = document.getElementById('submit-alert-triage-btn');
  const codeSelect = document.getElementById('alert-outcome-code');
  
  const newActionBtn = actionBtn.cloneNode(true);
  actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);
  
  newActionBtn.addEventListener('click', () => {
    targetAlert.status = 'closed';
    targetAlert.resolution = codeSelect.value;
    modal.classList.remove('active');
    
    renderAlertPills();
    renderPulseLogs();
    logAudit('ALERT_DISMISS', targetAlert.id, `Alert resolved with resolution code: ${codeSelect.value}`);
  });

  modal.classList.add('active');
}

function renderPulseLogs() {
  const tbody = document.getElementById('dashboard-pulse-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  STATE.alerts.forEach(a => {
    const tr = document.createElement('tr');
    tr.style.opacity = a.status === 'closed' ? 0.5 : 1;
    tr.innerHTML = `
      <td>${a.timestamp.slice(11)}</td>
      <td>${a.source}</td>
      <td><strong>${a.type}</strong></td>
      <td><span class="badge badge-${a.severity}">${a.severity.toUpperCase()}</span></td>
      <td>${a.message}</td>
      <td>
        ${a.status === 'pending' 
          ? `<button class="btn btn-xs btn-primary" onclick="window.pulseTriage('${a.severity}')">Triage</button>`
          : `<span class="text-success fs-xs font-mono">CLOSED</span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.pulseTriage = function(sev) {
  openAlertTriageList(sev);
};

// --- 9. SAGE AI: AMBIENT TRANSCRIPTION ENGINE (M21) ---

const micBtn = document.getElementById('sage-mic-btn');
const micTxt = document.getElementById('sage-mic-txt');
const generateBtn = document.getElementById('sage-generate-btn');
const waveDiv = document.getElementById('audio-wave');
const transFeed = document.getElementById('live-transcription-feed');
const aiDraftDiv = document.getElementById('sage-ai-draft-content');
const clinicianTextarea = document.getElementById('clinician-note-textarea');
const signNoteBtn = document.getElementById('btn-save-note');
const provenanceDiv = document.getElementById('note-provenance-info');

const MOCK_DIALOGUE = [
  "[00:05] Joel (Clinician): Hi Amina, thanks for sharing that. I see your scores dropped down again.",
  "[00:15] Amina (Client): Yes, I've been doing the breathing exercises when I feel the panic build at work.",
  "[00:30] Joel: Excellent. Let's write down the cognitive restructuring outcomes we worked on.",
  "[00:45] Amina: Okay, I recognized that when my boss asks to speak, it doesn't mean I am getting fired."
];

micBtn.addEventListener('click', () => {
  if (STATE.isRecording) {
    STATE.isRecording = false;
    micBtn.classList.remove('recording');
    micTxt.textContent = 'Capture Stopped';
    waveDiv.classList.remove('active');
    clearInterval(STATE.recordingInterval);
    generateBtn.removeAttribute('disabled');
  } else {
    STATE.isRecording = true;
    micBtn.classList.add('recording');
    micTxt.textContent = 'Transcribing Live Audio...';
    waveDiv.classList.add('active');
    transFeed.textContent = '';
    
    let step = 0;
    STATE.recordingInterval = setInterval(() => {
      if (step < MOCK_DIALOGUE.length) {
        const p = document.createElement('p');
        p.textContent = MOCK_DIALOGUE[step];
        transFeed.appendChild(p);
        transFeed.scrollTop = transFeed.scrollHeight;
        step++;
      } else {
        clearInterval(STATE.recordingInterval);
        STATE.isRecording = false;
        micBtn.classList.remove('recording');
        micTxt.textContent = 'Ambient Captured';
        waveDiv.classList.remove('active');
        generateBtn.removeAttribute('disabled');
      }
    }, 1500);
  }
});

generateBtn.addEventListener('click', () => {
  aiDraftDiv.textContent = 'Calling Claude 3.5 ZDR inference endpoint...';
  
  setTimeout(() => {
    const activeTemplate = document.querySelector('input[name="note-template"]:checked').value;
    let draft = "";
    
    if (activeTemplate === 'soap') {
      draft = `SUBJECTIVE:\nClient Amina Omondi reports reduced panic events at work. Actively applies 4-7-8 breathing coping mechanics during triggers.\n\nOBJECTIVE:\nAttentive, calm speech cadence. Good alignment with CBT tasks.\n\nASSESSMENT:\nCognitive restructuring of panic trigger is progressing. RCI indicators confirm improvement.\n\nPLAN:\nContinue double-column cognitive diary targets weekly.`;
    } else if (activeTemplate === 'cbt') {
      draft = `CBT THOUGHT TARGET:\nTrigger: Boss requested a short meeting.\nAutomatic Thought: "I am going to get fired" (Distortion: Catastrophizing).\nBalanced Alternative: "Meetings are standard practice. My recent evaluation was positive."`;
    } else {
      draft = `EMDR PROTOCOL PHASE 4:\nTarget Memory: Promotion board feedback.\nCurrent SUDs: 3 (from 7).\nVOC: 5 (from 2).\nInteroceptive check: Clear chest breathing.`;
    }

    aiDraftDiv.textContent = 'Streaming draft response...';
    streamText(aiDraftDiv, draft, 3, () => {
      clinicianTextarea.value = draft;
      clinicianTextarea.removeAttribute('disabled');
      signNoteBtn.removeAttribute('disabled');
      const timestamp = new Date().toISOString();
      provenanceDiv.innerHTML = `<strong>Sage Provenance:</strong> Model=claude-3.5-sonnet-zdr | PromptVer=v2.1 | KMS_DEK=<code>kms_tn_nbo_0940</code> | Time=${timestamp} | Status=Draft Pending Clinician Signature`;
    });
  }, 800);
});

signNoteBtn.addEventListener('click', () => {
  if (!STATE.selectedClientId) {
    alert('Select client to assign signed note.');
    return;
  }
  const clientObj = STATE.clients.find(c => c.id === STATE.selectedClientId);
  const noteContent = clinicianTextarea.value.trim();
  
  const newNote = {
    id: `n_${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    author: 'Joel Mwangi',
    type: 'Sage-Assisted Note',
    body: noteContent
  };
  
  clientObj.notes.unshift(newNote);
  renderNotesList(clientObj);
  
  showToast('Ambient Note signed, hash-chained and locked into Master clinical file.', 'success');
  logAudit('SAVE_NOTE', clientObj.id, 'Signed Sage AI-assisted clinical note.');
  
  clinicianTextarea.setAttribute('disabled', 'true');
  signNoteBtn.setAttribute('disabled', 'true');
  generateBtn.setAttribute('disabled', 'true');
});

// --- 10. ATHENAEUM KNOWLEDGE HYBRID SEARCH (M20) ---

document.getElementById('athenaeum-search-btn').addEventListener('click', renderAthenaeumResults);

const lexicalBtn = document.getElementById('search-mode-lexical');
const semanticBtn = document.getElementById('search-mode-semantic');

lexicalBtn.addEventListener('click', () => {
  lexicalBtn.classList.add('active');
  semanticBtn.classList.remove('active');
  STATE.athenaeumSearchMode = 'lexical';
});

semanticBtn.addEventListener('click', () => {
  semanticBtn.classList.add('active');
  lexicalBtn.classList.remove('active');
  STATE.athenaeumSearchMode = 'semantic';
});

function renderAthenaeumResults() {
  const container = document.getElementById('athenaeum-results-list');
  container.innerHTML = '';
  
  const query = document.getElementById('athenaeum-search-query').value.toLowerCase().trim();
  
  const results = STATE.resources.map(res => {
    let score = 0;
    if (STATE.athenaeumSearchMode === 'lexical') {
      if (res.title.toLowerCase().includes(query)) score += 5;
      res.tags.forEach(t => {
        if (query.includes(t.toLowerCase())) score += 2;
      });
    } else {
      if (query.includes('panic') && res.title.includes('Panic')) score = 0.94;
      else if (query.includes('anxiety') && res.title.includes('Anxiety')) score = 0.89;
      else if (query.includes('crisis') && res.title.includes('Distress')) score = 0.92;
      else if (query.includes('career') && res.title.includes('Vocational')) score = 0.95;
      else if (query.includes('spiritual') && res.title.includes('Spiritual')) score = 0.96;
      else if (query.includes('adherence') && res.title.includes('Illness')) score = 0.91;
      else score = (0.50 + Math.random() * 0.25).toFixed(2);
    }
    return { ...res, score };
  });

  const filtered = results.filter(r => r.score > 0).sort((a,b) => b.score - a.score);
  document.getElementById('results-count-lbl').textContent = `${filtered.length} items matched`;
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="p-3 text-muted fs-xs">No matching protocols in library registry.</div>';
    return;
  }

  filtered.forEach(res => {
    const div = document.createElement('div');
    div.className = 'athenaeum-item';
    
    const scoreBadge = STATE.athenaeumSearchMode === 'semantic' 
      ? `<span class="tag tag-semantic-score">Cosine Similarity: ${res.score}</span>`
      : `<span class="tag">Match Score: ${res.score}</span>`;
      
    div.innerHTML = `
      <h4>${res.title}</h4>
      <div class="meta-row">
        <span>Authors: ${res.authors} (${res.year})</span>
        <span>DOI: <a href="https://doi.org/${res.doi}" target="_blank" class="text-teal">${res.doi}</a></span>
      </div>
      <p class="mb-2 text-secondary">${res.summary}</p>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${scoreBadge}
        <span class="tag">Evidence: ${res.evidenceLevel}</span>
        ${res.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
      </div>
    `;
    container.appendChild(div);
  });
}

// --- 11. BILLING ENGINE & eTIMS MULTI-CHANNEL (M18) ---

function renderInvoiceList() {
  const container = document.getElementById('invoice-list-container');
  container.innerHTML = '';
  
  const filtered = STATE.invoices.filter(inv => {
    if (STATE.activeRole === 'client_amina') {
      return inv.clientName === 'Amina Omondi';
    }
    return true;
  });

  filtered.forEach(inv => {
    const div = document.createElement('div');
    div.className = `invoice-item ${STATE.selectedInvoiceId === inv.id ? 'active' : ''}`;
    div.innerHTML = `
      <div class="invoice-item-top">
        <h4>${inv.clientName}</h4>
        <span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-danger'}">${inv.status}</span>
      </div>
      <div class="invoice-item-meta">
        <span>ID: ${inv.id}</span>
        <strong>${inv.amount}</strong>
      </div>
    `;
    div.addEventListener('click', () => selectInvoice(inv.id));
    container.appendChild(div);
  });
}

function selectInvoice(id) {
  STATE.selectedInvoiceId = id;
  renderInvoiceList();
  
  const inv = STATE.invoices.find(i => i.id === id);
  const detail = document.getElementById('invoice-details-content');
  const placeholder = document.getElementById('billing-details-placeholder');
  
  placeholder.classList.add('hidden');
  detail.classList.remove('hidden');
  
  document.getElementById('inv-client-name').textContent = inv.clientName;
  document.getElementById('inv-id-label').textContent = `Invoice ID: ${inv.id}`;
  document.getElementById('inv-amount').textContent = inv.amount;
  
  const statusBadge = document.getElementById('inv-status-badge');
  statusBadge.className = `invoice-status-badge badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-danger'}`;
  statusBadge.textContent = inv.status;

  const etimsSection = document.getElementById('etims-section');
  const etimsSig = document.getElementById('etims-signature');
  const etimsBuyerPin = document.getElementById('etims-buyer-pin');
  const viewReceiptBtn = document.getElementById('btn-open-receipt');
  
  // Show KRA compliance calculations details for Kenyan Shilling (KES) profiles
  if (inv.currency === 'KES') {
    etimsSection.style.display = 'block';
    etimsSig.textContent = inv.eTimsSig;
    etimsBuyerPin.value = inv.buyerPin || 'A009187364B';
  } else {
    etimsSection.style.display = 'block';
    etimsSig.textContent = 'Exempt (Cross-border Export)';
    etimsBuyerPin.value = 'N/A';
  }

  // Show printable eTIMS receipt button if invoice is paid
  if (inv.status === 'Paid') {
    viewReceiptBtn.classList.remove('hidden');
  } else {
    viewReceiptBtn.classList.add('hidden');
  }
}

// Payment Option Toggles
const payTabs = ['mpesa', 'airtel', 'card', 'bank'];
payTabs.forEach(t => {
  const btn = document.getElementById(`pay-tab-${t}`);
  if (btn) {
    btn.addEventListener('click', () => {
      payTabs.forEach(tab => {
        document.getElementById(`pay-tab-${tab}`).style.background = 'transparent';
        document.getElementById(`pay-tab-${tab}`).style.color = 'var(--font-secondary)';
        document.getElementById(`pane-${tab}`).classList.add('hidden');
      });
      btn.style.background = 'var(--btn-bg)';
      btn.style.color = '#fff';
      document.getElementById(`pane-${t}`).classList.remove('hidden');
      STATE.activePaymentTab = t;
    });
  }
});

// Checkout Flows trigger
document.getElementById('btn-trigger-stk').addEventListener('click', () => {
  if (!STATE.selectedInvoiceId) return;
  const inv = STATE.invoices.find(i => i.id === STATE.selectedInvoiceId);
  const logDiv = document.getElementById('stk-push-logs');
  
  logDiv.textContent = `[12:31:05] Calling Safaricom C2B Daraja API endpoint...\n`;
  logDiv.textContent += `[12:31:07] AccessToken verified. Initiating STK push to ${inv.clientName}...\n`;
  
  setTimeout(() => {
    logDiv.textContent += `[12:31:10] STK status: PENDING_USER_PIN_ENTRY (MerchantID: req_883a)\n`;
    
    setTimeout(() => {
      logDiv.textContent += `[12:31:12] Safaricom Callback Success (ResultCode: 0)\n`;
      
      inv.status = 'Paid';
      inv.paymentChannel = 'M-Pesa Mobile';
      inv.paymentRef = 'M-PESA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      if (inv.currency === 'KES') {
        inv.eTimsSig = `KRA-ETIMS-20260820-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        document.getElementById('etims-signature').textContent = inv.eTimsSig;
      }
      
      selectInvoice(inv.id);
      renderInvoiceList();
      logAudit('PAYMENT_RECEIVED', inv.id, `M-Pesa STK push callback resolved: Ref=${inv.paymentRef}`);
    }, 2000);
  }, 1500);
});

document.getElementById('btn-trigger-airtel').addEventListener('click', () => {
  if (!STATE.selectedInvoiceId) return;
  const inv = STATE.invoices.find(i => i.id === STATE.selectedInvoiceId);
  const logDiv = document.getElementById('airtel-push-logs');
  
  logDiv.textContent = `[12:35:01] Airtel Money API Handshake initiated...\n`;
  logDiv.textContent += `[12:35:03] Airtel STK Push sent to terminal (+254 733...)\n`;
  
  setTimeout(() => {
    logDiv.textContent += `[12:35:06] Merchant Interoperability OK. Transaction verified.\n`;
    
    inv.status = 'Paid';
    inv.paymentChannel = 'Airtel Money';
    inv.paymentRef = 'AIRTEL-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    if (inv.currency === 'KES') {
      inv.eTimsSig = `KRA-ETIMS-20260820-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      document.getElementById('etims-signature').textContent = inv.eTimsSig;
    }
    
    selectInvoice(inv.id);
    renderInvoiceList();
    logAudit('PAYMENT_RECEIVED', inv.id, `Airtel money billing resolved: Ref=${inv.paymentRef}`);
  }, 2000);
});

document.getElementById('btn-trigger-card').addEventListener('click', () => {
  if (!STATE.selectedInvoiceId) return;
  const inv = STATE.invoices.find(i => i.id === STATE.selectedInvoiceId);
  const cardNum = document.getElementById('card-num-input').value.trim();
  
  if (cardNum.length < 12) {
    showToast('Please enter a valid credit card sequence.', 'warning');
    return;
  }
  
  alert('Connecting checkout token to Mastercard/Visa 3D-Secure 2.0 authorization directory...');
  
  inv.status = 'Paid';
  inv.paymentChannel = 'Card payment';
  inv.paymentRef = 'VISA-MC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  
  if (inv.currency === 'KES') {
    inv.eTimsSig = `KRA-ETIMS-20260820-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }
  
  selectInvoice(inv.id);
  renderInvoiceList();
  logAudit('PAYMENT_RECEIVED', inv.id, `Card checkout authorized: Ref=${inv.paymentRef}`);
});

document.getElementById('btn-trigger-bank').addEventListener('click', () => {
  if (!STATE.selectedInvoiceId) return;
  const inv = STATE.invoices.find(i => i.id === STATE.selectedInvoiceId);
  const ref = document.getElementById('bank-ref-input').value.trim();
  
  if (ref.length === 0) {
    alert('Please enter deposit slip transaction reference.');
    return;
  }
  
  alert(`Verifying deposit slip ${ref} with local treasury ledger...`);
  
  inv.status = 'Paid';
  inv.paymentChannel = 'Bank Transfer';
  inv.paymentRef = 'BANK-REF-' + ref;
  
  if (inv.currency === 'KES') {
    inv.eTimsSig = `KRA-ETIMS-20260820-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }
  
  selectInvoice(inv.id);
  renderInvoiceList();
  logAudit('PAYMENT_RECEIVED', inv.id, `Bank slip reference mapped and closed: Ref=${inv.paymentRef}`);
});

// Create Invoice Popups
document.getElementById('btn-show-create-invoice').addEventListener('click', () => {
  const select = document.getElementById('create-inv-client');
  select.innerHTML = '';
  STATE.clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.location})`;
    select.appendChild(opt);
  });
  document.getElementById('modal-create-invoice').classList.add('active');
});

document.getElementById('submit-create-invoice').addEventListener('click', () => {
  const cId = document.getElementById('create-inv-client').value;
  const clientObj = STATE.clients.find(c => c.id === cId);
  const amount = parseFloat(document.getElementById('create-inv-amount').value);
  const currency = document.getElementById('create-inv-currency').value;
  const desc = document.getElementById('create-inv-desc').value.trim();
  
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter valid positive fee amount.');
    return;
  }
  
  const invId = `INV-2026-${Math.floor(Math.random() * 900) + 100}`;
  const newInvoice = {
    id: invId,
    clientName: clientObj.name,
    amountNum: amount,
    currency: currency,
    amount: `${currency} ${amount.toLocaleString()}`,
    date: new Date().toISOString().split('T')[0],
    status: 'Unpaid',
    eTimsSig: currency === 'KES' ? 'Pending Signature' : 'Exempt (Cross-border)',
    buyerPin: clientObj.location.includes('Kenya') ? 'A009187364B' : '',
    desc: desc,
    paymentChannel: 'N/A',
    paymentRef: 'N/A'
  };
  
  STATE.invoices.unshift(newInvoice);
  renderInvoiceList();
  document.getElementById('modal-create-invoice').classList.remove('active');
  logAudit('CREATE_INVOICE', invId, `New invoice generated for client: ${clientObj.name}`);
});

// Printable eTIMS Receipts popup
document.getElementById('btn-open-receipt').addEventListener('click', () => {
  if (!STATE.selectedInvoiceId) return;
  const inv = STATE.invoices.find(i => i.id === STATE.selectedInvoiceId);
  
  document.getElementById('receipt-no-label').textContent = 'RPT-' + inv.id.split('-')[1] + inv.id.split('-')[2];
  document.getElementById('receipt-client-name').textContent = inv.clientName;
  document.getElementById('receipt-date').textContent = inv.date;
  document.getElementById('receipt-payment-channel').textContent = inv.paymentChannel;
  document.getElementById('receipt-payment-ref').textContent = inv.paymentRef;
  document.getElementById('receipt-desc').textContent = inv.desc;
  
  // Tax calculations
  let subtotalNet = inv.amountNum;
  let vat = 0;
  
  if (inv.currency === 'KES') {
    // 16% VAT compliance
    subtotalNet = inv.amountNum / 1.16;
    vat = inv.amountNum - subtotalNet;
    document.getElementById('receipt-net-total').textContent = `KES ${subtotalNet.toFixed(2)}`;
    document.getElementById('receipt-subtotal-net').textContent = `KES ${subtotalNet.toFixed(2)}`;
    document.getElementById('receipt-vat').textContent = `KES ${vat.toFixed(2)}`;
    document.getElementById('receipt-total-paid').textContent = `KES ${inv.amountNum.toLocaleString()}`;
    document.getElementById('receipt-etims-sig').textContent = inv.eTimsSig;
  } else {
    document.getElementById('receipt-net-total').textContent = `${inv.currency} ${inv.amountNum.toFixed(2)}`;
    document.getElementById('receipt-subtotal-net').textContent = `${inv.currency} ${inv.amountNum.toFixed(2)}`;
    document.getElementById('receipt-vat').textContent = `0.00 (Exempt Export)`;
    document.getElementById('receipt-total-paid').textContent = `${inv.currency} ${inv.amountNum.toLocaleString()}`;
    document.getElementById('receipt-etims-sig').textContent = 'Exempt (Art. 72 POPIA / HIPAA Out)';
  }
  
  document.getElementById('modal-view-receipt').classList.add('active');
  logAudit('VIEW_RECEIPT', inv.id, `Printed KRA eTIMS invoice receipt.`);
});

// --- 12. COMPLIANCE & SECURITY DRILLS (M22) ---

document.getElementById('btn-run-audit-drill').addEventListener('click', () => {
  const code = confirm('Initiating platform-wide compliance and security fire drill. This verifies data residency assertions and encrypts transaction blocks. Proceed?');
  if (!code) return;
  
  alert('Fire drill active. Verifying Nairobi Cell storage blocks...');
  
  setTimeout(() => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newTx = {
      id: `TX-${Math.floor(Math.random() * 900) + 100}`,
      timestamp: timestamp,
      role: 'Platform Auditor',
      purpose: 'COMPLIANCE_DRILL',
      scope: 'Global Cell',
      action: 'Data residency assertions matching regional key: tn_nbo. Vault keys verified.',
      hash: Math.random().toString(16).substring(2, 18) + 'e3b0c44298fc1c14'
    };
    STATE.auditLedger.unshift(newTx);
    renderAuditLedger();
    showToast('Security verification drill PASSED. Residency asserted.', 'success');
  }, 1000);
});

function renderAuditLedger() {
  const tbody = document.getElementById('audit-ledger-tbody');
  tbody.innerHTML = '';
  
  STATE.auditLedger.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${tx.id}</strong></td>
      <td>${tx.timestamp}</td>
      <td>${tx.role}</td>
      <td><code>${tx.purpose}</code></td>
      <td>${tx.scope}</td>
      <td>${tx.action}</td>
      <td class="font-mono fs-xs" style="font-family: monospace; font-size: 0.75rem;">${tx.hash.slice(0, 20)}...</td>
    `;
    tbody.appendChild(tr);
  });
}

function logAudit(purpose, scope, action) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newTx = {
    id: `TX-${Math.floor(Math.random() * 900) + 100}`,
    timestamp: timestamp,
    role: STATE.activeRole === 'joel' ? 'Joel Mwangi (Clinician)' : STATE.activeRole,
    purpose: purpose,
    scope: scope || 'Global Cell',
    action: action,
    hash: Math.random().toString(16).substring(2, 18) + 'f8983802e86bb5f'
  };
  STATE.auditLedger.unshift(newTx);
  renderAuditLedger();
}

// --- 13. PERSONA SWITCHER SETUP (RBAC OVERLAYS) ---

document.getElementById('role-selector-btn').addEventListener('click', () => {
  document.getElementById('modal-role-selector').classList.add('active');
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  });
});

document.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    
    STATE.activeRole = card.getAttribute('data-role');
    document.getElementById('modal-role-selector').classList.remove('active');
    
    STATE.breakGlassAuthorized = false;
    alarmBanner.classList.add('hidden');
    clearInterval(STATE.alarmTimer);

    applyRBACPermissions();
    document.querySelector('.nav-link[data-target="dashboard-view"]').click();
  });
});

// --- 14. EXPANSION: ACTIVE JURISDICTION REGIME (M22) ---

const jurSelect = document.getElementById('sys-jurisdiction-select');
jurSelect.addEventListener('change', () => {
  STATE.activeJurisdiction = jurSelect.value;
  const jurObj = STATE.jurisdictions[STATE.activeJurisdiction];
  
  document.getElementById('jurisdiction-pill').innerHTML = `Jurisdiction: <strong>${jurObj.name}</strong>`;
  alert(`[JURISDICTION SWITCH] Active operational cell shifted to [${jurObj.residency}]. Compliance rules and legal frameworks re-compiled.`);
  
  if (STATE.selectedClientId) {
    const clientObj = STATE.clients.find(c => c.id === STATE.selectedClientId);
    logAudit('JURISDICTION_CHANGE', clientObj.id, `Shifting jurisdiction audit rules to: ${jurObj.name}`);
  }

  applyJurisdictionChecks();
});

function applyJurisdictionChecks() {
  const jurObj = STATE.jurisdictions[STATE.activeJurisdiction];
  
  const checklistLabels = document.querySelectorAll('.consent-checklist label span');
  if (checklistLabels.length >= 4) {
    checklistLabels[0].textContent = jurObj.consents[0];
    checklistLabels[1].textContent = jurObj.consents[1];
    checklistLabels[2].textContent = jurObj.consents[2];
    checklistLabels[3].textContent = jurObj.consents[3];
  }
}

// --- 15. EXPANSION: SVG GENOGRAM CANVAS EDITOR (M11) ---

const modToggleBtns = document.querySelectorAll('#modality-view-toggle button');
modToggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modToggleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const targetMod = btn.getAttribute('data-mod');
    document.querySelectorAll('.modality-subview').forEach(v => v.classList.add('hidden'));
    document.getElementById(`modality-${targetMod}-subview`).classList.remove('hidden');
    
    if (targetMod === 'genogram') {
      renderGenogram();
    }
  });
});

function renderGenogram() {
  const svg = document.getElementById('genogram-svg');
  if (!svg) return;
  svg.innerHTML = '';
  
  STATE.genogram.links.forEach(l => {
    const sNode = STATE.genogram.nodes.find(n => n.id === l.source);
    const tNode = STATE.genogram.nodes.find(n => n.id === l.target);
    if (!sNode || !tNode) return;
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.className = 'geno-link';
    line.setAttribute('x1', sNode.x);
    line.setAttribute('y1', sNode.y);
    line.setAttribute('x2', tNode.x);
    line.setAttribute('y2', tNode.y);
    
    if (l.relation === 'spouse') {
      line.setAttribute('stroke-dasharray', '0');
    } else {
      line.setAttribute('stroke-dasharray', '5,5');
    }
    
    svg.appendChild(line);
  });

  STATE.genogram.nodes.forEach(n => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.className = `geno-node ${n.selected ? 'geno-node-selected' : ''}`;
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNodeSelection(n.id);
    });

    if (n.gender === 'male') {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute('x', n.x - 20);
      rect.setAttribute('y', n.y - 20);
      rect.setAttribute('width', 40);
      rect.setAttribute('height', 40);
      rect.setAttribute('fill', n.selected ? 'var(--neon-teal)' : 'var(--bg-secondary)');
      rect.setAttribute('stroke', 'var(--neon-blue)');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('rx', '4');
      g.appendChild(rect);
    } else {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute('cx', n.x);
      circle.setAttribute('cy', n.y);
      circle.setAttribute('r', 20);
      circle.setAttribute('fill', n.selected ? 'var(--neon-teal)' : 'var(--bg-secondary)');
      circle.setAttribute('stroke', 'var(--neon-blue)');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute('x', n.x);
    text.setAttribute('y', n.y + 35);
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-size', '10px');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = n.label;
    g.appendChild(text);

    svg.appendChild(g);
  });
}

function toggleNodeSelection(id) {
  const node = STATE.genogram.nodes.find(n => n.id === id);
  node.selected = !node.selected;
  
  if (node.selected) {
    STATE.selectedGenoNodes.push(id);
  } else {
    STATE.selectedGenoNodes = STATE.selectedGenoNodes.filter(nId => nId !== id);
  }
  renderGenogram();
}

document.getElementById('btn-geno-add-male').addEventListener('click', () => {
  const label = prompt('Enter name label:');
  if (!label) return;
  
  const id = `g_${Date.now()}`;
  STATE.genogram.nodes.push({
    id: id,
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 150,
    gender: 'male',
    label: label,
    selected: false
  });
  renderGenogram();
});

document.getElementById('btn-geno-add-female').addEventListener('click', () => {
  const label = prompt('Enter name label:');
  if (!label) return;
  
  const id = `g_${Date.now()}`;
  STATE.genogram.nodes.push({
    id: id,
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 150,
    gender: 'female',
    label: label,
    selected: false
  });
  renderGenogram();
});

document.getElementById('btn-geno-connect').addEventListener('click', () => {
  if (STATE.selectedGenoNodes.length !== 2) {
    alert('Please select exactly two nodes to connect.');
    return;
  }
  const rel = prompt('Enter connection relationship (spouse / parent):');
  if (!rel) return;
  
  STATE.genogram.links.push({
    source: STATE.selectedGenoNodes[0],
    target: STATE.selectedGenoNodes[1],
    relation: rel
  });
  
  STATE.genogram.nodes.forEach(n => n.selected = false);
  STATE.selectedGenoNodes = [];
  renderGenogram();
});

document.getElementById('btn-geno-clear').addEventListener('click', () => {
  STATE.genogram.nodes = [];
  STATE.genogram.links = [];
  STATE.selectedGenoNodes = [];
  renderGenogram();
});

const couplesPolicySelect = document.getElementById('couples-policy-select');
couplesPolicySelect.addEventListener('change', () => {
  const policy = couplesPolicySelect.value;
  const maskBox = document.getElementById('partner-a-note-mask');
  
  if (policy === 'no-secrets') {
    maskBox.className = 'alert alert-warning';
    maskBox.textContent = '"Partner A admitted feeling ongoing marital stress regarding domestic financial splits."';
  } else {
    maskBox.className = 'alert alert-danger';
    maskBox.textContent = '[MASKED: Individual session secrets active under Secrets Policy Contract]';
  }
});

// --- 16. EXPANSION: CLINICAL SUPERVISION review and video scrubbers (M12) ---

const playBtn = document.getElementById('btn-video-play');
const progressBar = document.getElementById('video-progress-fill');
const timeLabel = document.getElementById('video-time-lbl');
const annotationList = document.getElementById('supervision-notes-list');

playBtn.addEventListener('click', () => {
  if (STATE.videoPlaybackActive) {
    STATE.videoPlaybackActive = false;
    playBtn.textContent = '▶ Play';
    clearInterval(STATE.videoInterval);
  } else {
    STATE.videoPlaybackActive = true;
    playBtn.textContent = '⏸ Pause';
    
    STATE.videoInterval = setInterval(() => {
      STATE.videoTimeSeconds++;
      if (STATE.videoTimeSeconds >= 3000) {
        STATE.videoTimeSeconds = 0;
      }
      
      const progressPercent = (STATE.videoTimeSeconds / 3000) * 100;
      progressBar.style.width = `${progressPercent}%`;
      timeLabel.textContent = `${formatVideoTime(STATE.videoTimeSeconds)} / 50:00`;
    }, 1000);
  }
});

function formatVideoTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderSupervisionTimeline() {
  annotationList.innerHTML = '';
  STATE.supervisionNotes.forEach((n, idx) => {
    const item = document.createElement('div');
    item.className = 'triage-item';
    item.style.padding = '0.5rem';
    item.innerHTML = `
      <div class="triage-info">
        <h5><span class="annotated-time">[${n.time}]</span> ${n.author}</h5>
        <p style="font-size:0.8rem; line-height:1.4;">${n.text}</p>
      </div>
      <button class="btn btn-xs btn-danger" onclick="deleteAnnotation(${idx})">&times;</button>
    `;
    annotationList.appendChild(item);
  });
}

document.getElementById('btn-add-annotation').addEventListener('click', () => {
  const text = document.getElementById('annotation-input').value.trim();
  if (!text) {
    alert('Please enter annotation notes.');
    return;
  }
  
  const timeStr = formatVideoTime(STATE.videoTimeSeconds);
  STATE.supervisionNotes.push({
    time: timeStr,
    author: STATE.activeRole === 'joel' ? 'Joel Mwangi' : 'Dr. Amina (Supervisor)',
    text: text
  });
  
  document.getElementById('annotation-input').value = '';
  renderSupervisionTimeline();
  logAudit('SUPERVISION_COMMENT', STATE.selectedClientId || 'Global', `Added timeline annotation at ${timeStr}`);
});

window.deleteAnnotation = function(index) {
  STATE.supervisionNotes.splice(index, 1);
  renderSupervisionTimeline();
};

// --- 17. EXPANSION: HL7 FHIR EXPORTS GENERATOR (M19) ---

const fhirBtn = document.getElementById('btn-generate-fhir');
const fhirOutput = document.getElementById('fhir-console-output');

fhirBtn.addEventListener('click', () => {
  const resourceType = document.getElementById('fhir-resource-select').value;
  const pId = document.getElementById('fhir-patient-select').value || 'c_001';
  const clientObj = STATE.clients.find(c => c.id === pId);
  
  let fhirPayload = {};
  
  if (resourceType === 'patient') {
    fhirPayload = {
      resourceType: "Patient",
      id: clientObj.id,
      active: true,
      name: [
        {
          use: "official",
          family: clientObj.name.split(' ')[1] || '',
          given: [clientObj.name.split(' ')[0] || '']
        }
      ],
      telecom: [
        {
          system: "phone",
          value: clientObj.phone,
          use: "mobile"
        }
      ],
      gender: clientObj.gender.toLowerCase(),
      birthDate: clientObj.dob,
      address: [
        {
          use: "home",
          line: ["Session Location Validation Zone"],
          city: clientObj.location.split(', ')[0] || '',
          country: clientObj.location.split(', ')[1] || ''
        }
      ],
      managingOrganization: {
        reference: "Organization/vanbransa-org-0940",
        display: "VANBRANSA Nairobi Primary Cell"
      }
    };
  } else if (resourceType === 'encounter') {
    fhirPayload = {
      resourceType: "Encounter",
      id: `enc-${Date.now()}`,
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory"
      },
      subject: {
        reference: `Patient/${clientObj.id}`,
        display: clientObj.name
      },
      participant: [
        {
          type: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                  code: "PPRF",
                  display: "primary performer"
                }
              ]
            }
          ],
          individual: {
            reference: "Practitioner/joel-mwangi",
            display: "Joel Mwangi, Counselor"
          }
        }
      ],
      period: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 50*60*1000).toISOString()
      },
      reasonCode: [
        {
          coding: [
            {
              system: "http://hl7.org/fhir/sid/icd-10",
              code: "F41.1",
              display: "Generalized anxiety disorder"
            }
          ]
        }
      ]
    };
  } else {
    const phqScores = clientObj.outcomeHistory.phq9;
    const latestScore = phqScores[phqScores.length - 1] || 0;
    
    fhirPayload = {
      resourceType: "Observation",
      id: `obs-${Date.now()}`,
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "survey",
              display: "Survey"
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "44261-6",
            display: "Patient Health Questionnaire 9 item (PHQ-9) total score"
          }
        ]
      },
      subject: {
        reference: `Patient/${clientObj.id}`,
        display: clientObj.name
      },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: {
        value: latestScore,
        unit: "{score}",
        system: "http://unitsofmeasure.org",
        code: "{score}"
      },
      interpretation: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: latestScore >= 15 ? "A" : "N",
              display: latestScore >= 15 ? "Abnormal/Severe" : "Normal"
            }
          ]
        }
      ]
    };
  }
  
  fhirOutput.textContent = JSON.stringify(fhirPayload, null, 2);
  logAudit('FHIR_EXPORT', clientObj.id, `Compiled FHIR R4 document resource: ${resourceType}`);
});

document.getElementById('btn-copy-fhir').addEventListener('click', () => {
  const text = fhirOutput.textContent;
  navigator.clipboard.writeText(text);
  alert('FHIR JSON copied to clipboard.');
});

// --- 18. EXPANSION: STAFF LICENSURE LISTING (M17) ---

function renderLicensureList() {
  const list = document.getElementById('licensure-list');
  if (!list) return;
  list.innerHTML = '';
  
  STATE.staffCredentials.forEach(cred => {
    const item = document.createElement('div');
    item.className = `lic-item ${cred.status === 'expiring' ? 'expiring' : 'active'}`;
    item.innerHTML = `
      <div class="triage-info">
        <h4>${cred.name}</h4>
        <p>${cred.role} | ${cred.license}</p>
      </div>
      <div class="triage-meta">
        <span class="badge ${cred.status === 'expiring' ? 'badge-s2' : 'badge-s5'}">
          ${cred.status === 'expiring' ? `Warning: ${cred.expiresInDays}d left` : 'Active'}
        </span>
      </div>
    `;
    list.appendChild(item);
  });
}

// --- 19. EXPANSION: INTAKE TRIAGE CLINICIAN MATCHING (M5) ---

const triageConcernSelect = document.getElementById('triage-practice-area-select');
if (triageConcernSelect) {
  triageConcernSelect.addEventListener('change', renderTriageMatches);
}

function renderTriageMatches() {
  const resultsContainer = document.getElementById('triage-matching-results');
  if (!resultsContainer) return;
  resultsContainer.innerHTML = '';
  
  const selectedConcern = triageConcernSelect.value;
  
  const matches = STATE.staffCredentials.map(staff => {
    let score = 40;
    const reasons = [];
    
    if (staff.specialties.includes(selectedConcern)) {
      score += 45;
      reasons.push(`✔ Board-certified in ${staff.specialtiesLabels[staff.specialties.indexOf(selectedConcern)]}`);
    } else {
      reasons.push(`⚠ Out-of-specialty referral (Not primary focus)`);
    }
    
    if (staff.status === 'active') {
      score += 10;
      reasons.push(`✔ License active and verified in local cell`);
    } else {
      score += 2;
      reasons.push(`⚠ Credentials renewal pending (expires in ${staff.expiresInDays} days)`);
    }
    
    const loadNum = parseInt(staff.load);
    if (loadNum < 50) {
      score += 5;
      reasons.push(`✔ Case-load margin nominal (Utilized: ${staff.load})`);
    } else {
      reasons.push(`✔ Timezone available (Load utilized: ${staff.load})`);
    }
    
    return {
      name: staff.name,
      role: staff.role,
      score: score,
      reasons: reasons
    };
  });
  
  matches.sort((a, b) => b.score - a.score);
  
  matches.forEach(m => {
    const item = document.createElement('div');
    const scoreColorClass = m.score > 80 ? 'badge-success' : (m.score > 60 ? 'badge-s2' : 'badge-s1');
    const borderClass = m.score > 80 ? 'risk-low' : (m.score > 60 ? 'risk-med' : 'risk-high');
    
    item.className = `triage-item ${borderClass}`;
    item.style.flexDirection = 'column';
    item.style.alignItems = 'stretch';
    item.style.gap = '0.5rem';
    
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h4 style="font-size:0.95rem;">${m.name}</h4>
          <p style="font-size:0.75rem;">${m.role}</p>
        </div>
        <span class="badge ${scoreColorClass}" style="font-family:monospace; font-size:0.8rem;">Match: ${m.score}%</span>
      </div>
      <div style="font-size:0.75rem; color:var(--font-secondary); padding-top:0.25rem; border-top:1px dashed var(--border-color); display:flex; flex-direction:column; gap:0.25rem;">
        ${m.reasons.map(r => `<div>${r}</div>`).join('')}
      </div>
    `;
    resultsContainer.appendChild(item);
  });
}

// --- 20. EXPANSION: OPERATIONS REPORT & AI ASSIST Narrative (M18 / M16) ---

function renderReportingMetrics() {
  // Update totals from invoices state
  let totalBilled = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let vatCollected = 0;
  
  STATE.invoices.forEach(inv => {
    // Simple conversions for reporting dashboard (mocking KES values)
    let rate = 1.0;
    if (inv.currency === 'USD') rate = 130.0;
    if (inv.currency === 'GBP') rate = 165.0;
    
    const equivKES = inv.amountNum * rate;
    totalBilled += equivKES;
    
    if (inv.status === 'Paid') {
      totalCollected += equivKES;
      if (inv.currency === 'KES') {
        const net = inv.amountNum / 1.16;
        vatCollected += (inv.amountNum - net);
      }
    } else {
      totalPending += equivKES;
    }
  });

  document.getElementById('rep-total-billed').textContent = `KES ${totalBilled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById('rep-total-collected').textContent = `KES ${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById('rep-total-pending').textContent = `KES ${totalPending.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById('rep-total-vat').textContent = `KES ${vatCollected.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

const aiReportBtn = document.getElementById('btn-generate-ai-report');
aiReportBtn.addEventListener('click', () => {
  const placeholder = document.getElementById('ai-report-placeholder');
  const content = document.getElementById('ai-report-content');
  const body = document.getElementById('ai-report-body');
  const prov = document.getElementById('ai-report-provenance');

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');
  body.textContent = 'Generating multi-dimensional analysis report... Connecting to Sage ZDR cell...';

  setTimeout(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    STATE.invoices.forEach(inv => {
      let rate = 1.0;
      if (inv.currency === 'USD') rate = 130.0;
      if (inv.currency === 'GBP') rate = 165.0;
      totalBilled += inv.amountNum * rate;
      if (inv.status === 'Paid') totalCollected += inv.amountNum * rate;
    });

    const reportText = `# VANBRANSA BOARD AUDIT REPORT — EXEC ASSIST\nDate: 2026-08-20 | Cell Scope: Nairobi Core (EAT)\nCompliance standard: KRA eTIMS / Kenya DPA / EU GDPR\n\n## 1. FINANCIAL AUDIT & REVENUE RECONCILIATION\n*   Total Revenue Billed: KES ${totalBilled.toLocaleString(undefined, {maximumFractionDigits:0})} (Equivalent across all currencies).\n*   Total Collected Cash: KES ${totalCollected.toLocaleString(undefined, {maximumFractionDigits:0})}.\n*   Reconciliation Index: 88.1% Collection Rate.\n*   Payment Channels: M-Pesa STK remains the dominant intake interface (60%), followed by Visa Card (20%) and Bank Deposit RTGS checks (10%).\n\n## 2. STATUTORY KRA TAX COMPLIANCE\n*   Local sales mapped to 16% VAT ledger. Cryptographic signatures generated successfully for active invoices.\n*   Cross-border data/billing cells (New York EST, London BST) flagged as VAT Exempt under Export Services provisions. No secondary double-taxation risk identified.\n\n## 3. CLINICAL OUTCOMES ANALYSIS\n*   Active Caseload Efficacy (M8): Average PHQ-9 delta drops across active files at Session #6 stands at -12.0 points.\n*   RCI Metric: 85.4% of clients exceed the Reliable Change Index boundary of 5.1, demonstrating statistically significant treatment success.\n*   Out-of-Caseload override audit: 1 active emergency Break-Glass bypass logged on file John Doe. Verified and closed.\n\n## 4. EXECUTIVE RECOMMENDATIONS\n1.  Initiate board license renewal process for Therapist Joel Mwangi immediately (12 days remaining).\n2.  Maintain local Nairobi data cell residency limits for eTIMS audits.`;

    body.textContent = 'Streaming live tokens...';
    streamText(body, reportText, 3, () => {
      prov.innerHTML = `<strong>Provenance Logs:</strong> Engine=sage-claude-3.5-zdr | Tokenized_SHA=<code>block_${Math.random().toString(16).substring(2,10)}</code> | KMS_Key=<code>key_nb_0940</code> | Time=${new Date().toISOString()}`;
      logAudit('GENERATE_AI_REPORT', 'Global Practice', 'Compiled Sage AI executive narrative reports via streaming.');
    });
  }, 1000);
});

// --- 21. INITIATE ENGINE ON DOM READY ---

document.addEventListener('DOMContentLoaded', () => {
  // Collapsible Nav Groups: Toggle collapsed state on header click
  document.querySelectorAll('.nav-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.parentElement;
      parent.classList.toggle('collapsed');
    });
  });

  // Ensure active view's nav-group is expanded by default
  const activeLink = document.querySelector('.nav-link.active');
  if (activeLink) {
    const parentGroup = activeLink.closest('.nav-group');
    if (parentGroup) {
      parentGroup.classList.remove('collapsed');
    }
  }

  populateTrajectoryClients();
  applyRBACPermissions();
  renderAlertPills();
  renderPulseLogs();
  renderAthenaeumResults();
  renderAuditLedger();
  renderInvoiceList();
  applyJurisdictionChecks();
  renderTriageMatches();
  renderReportingMetrics();

  // Open Add Client modal
  const btnAddClient = document.getElementById('btn-add-client');
  const modalAddClient = document.getElementById('modal-add-client');
  if (btnAddClient) {
    btnAddClient.addEventListener('click', () => {
      document.getElementById('add-c-name').value = '';
      document.getElementById('add-c-dob').value = '1995-01-01';
      document.getElementById('add-c-gender').value = 'Female';
      document.getElementById('add-c-phone').value = '';
      document.getElementById('add-c-eap').value = '';
      document.getElementById('add-c-location').value = 'Nairobi, Kenya';
      document.getElementById('add-c-owner').value = STATE.activeRole === 'amina_owner' ? 'joel' : STATE.activeRole;
      document.getElementById('add-c-practice').value = 'individual';
      document.getElementById('add-c-referral').value = '';
      modalAddClient.classList.add('active');
    });
  }

  // Handle Add Client submission
  const submitAddClientBtn = document.getElementById('submit-add-client-btn');
  if (submitAddClientBtn) {
    submitAddClientBtn.addEventListener('click', () => {
      const name = document.getElementById('add-c-name').value.trim();
      const dob = document.getElementById('add-c-dob').value;
      const gender = document.getElementById('add-c-gender').value;
      const phone = document.getElementById('add-c-phone').value.trim();
      const eap = document.getElementById('add-c-eap').value.trim() || 'None';
      const location = document.getElementById('add-c-location').value.trim();
      const owner = document.getElementById('add-c-owner').value;
      const practice = document.getElementById('add-c-practice').value;
      const referral = document.getElementById('add-c-referral').value.trim();
      
      if (!name || !dob || !phone || !referral) {
        alert('Please fill out all patient registration details.');
        return;
      }
      
      const practiceSelect = document.getElementById('add-c-practice');
      const practiceLabel = practiceSelect.options[practiceSelect.selectedIndex].text;
      
      const newClientId = `c_${Math.floor(100 + Math.random() * 900)}`;
      const newClientObj = {
        id: newClientId,
        name: name,
        avatar: name.charAt(0).toUpperCase(),
        dob: dob,
        gender: gender,
        location: location,
        phone: phone,
        language: 'English',
        eapSponsor: eap,
        caseloadOwner: owner,
        areaOfPractice: practice,
        areaOfPracticeLabel: practiceLabel,
        referralReason: referral,
        consent: {
          treatment: true,
          telehealth: true,
          ai: true,
          recording: false
        },
        safetyPlan: {
          warningSigns: 'Feeling overwhelmed, heart racing.',
          copingStrategies: '4-7-8 breathing exercises.',
          contacts: 'Emergency contact listed on file.',
          crisisLines: 'Crisis Helpline'
        },
        outcomeHistory: {
          phq9: [15],
          gad7: [12]
        },
        notes: [
          {
            id: `n_intake_${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            author: owner === 'joel' ? 'Joel Mwangi' : 'Dr. Amina',
            type: 'Intake Assessment',
            body: `Clinical Intake registered. Primary concern: ${referral}. Patient matches taxonomy: ${practiceLabel}. Consent forms signed electronically under local jurisdiction policies.`
          }
        ],
        homework: []
      };
      
      STATE.clients.push(newClientObj);
      renderClientList();
      renderCaseloadTriage();
      populateTrajectoryClients();
      
      modalAddClient.classList.remove('active');
      
      logAudit('CREATE_PATIENT', newClientId, `Created new patient file for ${name} under owner cell ${owner}.`);
      
      STATE.alerts.unshift({
        id: `alt_reg_${Date.now()}`,
        severity: 's5',
        source: 'Practice Admin (M4)',
        type: 'PATIENT REGISTERED',
        message: `Registered patient file for ${name} (ID: ${newClientId}). Assigned owner: ${owner}.`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        status: 'closed',
        details: 'Demographics and consent templates verified.'
      });
      
      renderAlertPills();
      renderPulseLogs();
      
      showToast(`Successfully registered client profile for ${name}. Patient ID: ${newClientId}`, 'success');
    });
  }

  // Psychological Assessment Screener (M8)
  const assessSelect = document.getElementById('assess-type-select');
  if (assessSelect) {
    assessSelect.addEventListener('change', () => {
      const type = assessSelect.value;
      document.getElementById('assess-phq9-block').classList.add('hidden');
      document.getElementById('assess-gad7-block').classList.add('hidden');
      document.getElementById('assess-mse-block').classList.add('hidden');
      
      if (type === 'phq9') document.getElementById('assess-phq9-block').classList.remove('hidden');
      else if (type === 'gad7') document.getElementById('assess-gad7-block').classList.remove('hidden');
      else if (type === 'mse') document.getElementById('assess-mse-block').classList.remove('hidden');
      
      updateAssessmentCalculator();
    });
  }

  document.querySelectorAll('.phq9-q, .gad7-q').forEach(el => {
    el.addEventListener('change', updateAssessmentCalculator);
  });
  document.querySelectorAll('.mse-chk').forEach(el => {
    el.addEventListener('change', updateAssessmentCalculator);
  });

  const submitAssessBtn = document.getElementById('submit-assessment-btn');
  if (submitAssessBtn) {
    submitAssessBtn.addEventListener('click', () => {
      if (!STATE.selectedClientId) {
        alert('Please select a client file from the directory before submitting assessments.');
        return;
      }
      
      const clientObj = STATE.clients.find(c => c.id === STATE.selectedClientId);
      const type = assessSelect.value;
      let score = 0;
      let notesBody = "";
      let typeLabel = "";
      
      if (type === 'phq9') {
        typeLabel = "PHQ-9 Depression Screener";
        document.querySelectorAll('.phq9-q').forEach(sel => score += parseInt(sel.value));
        let severity = 'None';
        if (score >= 9) severity = 'Severe';
        else if (score >= 6) severity = 'Moderate';
        else if (score >= 3) severity = 'Mild';
        
        clientObj.outcomeHistory.phq9.push(score * 2);
        notesBody = `Administered PHQ-9 screener. Total Score: ${score}/12 (scaled outcome index: ${score * 2}). Severity: ${severity} depressive indicators present. Answers: ${Array.from(document.querySelectorAll('.phq9-q')).map(s => s.value).join(', ')}`;
      } else if (type === 'gad7') {
        typeLabel = "GAD-7 Anxiety Screener";
        document.querySelectorAll('.gad7-q').forEach(sel => score += parseInt(sel.value));
        let severity = 'None';
        if (score >= 9) severity = 'Severe';
        else if (score >= 6) severity = 'Moderate';
        else if (score >= 3) severity = 'Mild';
        
        clientObj.outcomeHistory.gad7.push(score * 2);
        notesBody = `Administered GAD-7 screener. Total Score: ${score}/12 (scaled outcome index: ${score * 2}). Severity: ${severity} anxiety indicators present. Answers: ${Array.from(document.querySelectorAll('.gad7-q')).map(s => s.value).join(', ')}`;
      } else {
        typeLabel = "Mental Status Exam Checklist";
        const items = [];
        document.querySelectorAll('.mse-chk:checked').forEach(chk => items.push(chk.value));
        score = items.length;
        notesBody = `Mental Status Examination (MSE) completed. Flagged Observations: ${items.length > 0 ? items.join(', ') : 'None (Client oriented x3, cooperative, and calm).'}`;
      }
      
      const newNote = {
        id: `n_scr_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        author: STATE.activeRole === 'amina_owner' ? 'Dr. Amina' : 'Joel Mwangi',
        type: typeLabel,
        body: notesBody
      };
      
      clientObj.notes.push(newNote);
      renderNotesList(clientObj);
      renderTrajectoryChart();
      
      document.querySelectorAll('.mse-chk').forEach(chk => chk.checked = false);
      document.querySelectorAll('.phq9-q, .gad7-q').forEach(sel => sel.value = "0");
      updateAssessmentCalculator();
      
      logAudit('ADMINISTER_ASSESSMENT', clientObj.id, `Administered ${typeLabel}. Score/Observes: ${score}.`);
      
      STATE.alerts.unshift({
        id: `alt_scr_${Date.now()}`,
        severity: 's5',
        source: 'Clinical Workspace (M8)',
        type: 'ASSESSMENT COMPLETED',
        message: `${clientObj.name} completed ${typeLabel}. Logged to outcome trajectory records.`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        status: 'closed',
        details: notesBody
      });
      
      renderAlertPills();
      renderPulseLogs();
      
      showToast(`${typeLabel} completed and plotted to outcomes trajectory record successfully.`, 'success');
    });
  }
  
  // Group Radar sliders
  const sldAlliance = document.getElementById('sld-group-alliance');
  const sldSafety = document.getElementById('sld-group-safety');
  const sldBelonging = document.getElementById('sld-group-belonging');
  if (sldAlliance) sldAlliance.addEventListener('input', drawGroupRadar);
  if (sldSafety) sldSafety.addEventListener('input', drawGroupRadar);
  if (sldBelonging) sldBelonging.addEventListener('input', drawGroupRadar);
  
  // Lock group session logs
  const btnLockGroup = document.getElementById('btn-lock-group-session');
  if (btnLockGroup) {
    btnLockGroup.addEventListener('click', () => {
      const alliance = document.getElementById('sld-group-alliance').value;
      const safety = document.getElementById('sld-group-safety').value;
      const belonging = document.getElementById('sld-group-belonging').value;
      
      logAudit('LOCK_GROUP_SESSION', 'Group Cohort A', `Locked Group session logs. Cohesion metrics: Alliance=${alliance}/10, Safety=${safety}/10, Belonging=${belonging}/10`);
      
      STATE.alerts.unshift({
        id: `alt_grp_${Date.now()}`,
        severity: 's5',
        source: 'Clinical Monitor (M11)',
        type: 'GROUP COHESION LOCKED',
        message: `Locked Cohort Cohesion Metrics. Index average: ${((parseInt(alliance) + parseInt(safety) + parseInt(belonging)) / 3).toFixed(1)}/10`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        status: 'closed',
        details: 'Cohesion radar verified.'
      });
      
      renderAlertPills();
      renderPulseLogs();
      showToast('Group Session metrics locked and synchronized with regional practice ledger.', 'success');
    });
  }

  // Homework sliders & forms
  const sldHwSuds = document.getElementById('sld-hw-suds');
  const lblHwSuds = document.getElementById('lbl-hw-suds');
  if (sldHwSuds) {
    sldHwSuds.addEventListener('input', () => {
      lblHwSuds.textContent = `${sldHwSuds.value}/10`;
    });
  }

  const btnSubmitHomework = document.getElementById('btn-submit-homework');
  if (btnSubmitHomework) {
    btnSubmitHomework.addEventListener('click', () => {
      const evVal = document.getElementById('hw-event').value.trim();
      const thoughtsVal = document.getElementById('hw-thoughts').value.trim();
      const distortionVal = document.getElementById('hw-distortion').value;
      const rationalVal = document.getElementById('hw-rational').value.trim();
      const sudsVal = parseInt(sldHwSuds.value);
      
      if (!evVal || !thoughtsVal || !rationalVal) {
        alert('Please fill out all CBT thought restructuring fields.');
        return;
      }
      
      const clientAmina = STATE.clients.find(c => c.id === 'c_001');
      const newHw = {
        id: `hw_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        event: evVal,
        thoughts: thoughtsVal,
        distortion: distortionVal,
        rational: rationalVal,
        suds: sudsVal
      };
      
      clientAmina.homework.push(newHw);
      
      document.getElementById('hw-event').value = '';
      document.getElementById('hw-thoughts').value = '';
      document.getElementById('hw-rational').value = '';
      sldHwSuds.value = 5;
      lblHwSuds.textContent = '5/10';
      
      renderHomeworkHistory();
      
      STATE.alerts.unshift({
        id: `alt_hw_${Date.now()}`,
        severity: 's4',
        source: 'Patient Portal (M14)',
        type: 'HOMEWORK SUBMITTED',
        message: `Amina Omondi completed CBT Thought Record. Distress reduced to SUDs ${sudsVal}/10.`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        status: 'pending',
        details: `Completed exposure: distortion identified: ${distortionVal}`
      });
      
      renderAlertPills();
      renderPulseLogs();
      
      logAudit('SUBMIT_HOMEWORK', 'c_001', 'Client self-submitted completed CBT restructuring workbook.');
      showToast('CBT homework successfully submitted to your clinician Joel Mwangi.', 'success');
    });
  }

  // Director Break-Glass overrides
  const btnDirectorOverride = document.getElementById('btn-director-override');
  const modalDirectorOverride = document.getElementById('modal-director-override');
  const submitDirectorOverrideBtn = document.getElementById('submit-director-override');
  const dirOverrideJustification = document.getElementById('dir-override-justification');
  const dirOverridePin = document.getElementById('dir-override-pin');
  const dirOverrideStatus = document.getElementById('dir-override-status');

  if (btnDirectorOverride) {
    btnDirectorOverride.addEventListener('click', () => {
      dirOverrideJustification.textContent = STATE.lastBreakGlassReason || "Emergency Caseload Access Override";
      dirOverridePin.value = "";
      modalDirectorOverride.classList.add('active');
    });
  }

  if (submitDirectorOverrideBtn) {
    submitDirectorOverrideBtn.addEventListener('click', () => {
      if (STATE.activeRole !== 'amina_owner') {
        alert('[SECURITY PROTECTION] Only the Clinical Director (Dr. Amina) can authorize Break-Glass sign-off overrides.');
        return;
      }
      if (dirOverridePin.value !== '1234') {
        alert('Invalid Director Sign-off PIN.');
        return;
      }
      
      clearInterval(STATE.alarmTimer);
      document.getElementById('alarm-banner').classList.add('hidden');
      modalDirectorOverride.classList.remove('active');
      STATE.breakGlassAuthorized = false;
      
      const bgAlert = STATE.alerts.find(a => a.type === 'BREAK-GLASS COMPROMISE' && a.status === 'pending');
      if (bgAlert) {
        bgAlert.status = 'resolved';
        bgAlert.details = `Director sign-off completed: ${dirOverrideStatus.options[dirOverrideStatus.selectedIndex].text}`;
      }
      
      renderAlertPills();
      renderPulseLogs();
      logAudit('BREAK_GLASS_RESOLVED', STATE.selectedClientId, `Director Sign-off Approved. Status: ${dirOverrideStatus.value}`);
      showToast('Break-glass alarm resolved and logged to secure audit chain.', 'success');
    });
  }

  // KMS Master Key Rotation
  const btnRotateKms = document.getElementById('btn-rotate-kms');
  if (btnRotateKms) {
    btnRotateKms.addEventListener('click', () => {
      const currentKey = document.getElementById('kms-active-key');
      const lastRotation = document.getElementById('kms-last-rotation');
      const badge = document.getElementById('kms-status-badge');
      
      badge.textContent = 'ROTATING KEY...';
      badge.className = 'badge badge-pulse';
      
      setTimeout(() => {
        const newKeyId = `kms_tn_nbo_${Math.floor(1000 + Math.random() * 9000)}`;
        currentKey.textContent = newKeyId;
        lastRotation.textContent = new Date().toISOString().replace('T', ' ').slice(0, 19);
        badge.textContent = 'KMS ONLINE';
        badge.className = 'badge badge-success';
        
        logAudit('KMS_KEY_ROTATION', 'Global Practice', `HSM rotated Master Envelope Key to ${newKeyId}. Database blocks re-encrypted.`);
        showToast(`HSM key rotation succeeded. Mapped active cell to new Master DEK: ${newKeyId}`, 'success');
      }, 1200);
    });
  }

  setInterval(() => {
    const d = new Date();
    document.getElementById('system-time-clock').textContent = d.toISOString().replace('T', ' ').slice(0, 19);
  }, 1000);
});

// --- 22. BASELINE HELPERS ---
function calculateAge(dobString) {
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function renderCaseloadTriage() {
  const container = document.getElementById('caseload-triage-list');
  if (!container) return;
  container.innerHTML = '';
  
  STATE.clients.forEach(c => {
    if (STATE.activeRole === 'joel' && c.caseloadOwner !== 'joel') return;
    
    const div = document.createElement('div');
    const isSarah = c.name === 'Sarah Jenkins';
    const riskClass = isSarah ? 'risk-med' : (c.name === 'John Doe' ? 'risk-high' : 'risk-low');
    const statusText = isSarah ? 'Off-Track (Flatline)' : (c.name === 'John Doe' ? 'Unassigned Risk Flag' : 'On-Track (Stable)');
    
    div.className = `triage-item ${riskClass}`;
    div.innerHTML = `
      <div class="triage-info">
        <h4>${c.name}</h4>
        <p>${statusText} | Location: ${c.location}</p>
      </div>
      <div class="triage-meta">
        <span class="badge ${isSarah ? 'badge-s2' : (c.name === 'John Doe' ? 'badge-s1' : 'badge-s5')}">${isSarah ? 'S2' : (c.name === 'John Doe' ? 'S1' : 'S5')}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function streamText(element, text, speed = 5, onComplete = null) {
  element.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      element.scrollTop = element.scrollHeight;
    } else {
      clearInterval(timer);
      if (onComplete) onComplete();
    }
  }, speed);
}

function drawGroupRadar() {
  const sldAlliance = document.getElementById('sld-group-alliance');
  const sldSafety = document.getElementById('sld-group-safety');
  const sldBelonging = document.getElementById('sld-group-belonging');
  if (!sldAlliance || !sldSafety || !sldBelonging) return;

  const alliance = parseInt(sldAlliance.value);
  const safety = parseInt(sldSafety.value);
  const belonging = parseInt(sldBelonging.value);

  const lblAlliance = document.getElementById('lbl-group-alliance');
  const lblSafety = document.getElementById('lbl-group-safety');
  const lblBelonging = document.getElementById('lbl-group-belonging');
  if (lblAlliance) lblAlliance.textContent = `${alliance}/10`;
  if (lblSafety) lblSafety.textContent = `${safety}/10`;
  if (lblBelonging) lblBelonging.textContent = `${belonging}/10`;

  const cx = 130, cy = 130;
  
  const maxAllianceY = cy - 100;
  const maxSafetyX = cx - 86.6, maxSafetyY = cy + 50;
  const maxBelongingX = cx + 86.6, maxBelongingY = cy + 50;

  const valAllianceY = cy - (alliance * 10);
  const valSafetyX = cx - (safety * 8.66), valSafetyY = cy + (safety * 5.0);
  const valBelongingX = cx + (belonging * 8.66), valBelongingY = cy + (belonging * 5.0);

  const svg = `
    <svg width="260" height="260" viewBox="0 0 260 260" style="display:block; margin:auto;">
      <!-- Grid concentric circles/triangles -->
      <polygon points="${cx},${cy - 50} ${cx - 43.3},${cy + 25} ${cx + 43.3},${cy + 25}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <polygon points="${cx},${cy - 100} ${cx - 86.6},${cy + 50} ${cx + 86.6},${cy + 50}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      
      <!-- Axis Lines -->
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${maxAllianceY}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2" />
      <line x1="${cx}" y1="${cy}" x2="${maxSafetyX}" y2="${maxSafetyY}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2" />
      <line x1="${cx}" y1="${cy}" x2="${maxBelongingX}" y2="${maxBelongingY}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2" />
      
      <!-- Text labels -->
      <text x="${cx}" y="${maxAllianceY - 8}" text-anchor="middle" fill="#00f0ff" font-size="10" font-family="sans-serif" font-weight="bold">Alliance</text>
      <text x="${maxSafetyX - 10}" y="${maxSafetyY + 12}" text-anchor="middle" fill="#00f0ff" font-size="10" font-family="sans-serif" font-weight="bold">Safety</text>
      <text x="${maxBelongingX + 14}" y="${maxBelongingY + 12}" text-anchor="middle" fill="#00f0ff" font-size="10" font-family="sans-serif" font-weight="bold">Belonging</text>

      <!-- Value Polygon -->
      <polygon points="${cx},${valAllianceY} ${valSafetyX},${valSafetyY} ${valBelongingX},${valBelongingY}" fill="rgba(0, 240, 255, 0.2)" stroke="#00f0ff" stroke-width="2" />
      
      <!-- Data point circles -->
      <circle cx="${cx}" cy="${valAllianceY}" r="4" fill="#00f0ff" />
      <circle cx="${valSafetyX}" cy="${valSafetyY}" r="4" fill="#00f0ff" />
      <circle cx="${valBelongingX}" cy="${valBelongingY}" r="4" fill="#00f0ff" />
    </svg>
  `;

  const container = document.getElementById('group-radar-container');
  if (container) {
    container.innerHTML = svg;
  }
}

function renderHomeworkHistory() {
  const historyContainer = document.getElementById('client-homework-history');
  if (!historyContainer) return;
  historyContainer.innerHTML = '';
  
  const amina = STATE.clients.find(c => c.id === 'c_001');
  if (!amina || !amina.homework || amina.homework.length === 0) {
    historyContainer.innerHTML = '<p class="placeholder-text">No homework records submitted yet.</p>';
    return;
  }
  
  amina.homework.slice().reverse().forEach(hw => {
    const div = document.createElement('div');
    div.className = 'triage-item risk-low';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '0.4rem';
    div.style.padding = '0.75rem';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed var(--border-color); padding-bottom:0.25rem;">
        <span style="font-size:0.75rem; color:var(--font-secondary);">${hw.date}</span>
        <span class="badge badge-s5">SUDs: ${hw.suds}/10</span>
      </div>
      <div><strong>Situation:</strong> ${hw.event}</div>
      <div><strong>Automatic Thought:</strong> <span class="text-danger">${hw.thoughts}</span></div>
      <div><strong>Distortion:</strong> <span class="text-warning">${hw.distortion}</span></div>
      <div><strong>Rational Response:</strong> <span class="text-success">${hw.rational}</span></div>
    `;
    historyContainer.appendChild(div);
  });
}

function renderHomeworkList(clientObj) {
  const container = document.getElementById('client-homework-list');
  if (!container) return;
  container.innerHTML = '';
  
  if (!clientObj.homework || clientObj.homework.length === 0) {
    container.innerHTML = '<p class="fs-xs text-muted">No completed homework records.</p>';
    return;
  }
  
  clientObj.homework.forEach(hw => {
    const div = document.createElement('div');
    div.className = 'note-item';
    div.innerHTML = `
      <div class="note-item-meta" style="border-bottom: 1px dashed var(--border-color); padding-bottom: 0.25rem;">
        <span>Type: <strong>CBT Thought Record</strong> | Self-Completed</span>
        <span>Date: ${hw.date}</span>
      </div>
      <div class="note-item-body" style="font-size: 0.8rem; line-height: 1.4; display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem;">
        <div><strong>Situation:</strong> ${hw.event}</div>
        <div><strong>Automatic Thought:</strong> <span class="text-danger">${hw.thoughts}</span></div>
        <div><strong>Distortion:</strong> <span class="text-warning">${hw.distortion}</span></div>
        <div><strong>Rational Alternative:</strong> <span class="text-success">${hw.rational}</span></div>
        <div><strong>SUDs Rating:</strong> <span class="badge badge-s5">SUDs: ${hw.suds}/10</span></div>
      </div>
    `;
    container.appendChild(div);
  });
}

function updateAssessmentCalculator() {
  const assessSelect = document.getElementById('assess-type-select');
  if (!assessSelect) return;
  const type = assessSelect.value;
  const resultEl = document.getElementById('lbl-assess-result');
  if (!resultEl) return;
  
  if (type === 'phq9') {
    let sum = 0;
    document.querySelectorAll('.phq9-q').forEach(sel => sum += parseInt(sel.value));
    let severity = 'None';
    if (sum >= 9) severity = 'Severe Depression Index';
    else if (sum >= 6) severity = 'Moderate Depression Index';
    else if (sum >= 3) severity = 'Mild Depression Index';
    resultEl.textContent = `Score: ${sum}/12 (${severity})`;
  } else if (type === 'gad7') {
    let sum = 0;
    document.querySelectorAll('.gad7-q').forEach(sel => sum += parseInt(sel.value));
    let severity = 'None';
    if (sum >= 9) severity = 'Severe Anxiety Index';
    else if (sum >= 6) severity = 'Moderate Anxiety Index';
    else if (sum >= 3) severity = 'Mild Anxiety Index';
    resultEl.textContent = `Score: ${sum}/12 (${severity})`;
  } else {
    let checkedCount = 0;
    document.querySelectorAll('.mse-chk:checked').forEach(() => checkedCount++);
    resultEl.textContent = `${checkedCount} mental status indicators observed/flagged.`;
  }
}
