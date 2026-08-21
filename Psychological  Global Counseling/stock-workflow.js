// Stock Workflow and Variance Logic

(function() {
  'use strict';

  // Wait for DOM to load
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Stock State
    if (!window.STATE) window.STATE = {};
    if (!window.STATE.stockLedger) {
      window.STATE.stockLedger = [
        { id: 'item-001', name: 'Clinical Journals (A5)', expectedQty: 150 },
        { id: 'item-002', name: 'Assessment Forms (PHQ-9)', expectedQty: 500 },
        { id: 'item-003', name: 'Assessment Forms (GAD-7)', expectedQty: 500 },
        { id: 'item-004', name: 'Therapy Tools Box', expectedQty: 12 },
        { id: 'item-005', name: 'Branded Pens', expectedQty: 300 }
      ];
    }

    // 2. DOM Elements
    const itemSelect = document.getElementById('stock-item-select');
    const expectedQtyInput = document.getElementById('stock-expected-qty');
    const countedQtyInput = document.getElementById('stock-counted-qty');
    const verifyBtn = document.getElementById('btn-verify-stock');
    const resultDiv = document.getElementById('stock-variance-result');

    if (!itemSelect || !verifyBtn) return;

    // 3. Populate Select Options
    window.STATE.stockLedger.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.id})`;
      itemSelect.appendChild(option);
    });

    // 4. Handle Item Selection Change
    itemSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const selectedItem = window.STATE.stockLedger.find(i => i.id === selectedId);
      
      if (selectedItem) {
        expectedQtyInput.value = selectedItem.expectedQty;
        // Optional: clear previous inputs
        countedQtyInput.value = '';
        resultDiv.style.display = 'none';
      } else {
        expectedQtyInput.value = '0';
      }
    });

    // 5. Handle Verification
    verifyBtn.addEventListener('click', () => {
      const selectedId = itemSelect.value;
      if (!selectedId) {
        if (typeof showToast === 'function') showToast('Please select an item first.', 'warning');
        return;
      }

      const countedValue = countedQtyInput.value;
      if (countedValue === '') {
        if (typeof showToast === 'function') showToast('Please enter the actual counted quantity.', 'warning');
        return;
      }

      const expectedQty = parseInt(expectedQtyInput.value, 10);
      const countedQty = parseInt(countedValue, 10);
      const variance = countedQty - expectedQty;

      resultDiv.style.display = 'block';

      if (variance === 0) {
        // All is OK
        resultDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        resultDiv.style.border = '1px solid var(--success-color, #10b981)';
        resultDiv.innerHTML = `
          <h4 style="color: var(--success-color, #10b981); margin-bottom: 5px;">✅ All is OK</h4>
          <p style="margin:0; font-size: 0.9rem;">The counted quantity matches the stock ledger perfectly. No variance detected.</p>
        `;
        if (typeof showToast === 'function') showToast('Stock verification complete. No variance.', 'success');
      } else {
        // Variance Detected
        const varianceType = variance > 0 ? 'Surplus' : 'Deficit';
        const absVariance = Math.abs(variance);
        
        resultDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        resultDiv.style.border = '1px solid var(--danger-color, #ef4444)';
        resultDiv.innerHTML = `
          <h4 style="color: var(--danger-color, #ef4444); margin-bottom: 5px;">⚠️ Variance Detected</h4>
          <p style="margin:0; font-size: 0.9rem;">
            <strong>Expected:</strong> ${expectedQty} <br>
            <strong>Counted:</strong> ${countedQty} <br>
            <strong>Variance:</strong> ${varianceType} of ${absVariance} units.
          </p>
          <button class="btn btn-outline mt-2" style="font-size: 0.8rem; padding: 4px 8px;">Investigate Variance</button>
        `;
        if (typeof showToast === 'function') showToast(`Stock variance detected: ${varianceType} of ${absVariance}`, 'error');
      }
    });

  });
})();
