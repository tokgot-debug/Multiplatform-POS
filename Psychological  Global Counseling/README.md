# VANBRANSA Global Practice Management Platform Prototype

This is a high-fidelity interactive system dashboard for **VANBRANSA** (formerly ALETHEIA), a single global practice operating system running the clinical, operational, financial, and compliance life of a psychology and counselling practice.

## Core Prototype Features

1. **Pulse Ribbon (M16)**:
   - Dynamic real-time event logging.
   - S1-S6 severity alert badges at the top of the interface.
   - Clinical load and case status sparkline monitors.

2. **Kairos Scheduling Canvas (M13)**:
   - Horizontal drag-ready layout timeline matching clinician & client zones.
   - **Orbit radial view** mapping DST and international civil work hours.
   - **Load Heatmap view** tracking daily cognitive margins.
   - **Cadence tracker** alerting on session frequency drift.

3. **Trajectory Outcomes Engine (M8)**:
   - Custom interactive SVG recovery band visualization.
   - Clinically significant Reliable Change Index (RCI) calculator.
   - Automatically generates deterioration alerts if progress drifts.

4. **Sage Ambient Audio Ingestion (M21)**:
   - Simulates ambient voice recording during therapy.
   - Auto-generates structured clinical note drafts (SOAP, CBT, or EMDR).
   - Side-by-side clinician verification editor with full model provenance stamps.

5. **Athenaeum Hybrid Search (M20)**:
   - Lexical (BM25) vs. Semantic Vector search configurations.
   - Returns mock similarity score distributions (e.g. cosine distance matches) for worksheets.

6. **Billing eTIMS Gateway (M18)**:
   - Multi-currency invoice ledger.
   - Simulated Safaricom M-Pesa Daraja STK Push transaction loops.
   - Automatic invoice reconciliation via callbacks.
   - Kenyan KRA eTIMS electronic signatures.

7. **RBAC Switching Controls**:
   - Persona toggles representing Dr. Amina (Clinical Director), Joel (Clinician), Grace (Billing), Naomi (Intake), and Client.
   - Dynamically masks psychotherapy process notes, financial statistics, and demographics based on relationship parameters.
   - Custom **Break-Glass emergency override control** which alarms the DPO.

## Running Locally

To run the dashboard locally, start a local HTTP server in this directory:

### Python 3
```bash
python3 -m http.server 8000
```
Then open [http://localhost:8000](http://localhost:8000) in your web browser.

### Node.js (npx)
```bash
npx serve
```
Then open [http://localhost:3000](http://localhost:3000) in your web browser.
