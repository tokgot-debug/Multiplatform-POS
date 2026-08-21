/* VANBRANSA Counseling Workflow Wizard — Session Management Module */

(function () {
  'use strict';

  let currentStep = 1;
  const TOTAL_STEPS = 4;

  // Note templates
  const NOTE_TEMPLATES = {
    soap: `SUBJECTIVE:\nClient reports...\n\nOBJECTIVE:\nAppearance: Alert, cooperative. Speech: Clear, normal rate.\nMood: Self-reported as...\nAffect: Congruent.\n\nASSESSMENT:\nProgress toward treatment goals...\n\nPLAN:\n1. Continue current treatment modality\n2. Homework: ...\n3. Next session scheduled for...`,
    cbt: `CBT SESSION RECORD:\n\nAGENDA ITEMS:\n1. Review homework / thought records\n2. Skill building: ...\n\nAUTOMATIC THOUGHTS IDENTIFIED:\nTrigger: ...\nAutomatic Thought: ...\nCognitive Distortion: ...\nBalanced Alternative: ...\n\nBEHAVIORAL EXPERIMENTS:\n...\n\nHOMEWORK ASSIGNED:\n...`,
    emdr: `EMDR PROTOCOL SESSION:\n\nPHASE: ...\nTARGET MEMORY: ...\n\nPRE-PROCESSING:\nSUDs Level: .../10\nVOC (Validity of Cognition): .../7\nNegative Cognition: ...\nPositive Cognition: ...\n\nPROCESSING NOTES:\n...\n\nPOST-PROCESSING:\nSUDs Level: .../10\nVOC: .../7\nBody Scan: ...`,
    custom: ''
  };

  function initWizard() {
    populateWizardClients();
    resetWizard();
    attachWizardEvents();
  }

  function populateWizardClients() {
    const select = document.getElementById('wiz-client-select');
    if (!select) return;
    select.innerHTML = '';
    if (typeof STATE !== 'undefined' && STATE.clients) {
      STATE.clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.location})`;
        select.appendChild(opt);
      });
    }
  }

  function attachWizardEvents() {
    // Navigation buttons
    const btnNext = document.getElementById('wiz-btn-next');
    const btnPrev = document.getElementById('wiz-btn-prev');
    const btnComplete = document.getElementById('wiz-btn-complete');
    const btnReset = document.getElementById('wiz-btn-reset');

    if (btnNext) btnNext.addEventListener('click', () => goToStep(currentStep + 1));
    if (btnPrev) btnPrev.addEventListener('click', () => goToStep(currentStep - 1));
    if (btnComplete) btnComplete.addEventListener('click', completeWizard);
    if (btnReset) btnReset.addEventListener('click', resetWizard);

    // Assessment score sliders
    const phq9Slider = document.getElementById('wiz-phq9-score');
    const gad7Slider = document.getElementById('wiz-gad7-score');
    const allianceSlider = document.getElementById('wiz-alliance-score');

    if (phq9Slider) phq9Slider.addEventListener('input', updateAssessmentLabels);
    if (gad7Slider) gad7Slider.addEventListener('input', updateAssessmentLabels);
    if (allianceSlider) allianceSlider.addEventListener('input', updateAssessmentLabels);

    // Note template radio buttons
    document.querySelectorAll('input[name="wiz-note-template"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const textarea = document.getElementById('wiz-session-notes');
        if (textarea && textarea.value.trim() === '' || confirm('Replace current notes with template?')) {
          textarea.value = NOTE_TEMPLATES[radio.value] || '';
        }
      });
    });

    // Generate session ID
    document.getElementById('wizard-session-id').textContent = 
      `Session #${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;

    // Validate current step before advancing
    if (step > currentStep && !validateStep(currentStep)) return;

    currentStep = step;
    updateStepperUI();
    updatePanelVisibility();
    updateNavButtons();

    // Populate summary on step 4
    if (step === 4) populateSummary();

    // Set note timestamp on step 3
    if (step === 3) {
      const ts = document.getElementById('wiz-note-timestamp');
      if (ts) ts.textContent = new Date().toISOString().replace('T', ' ').slice(0, 19);
      // Auto-fill template if notes are empty
      const textarea = document.getElementById('wiz-session-notes');
      if (textarea && textarea.value.trim() === '') {
        const selectedTemplate = document.querySelector('input[name="wiz-note-template"]:checked');
        textarea.value = NOTE_TEMPLATES[selectedTemplate ? selectedTemplate.value : 'soap'];
      }
    }
  }

  function validateStep(step) {
    if (step === 1) {
      const clientSelect = document.getElementById('wiz-client-select');
      const concern = document.getElementById('wiz-presenting-concern');
      const consentChk = document.getElementById('wiz-consent-confirm');

      if (!clientSelect.value) {
        showToastOrAlert('Please select a client before proceeding.', 'warning');
        return false;
      }
      if (!concern.value.trim()) {
        showToastOrAlert('Please describe the presenting concern.', 'warning');
        return false;
      }
      if (!consentChk.checked) {
        showToastOrAlert('Treatment consent must be verified to proceed.', 'error');
        return false;
      }
      return true;
    }

    if (step === 2) {
      // Assessment step — always valid (scores have defaults)
      return true;
    }

    if (step === 3) {
      const notes = document.getElementById('wiz-session-notes');
      const signChk = document.getElementById('wiz-sign-note');

      if (!notes.value.trim() || notes.value.trim().length < 20) {
        showToastOrAlert('Please complete session notes (minimum 20 characters).', 'warning');
        return false;
      }
      if (!signChk.checked) {
        showToastOrAlert('You must certify the note before proceeding to billing.', 'warning');
        return false;
      }
      return true;
    }

    return true;
  }

  function updateStepperUI() {
    document.querySelectorAll('.wizard-step-indicator').forEach(indicator => {
      const stepNum = parseInt(indicator.getAttribute('data-wstep'));
      indicator.classList.remove('active', 'completed');

      if (stepNum === currentStep) {
        indicator.classList.add('active');
      } else if (stepNum < currentStep) {
        indicator.classList.add('completed');
      }
    });

    // Animate connector fills
    for (let i = 1; i < TOTAL_STEPS; i++) {
      const conn = document.getElementById(`conn-${i}`);
      if (conn) {
        conn.style.width = i < currentStep ? '100%' : '0%';
      }
    }
  }

  function updatePanelVisibility() {
    const track = document.getElementById('wizard-track');
    if (track) {
      track.style.transform = `translateX(-${(currentStep - 1) * 100}%)`;
    }

    document.querySelectorAll('.wizard-step-panel').forEach(panel => {
      const panelNum = parseInt(panel.getAttribute('data-panel'));
      panel.classList.toggle('active', panelNum === currentStep);
    });
  }

  function updateNavButtons() {
    const btnPrev = document.getElementById('wiz-btn-prev');
    const btnNext = document.getElementById('wiz-btn-next');
    const btnComplete = document.getElementById('wiz-btn-complete');

    if (btnPrev) btnPrev.disabled = currentStep === 1;

    if (currentStep === TOTAL_STEPS) {
      if (btnNext) btnNext.classList.add('hidden');
      if (btnComplete) btnComplete.classList.remove('hidden');
    } else {
      if (btnNext) btnNext.classList.remove('hidden');
      if (btnComplete) btnComplete.classList.add('hidden');
    }
  }

  function updateAssessmentLabels() {
    const phq9 = parseInt(document.getElementById('wiz-phq9-score').value);
    const gad7 = parseInt(document.getElementById('wiz-gad7-score').value);
    const alliance = parseInt(document.getElementById('wiz-alliance-score').value);

    // PHQ-9 severity
    let phq9Sev = 'None';
    if (phq9 >= 20) phq9Sev = 'Severe';
    else if (phq9 >= 15) phq9Sev = 'Mod-Severe';
    else if (phq9 >= 10) phq9Sev = 'Moderate';
    else if (phq9 >= 5) phq9Sev = 'Mild';
    document.getElementById('wiz-phq9-val').textContent = `${phq9} — ${phq9Sev}`;

    // GAD-7 severity
    let gad7Sev = 'None';
    if (gad7 >= 15) gad7Sev = 'Severe';
    else if (gad7 >= 10) gad7Sev = 'Moderate';
    else if (gad7 >= 5) gad7Sev = 'Mild';
    document.getElementById('wiz-gad7-val').textContent = `${gad7} — ${gad7Sev}`;

    // Alliance
    document.getElementById('wiz-alliance-val').textContent = `${alliance} / 10`;

    // Show assessment summary if scores are concerning
    const summaryEl = document.getElementById('wiz-assessment-summary');
    if (phq9 >= 15 || gad7 >= 15) {
      summaryEl.style.display = 'block';
      summaryEl.innerHTML = `⚠ <strong>Clinical Alert:</strong> Elevated scores detected. PHQ-9: ${phq9} (${phq9Sev}), GAD-7: ${gad7} (${gad7Sev}). Consider safety planning and risk review.`;
    } else {
      summaryEl.style.display = 'none';
    }
  }

  function populateSummary() {
    const clientSelect = document.getElementById('wiz-client-select');
    const clientName = clientSelect.options[clientSelect.selectedIndex]?.text || '—';
    const sessionType = document.getElementById('wiz-session-type');
    const sessionTypeText = sessionType.options[sessionType.selectedIndex]?.text || '—';
    const duration = document.getElementById('wiz-duration').value;
    const risk = document.getElementById('wiz-risk-level');
    const riskText = risk.options[risk.selectedIndex]?.text || '—';
    const phq9 = document.getElementById('wiz-phq9-score').value;
    const gad7 = document.getElementById('wiz-gad7-score').value;
    const alliance = document.getElementById('wiz-alliance-score').value;
    const fee = document.getElementById('wiz-fee-amount').value;
    const currency = document.getElementById('wiz-fee-currency').value;

    document.getElementById('wiz-sum-client').textContent = clientName;
    document.getElementById('wiz-sum-type').textContent = sessionTypeText;
    document.getElementById('wiz-sum-duration').textContent = `${duration} min`;
    document.getElementById('wiz-sum-risk').textContent = riskText;
    document.getElementById('wiz-sum-phq9').textContent = phq9;
    document.getElementById('wiz-sum-gad7').textContent = gad7;
    document.getElementById('wiz-sum-alliance').textContent = `${alliance}/10`;
    document.getElementById('wiz-sum-fee').textContent = `${currency} ${parseFloat(fee).toLocaleString()}`;
  }

  function completeWizard() {
    const confirmChk = document.getElementById('wiz-confirm-complete');
    if (!confirmChk.checked) {
      showToastOrAlert('Please confirm that session data is complete before closing.', 'warning');
      return;
    }

    // Gather all wizard data
    const clientId = document.getElementById('wiz-client-select').value;
    const clientObj = STATE.clients.find(c => c.id === clientId);
    if (!clientObj) {
      showToastOrAlert('Client not found in records.', 'error');
      return;
    }

    const phq9Score = parseInt(document.getElementById('wiz-phq9-score').value);
    const gad7Score = parseInt(document.getElementById('wiz-gad7-score').value);
    const sessionNotes = document.getElementById('wiz-session-notes').value.trim();
    const treatmentPlan = document.getElementById('wiz-treatment-plan').value.trim();
    const feeAmount = parseFloat(document.getElementById('wiz-fee-amount').value);
    const currency = document.getElementById('wiz-fee-currency').value;
    const sessionType = document.getElementById('wiz-session-type');
    const sessionTypeText = sessionType.options[sessionType.selectedIndex].text;
    const noteTemplate = document.querySelector('input[name="wiz-note-template"]:checked').value;

    // 1. Push outcome scores to client history
    if (phq9Score > 0) clientObj.outcomeHistory.phq9.push(phq9Score);
    if (gad7Score > 0) clientObj.outcomeHistory.gad7.push(gad7Score);

    // 2. Create clinical note
    const noteTemplateLabel = noteTemplate.toUpperCase() + ' Note';
    const newNote = {
      id: `n_wiz_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      author: STATE.activeRole === 'amina_owner' ? 'Dr. Amina' : 'Joel Mwangi',
      type: `${noteTemplateLabel} (Wizard)`,
      body: sessionNotes + (treatmentPlan ? `\n\nTREATMENT PLAN UPDATE:\n${treatmentPlan}` : '')
    };
    clientObj.notes.unshift(newNote);

    // 3. Create invoice
    const invId = `INV-2026-${Math.floor(Math.random() * 900) + 100}`;
    const newInvoice = {
      id: invId,
      clientName: clientObj.name,
      amountNum: feeAmount,
      currency: currency,
      amount: `${currency} ${feeAmount.toLocaleString()}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Unpaid',
      eTimsSig: currency === 'KES' ? 'Pending Signature' : 'Exempt (Cross-border)',
      buyerPin: clientObj.location.includes('Kenya') ? 'A009187364B' : '',
      desc: `${sessionTypeText} Session — Counseling Wizard`,
      paymentChannel: 'N/A',
      paymentRef: 'N/A'
    };
    STATE.invoices.unshift(newInvoice);

    // 4. Create alert notification
    STATE.alerts.unshift({
      id: `alt_wiz_${Date.now()}`,
      severity: 's5',
      source: 'Counseling Wizard',
      type: 'SESSION COMPLETED',
      message: `Session completed for ${clientObj.name}. ${noteTemplateLabel} signed. Invoice ${invId} generated.`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'closed',
      details: `PHQ-9: ${phq9Score}, GAD-7: ${gad7Score}. Fee: ${currency} ${feeAmount.toLocaleString()}.`
    });

    // 5. Update all dependent renders
    if (typeof renderNotesList === 'function') renderNotesList(clientObj);
    if (typeof renderInvoiceList === 'function') renderInvoiceList();
    if (typeof renderTrajectoryChart === 'function') renderTrajectoryChart();
    if (typeof renderAlertPills === 'function') renderAlertPills();
    if (typeof renderPulseLogs === 'function') renderPulseLogs();
    if (typeof renderClientList === 'function') renderClientList();
    if (typeof logAudit === 'function') {
      logAudit('WIZARD_SESSION_COMPLETE', clientObj.id, 
        `Counseling Wizard session closed. Note: ${noteTemplateLabel}. Invoice: ${invId}. Scores: PHQ-9=${phq9Score}, GAD-7=${gad7Score}.`);
    }

    // 6. Show success
    showToastOrAlert(
      `Session completed successfully for ${clientObj.name}. Clinical note signed and invoice ${invId} generated.`, 
      'success'
    );

    // 7. Reset wizard for next session
    setTimeout(() => resetWizard(), 1500);
  }

  function resetWizard() {
    currentStep = 1;
    updateStepperUI();
    updatePanelVisibility();
    updateNavButtons();

    // Reset all form fields
    const fieldsToReset = [
      'wiz-presenting-concern', 'wiz-clinical-obs', 'wiz-session-notes', 'wiz-treatment-plan'
    ];
    fieldsToReset.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Reset sliders
    const phq9 = document.getElementById('wiz-phq9-score');
    const gad7 = document.getElementById('wiz-gad7-score');
    const alliance = document.getElementById('wiz-alliance-score');
    if (phq9) phq9.value = 0;
    if (gad7) gad7.value = 0;
    if (alliance) alliance.value = 7;

    // Reset labels
    const phq9Val = document.getElementById('wiz-phq9-val');
    const gad7Val = document.getElementById('wiz-gad7-val');
    const allianceVal = document.getElementById('wiz-alliance-val');
    if (phq9Val) phq9Val.textContent = '0 — None';
    if (gad7Val) gad7Val.textContent = '0 — None';
    if (allianceVal) allianceVal.textContent = '7 / 10';

    // Reset checkboxes
    const signNote = document.getElementById('wiz-sign-note');
    const confirmComplete = document.getElementById('wiz-confirm-complete');
    if (signNote) signNote.checked = false;
    if (confirmComplete) confirmComplete.checked = false;

    // Reset assessment summary
    const summaryEl = document.getElementById('wiz-assessment-summary');
    if (summaryEl) summaryEl.style.display = 'none';

    // Reset fee
    const fee = document.getElementById('wiz-fee-amount');
    if (fee) fee.value = 6500;

    // New session ID
    const sessionId = document.getElementById('wizard-session-id');
    if (sessionId) sessionId.textContent = `Session #${Math.floor(1000 + Math.random() * 9000)}`;

    // Reset template selection
    const soapRadio = document.querySelector('input[name="wiz-note-template"][value="soap"]');
    if (soapRadio) soapRadio.checked = true;

    // Re-populate clients
    populateWizardClients();
  }

  function showToastOrAlert(message, type) {
    if (typeof showToast === 'function') {
      showToast(message, type);
    } else {
      alert(message);
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initWizard();
  });

  // Expose for external access
  window.CounselingWizard = {
    init: initWizard,
    reset: resetWizard,
    populateClients: populateWizardClients
  };
})();
