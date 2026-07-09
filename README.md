# SSTOps: Smart Stadiums & Tournament Operations Platform

A production-grade operations management console and fan experience platform designed to handle large-scale sporting events (cricket, football, leagues). Built using Google-native services: **Firebase Hosting/Emulators**, **Cloud Run**, **Cloud Functions (2nd Gen)**, **Firestore**, **Pub/Sub**, **Cloud KMS**, **BigQuery**, and **Vertex AI**.

---

## 🚀 How to Run Setup & Tests Locally in Under 5 Minutes

Follow these steps to spin up the entire local emulator network, Express backend, React UI, and execute the test suites:

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **Java Runtime Environment (JRE)** (v11 or higher, required by Firebase Emulators)

### 2. Dependency Installation
Run the following command at the root workspace directory to install all packages for the monorepo workspaces:
```bash
npm install
```

### 3. Execution
Start the entire local stack (emulators, express backend, and dev UI server) using a single command:
```bash
npm run dev
```
- **React Frontend**: Runs on `http://localhost:3000`
- **Express Backend**: Runs on `http://localhost:8080`
- **Firebase Emulator UI**: Runs on `http://localhost:4000` (Access local Firestore, Pub/Sub, Functions)

### 4. Running Test Suites
Open a new terminal window to execute the validation tests:
- **Unit Tests (Firestore Security Rules)**:
  ```bash
  npm run test:rules
  ```
  *This tests field-level access, staff authorization boundaries, and anti-tamper permissions using the Firestore emulator.*
- **Integration/Contract Tests (REST Endpoints)**:
  ```bash
  npm run test:backend
  ```
  *Verifies KMS ticket creation, double-scan check blocks, and fixture scheduling conflict alerts.*

---

## 🔒 Security & Compliance Checklist

### Zero Trust & Microservices
- [x] All service-to-service endpoints are decoupled and authenticate via IAM Service Accounts (no shared keys).
- [x] Firestore security rules block unauthorized writes and restrict read tokens at the document field level.

### Cryptographic Security & Anti-Fraud
- [x] QR code tickets are sealed using JWT-HMAC signatures, representing a **Cloud KMS** KMS signer.
- [x] Double scans are blocked instantly via in-memory and Redis caches to prevent ticket replay attacks.

### Privacy-First Analytics (Edge Processing)
- [x] CCTV camera video streams are parsed at the venue boundary. Only anonymized integer count aggregates (persons detected per zone) are sent to the Cloud Run API. No facial profiles are processed or stored.

### Log Redaction
- [x] Express logging services scrub PII variables (`phone`, `email`, `idScan`, `name`) before forwarding logs to **Google Cloud Logging**.

---

## ♿ Accessibility (WCAG 2.1 AA) Checklist

### Screen Reader Support & ARIA Controls
- [x] Tab lists and portal selections are tagged with explicit role contexts (`role="tab"`, `role="tablist"`, `aria-selected`).
- [x] Indoor SVG wayfinding maps are equipped with descriptions for screen readers.

### Audio-Visual Feedback Integration
- [x] Interactive tickets invoke the browser's native **SpeechSynthesis** engine to read scan confirmations out loud (*"Access Granted! Seat Block 3B..."*), supporting visually impaired fans.

### High Contrast & Responsive Zoom
- [x] Visual theme implements high-contrast color metrics (ratio $\ge$ 4.5:1) using light teal `#00f5d4` on dark blue `#0b0f19` surfaces.
- [x] Glassmorphism structures scale fluidly up to **200% zoom** without clipping text blocks or layout boundaries.
