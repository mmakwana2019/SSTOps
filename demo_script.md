# SSTOps: Platform Validation & Demo Script

This script guides you through demonstrating the entire end-to-end flow of the **Smart Stadiums & Tournament Operations** platform in a local test environment.

---

## 🎬 Act 1: Local System Boot
1. Run the boot command from the root workspace folder:
   ```bash
   npm run dev
   ```
   *This starts the Firebase Emulator Suite (Firestore, Pub/Sub, Functions, Hosting) and spins up the Express Backend on port 8080.*
2. Open your browser and navigate to the local portal interface:
   `http://localhost:3000`

---

## 🎟️ Act 2: Fan Entry & Ticket Security
1. You will start on the **Fan Portal** tab. Under **Secure Ticket QR Code**, you will see a simulated seat block assignment: `Block 3B, Row G, Seat 24` allocated at `Gate B`.
2. Observe the ticket's signature detail: this metadata is signed cryptographically by the backend simulating **Cloud KMS**.
3. Under the **Indoor Wayfinding Map**, click on the **My Seat (3B)** option. Observe a pulsing neon path highlighting the walking route from **Gate B** directly to your seat.
4. Click on **Simulate Scanning at Gate**.
   - The button turns green and displays: **Access Granted!**
   - The browser synthesizes an audio voice announcement: *"Access Granted! Seat Block 3B. Enjoy the match."* (WCAG AA accessibility validation).
5. Click the QR code block again.
   - The scanner rejects the request and displays: **Fraud Alert: Ticket has already been processed at a gate.**
   - *This validates our Memorystore (Redis) double-scan replay attack prevention.*

---

## 📈 Act 3: Control Room Operations & Live Heatmap
1. Switch to the **Control Room** tab at the top of the screen.
2. In the **Live Concourse Density Heatmap**, notice that **Gate B** has a glowing ring indicating traffic (1 unique entry).
3. Choose the **Security** role filter. The screen adjust elements, showing crowd metrics and surge prediction alerts.
4. Under **Surge Prediction & Response Warnings**, look at the rolling telemetry. If you scan tickets or simulate traffic velocity spikes, you will see a warning:
   - **⚠️ Surge Predicted at Gate B (or Gate D)**
   - Displaying predicted overload lead time (e.g. *+15 mins*) and actionable AI recommendations: *"Critical crowd load! Re-route inbound traffic from local transit to Gate C. Dispatch 4 backup crowd control agents immediately."*

---

## 🚨 Act 4: Incident Logging & Gemini Summaries
1. Under **Log New Control Incident**, input:
   - **Details:** *Water leak detected near Concourse Sector B bathrooms causing slipping hazards.*
   - **Location:** *Sector B*
   - **Severity:** *High*
2. Click **Commit Log**. The incident is written to Firestore and appears immediately in the **Incident Feed**.
3. Now, click on **Generate Handover Summary (Gemini)**.
   - The platform routes the recent incident list to **Vertex AI Gemini API** (using the local high-fidelity simulator).
   - It outputs a shift handover summary document detailing medical, facilities, and crowd actions taken during the operations shift.

---

## 📅 Act 5: Tournament Ops & Conflict Detection
1. Switch to the **Tournament Ops** tab.
2. Under **Schedule Fixture Builder**, let's test conflict prevention:
   - Keep the default date (`2026-07-09`) and venue (`Wankhede Stadium`), which overlaps with the pre-scheduled *Mumbai Challengers vs Delhi Knights* match.
   - Keep the official input containing `A. Rauf`.
3. Click **Schedule Fixture**.
   - The scheduler blocks the write and displays a red warning panel:
     - `Venue Conflict: Wankhede Stadium is already booked on this date.`
     - `Official Assignment Conflict: Match official(s) (A. Rauf) are already assigned on this date.`
     - `Broadcast Slot Conflict: Broadcast slot is already allocated.`
4. Change the venue to `Narendra Modi Stadium` and the official to `Official Kumar`, then click **Schedule Fixture**.
   - The system displays a green checkmark: **Fixture scheduled successfully** and appends it to the schedule list.
5. Under **Post-Match Reporting**, click **Generate Post-Match Operations Report**.
   - Gemini reconciles historical BigQuery ticket metrics and displays a structured narrative report showing a **95.7% turnout rate** and **₹4.87 Crore INR** in ticket revenue.
