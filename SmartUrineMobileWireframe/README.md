# Smart Urine Monitoring – Mobile Application Wireframe

Interactive HTML/CSS/JavaScript wireframe for the **Smart Urine Monitoring: A Real-Time, Sensor-Based Approach to Fluid Balance Management in Healthcare** project.

## What is included

The GitHub Pages demo contains the requested core interfaces:

1. **Login** – clinician/work-email demo login.
2. **QR scan** – camera-based QR screen with a demo fallback.
3. **Patient details** – patient, ward, bed, urinary bag and Nesso N1 device linkage.
4. **Fluid balance / prototype input** – urine volume plus pulse, turbidity and voltage values based on the current Nesso N1 data stream.
5. **Alert / notification** – automatically generated when urine volume is above the saved threshold.
6. **Threshold setting** – patient-specific high-volume threshold with numeric and slider controls.

Additional demonstration feature: **Web Serial** support is included for desktop Chromium browsers. It expects prototype logger lines in this format:

```text
time_ms,volume_ml,pulses,turbidity_raw,vout,vin,status
```

Example from the prototype demo:

```text
103318,50.4,226,1731,1.39,2.09,CLOUDY
```

If Web Serial is unavailable, all screens can still be demonstrated using the built-in sample sensor feed.

## Files

```text
SmartUrineMobileWireframe/
├── README.md
└── docs/
    ├── index.html
    ├── styles.css
    └── app.js
```

## Add it to the existing GitHub project

Repository: https://github.com/SangeetaBhattacharya/Project

### Option A – use `docs/` as the GitHub Pages site

Copy the three files from this package's `docs/` directory into a `docs/` directory at the root of the existing `Project` repository.

Then in GitHub:

1. Open **Project → Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `main` branch and `/docs` folder.
4. Save.

The expected GitHub Pages address will be:

```text
https://sangeetabhattacharya.github.io/Project/
```

### Option B – if GitHub Pages is already deployed from the repository root

Create a folder such as `mobile-wireframe/`, place `index.html`, `styles.css` and `app.js` inside it, and access:

```text
https://sangeetabhattacharya.github.io/Project/mobile-wireframe/
```

## Links to existing prototype work

The Settings screen in the wireframe includes links to:

- Project repository
- `urine_meter_nesso_n1_wifi_laptop_excel.ino`
- `urine_meter_nesso_n1_wifi_excel.ino`
- Existing Nesso N1 Sensor Logger shown in the demonstration video: `https://sangeetabhattacharya.github.io/index/`

If the firmware files live in a subfolder or use a different branch, edit the three links near the bottom of `docs/index.html`.

## Demonstration path

For a presentation, use this sequence:

1. **Sign in** using the pre-filled demo credentials.
2. On **Scan**, click **Use demo QR code**.
3. Review **Patient details**.
4. Open **Fluid balance** to show the prototype reading.
5. Open **Settings**, change the threshold to **100 mL**, and save.
6. On Fluid balance, click **+50 mL demo** twice. The reading will exceed the threshold and create an alert.
7. Open **Alerts** to show the notification history.
8. Optionally use **Connect Web Serial** on a desktop Chromium browser with the Nesso N1 attached at 115200 baud.

## Clinical / security note

This is a demonstrator/wireframe only. The login is not authenticated, the patient record is fictitious, local storage is used only for the demo threshold, and there is no clinical backend, audit trail, encryption scheme, EHR connection or validated alarm mechanism. Those would be separate production requirements.
