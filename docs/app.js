const MONITORING_WINDOW_MINUTES = 3;

const DEFAULT_WINDOW_MIN_ML = 50;
const DEFAULT_WINDOW_MAX_ML = 150;

const STORAGE_ROWS =
  `smartUrineFluidRows_${MONITORING_WINDOW_MINUTES}min`;

const STORAGE_WINDOW_MIN =
  `urineWindowMinMl_${MONITORING_WINDOW_MINUTES}min`;

const STORAGE_WINDOW_MAX =
  `urineWindowMaxMl_${MONITORING_WINDOW_MINUTES}min`;

const SESSION_LAST_SENSOR =
  'smartUrineLastSensorTotal';


const DEMO_BAG_QR =
  'BAG=UB-2026-001|' +
  'PATIENT=P-0001|' +
  'DEVICE=NC-72X|' +
  'CAPACITY_ML=200';


const state = {

  loggedIn: false,
  currentView: 'scan',
  scanned: false,

  reading: {
    volume: 0,
    pulses: 0,
    turbidityRaw: 0,
    vout: 0,
    vin: 0,
    clarity: 'UNKNOWN'
  },

  bag: {
    id: null,
    patientId: 'P-0001',
    deviceId: null,
    capacityMl: 0,
    startSensorTotal: 0,
    sessionId: null
  },

  urineLimits: {

    minMl:
      Number(
        localStorage.getItem(
          STORAGE_WINDOW_MIN
        )
      ) || DEFAULT_WINDOW_MIN_ML,

    maxMl:
      Number(
        localStorage.getItem(
          STORAGE_WINDOW_MAX
        )
      ) || DEFAULT_WINDOW_MAX_ML

  },

  notifications: [],

  serial: {
    port: null,
    reader: null,
    connected: false
  },

  fluidRows:
    loadFluidRows(),

  lastSensorTotal:
    sessionStorage.getItem(
      SESSION_LAST_SENSOR
    ) !== null
      ? Number(
          sessionStorage.getItem(
            SESSION_LAST_SENSOR
          )
        )
      : null,

  liveSource:
    'Waiting for live feed'
};


const titles = {
  scan: 'Scan urinary bag',
  patient: 'Patient details',
  dashboard: 'Live urine monitoring',
  chart: 'Fluid balance chart',
  notifications: 'Alerts & notifications',
  settings: 'Settings'
};


const $ =
  id =>
    document.getElementById(
      id
    );


/* =====================================
   ALERT SOUNDS
===================================== */

let audioContext = null;


function initialiseAudio() {

  if (
    !audioContext
  ) {

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;


    if (
      !AudioContextClass
    ) {

      return null;

    }


    audioContext =
      new AudioContextClass();

  }


  if (
    audioContext.state ===
    'suspended'
  ) {

    audioContext
      .resume()
      .catch(
        () => {}
      );

  }


  return audioContext;

}


function playTone(
  frequency,
  startDelay,
  duration,
  volume = 0.06,
  type = 'sine'
) {

  const context =
    initialiseAudio();


  if (
    !context
  ) {

    return;

  }


  const oscillator =
    context.createOscillator();


  const gain =
    context.createGain();


  const start =
    context.currentTime +
    startDelay;


  const end =
    start +
    duration;


  oscillator.type =
    type;


  oscillator.frequency
    .setValueAtTime(
      frequency,
      start
    );


  gain.gain
    .setValueAtTime(
      0.0001,
      start
    );


  gain.gain
    .exponentialRampToValueAtTime(
      volume,
      start + 0.02
    );


  gain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      end
    );


  oscillator.connect(
    gain
  );


  gain.connect(
    context.destination
  );


  oscillator.start(
    start
  );


  oscillator.stop(
    end + 0.02
  );

}


function playBagAlertSound() {

  initialiseAudio();


  /*
    BAG ALERT:
    gentle rising chime
  */

  playTone(
    523.25,
    0.00,
    0.14,
    0.05,
    'sine'
  );


  playTone(
    659.25,
    0.16,
    0.14,
    0.05,
    'sine'
  );


  playTone(
    783.99,
    0.32,
    0.22,
    0.055,
    'sine'
  );

}


function playUrineAlertSound() {

  initialiseAudio();


  /*
    URINE OUTPUT ALERT:
    separate urgent pattern
  */

  playTone(
    880,
    0.00,
    0.12,
    0.065,
    'square'
  );


  playTone(
    660,
    0.18,
    0.12,
    0.065,
    'square'
  );


  playTone(
    880,
    0.36,
    0.20,
    0.07,
    'square'
  );

}


/* =====================================
   GENERAL
===================================== */


function toast(
  message
) {

  const el =
    $('toast');


  el.textContent =
    message;


  el.classList.add(
    'show'
  );


  clearTimeout(
    toast.timer
  );


  toast.timer =
    setTimeout(
      () =>
        el.classList.remove(
          'show'
        ),
      2200
    );

}


function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
  .replace(
    /[&<>'"]/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character])
  );

}


/* =====================================
   LOGIN
===================================== */


function login() {

  initialiseAudio();


  $('login-screen')
    .classList
    .remove(
      'active'
    );


  $('app-screen')
    .classList
    .add(
      'active'
    );


  state.loggedIn =
    true;


  showView(
    'scan'
  );

}


/* =====================================
   NAVIGATION
===================================== */


function showView(
  name
) {

  state.currentView =
    name;


  document
    .querySelectorAll(
      '.view'
    )
    .forEach(
      view => {

        view.classList.toggle(
          'active',
          view.dataset.view ===
            name
        );

      }
    );


  document
    .querySelectorAll(
      '.nav-item'
    )
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset.go ===
            name
        );

      }
    );


  $('page-title')
    .textContent =
      titles[name] ||
      'Smart Urine Monitoring';


  if (
    name ===
    'dashboard'
  ) {

    updateDashboard();

  }


  if (
    name ===
    'chart'
  ) {

    renderFluidChart();

  }


  if (
    name ===
    'notifications'
  ) {

    renderNotifications();

  }


  if (
    name ===
    'settings'
  ) {

    syncSettings();

  }

}


/* =====================================
   QR CODE / BAG
===================================== */


function parseBagQr(
  rawValue
) {

  const fields =
    {};


  String(
    rawValue
  )
  .split(
    '|'
  )
  .forEach(
    part => {

      const position =
        part.indexOf(
          '='
        );


      if (
        position ===
        -1
      ) {

        return;

      }


      const key =
        part
          .slice(
            0,
            position
          )
          .trim()
          .toUpperCase();


      const value =
        part
          .slice(
            position + 1
          )
          .trim();


      if (
        key &&
        value
      ) {

        fields[key] =
          value;

      }

    }
  );


  const capacity =
    Number(
      fields.CAPACITY_ML
    );


  if (
    !fields.BAG ||
    !Number.isFinite(
      capacity
    ) ||
    capacity <=
    0
  ) {

    throw new Error(
      'Invalid urinary bag QR code: BAG and CAPACITY_ML are required.'
    );

  }


  return {
    bag:
      fields.BAG,

    patient:
      fields.PATIENT ||
      'P-0001',

    device:
      fields.DEVICE ||
      'Unknown device',

    capacityMl:
      capacity
  };

}


function applyScannedBag(
  rawValue,
  sourceLabel =
    'QR scan'
) {

  try {

    initialiseAudio();


    const bag =
      parseBagQr(
        rawValue
      );


    state.bag = {

      id:
        bag.bag,

      patientId:
        bag.patient,

      deviceId:
        bag.device,

      capacityMl:
        bag.capacityMl,

      startSensorTotal:
        Number(
          state.reading.volume ||
          0
        ),

      sessionId:
        `${bag.bag}-${Date.now()}`

    };


    state.scanned =
      true;


    $('scan-message')
      .textContent =
        `${sourceLabel}: ` +
        `${bag.bag} linked. ` +
        `Capacity ${bag.capacityMl} mL.`;


    $('last-scan-time')
      .textContent =
        new Date()
          .toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          );


    updateBagIdentityUi();

    evaluateBagCapacity();


    toast(
      'Urinary bag linked successfully'
    );


    setTimeout(
      () =>
        showView(
          'patient'
        ),
      350
    );


    return true;

  } catch (
    error
  ) {

    $('scan-message')
      .textContent =
        error.message ||
        String(
          error
        );


    toast(
      'Bag QR could not be read'
    );


    return false;

  }

}


function completeDemoScan() {

  applyScannedBag(
    DEMO_BAG_QR,
    'Demo QR'
  );

}


function updateBagIdentityUi() {

  const bagId =
    state.bag.id ||
    'Not scanned';


  const patientId =
    state.bag.patientId ||
    'P-0001';


  const deviceId =
    state.bag.deviceId ||
    'Not linked';


  const capacity =
    state.bag.capacityMl >
    0
      ? state.bag.capacityMl
      : '—';


  $('patient-id')
    .textContent =
      patientId;


  $('patient-bag-id')
    .textContent =
      bagId;


  $('patient-bag-capacity')
    .textContent =
      capacity;


  $('patient-device-id')
    .textContent =
      deviceId;


  $('dashboard-patient')
    .textContent =
      patientId;


  $('dashboard-bag')
    .textContent =
      state.bag.id ||
      'NO BAG';


  $('settings-bag-id')
    .textContent =
      bagId;


  $('settings-bag-capacity')
    .textContent =
      capacity;


  $('settings-patient-id')
    .textContent =
      patientId;

}


/* =====================================
   QR CAMERA
===================================== */


async function startCamera() {

  initialiseAudio();


  const card =
    document.querySelector(
      '.camera-card'
    );


  try {

    const stream =
      await navigator
        .mediaDevices
        .getUserMedia({
          video: {
            facingMode: {
              ideal:
                'environment'
            }
          },
          audio:
            false
        });


    $('camera')
      .srcObject =
        stream;


    await $('camera')
      .play();


    card.classList.add(
      'camera-on'
    );


    $('scan-message')
      .textContent =
        'Camera active. Looking for a QR code…';


    if (
      'BarcodeDetector'
      in window
    ) {

      const detector =
        new BarcodeDetector({
          formats:
            [
              'qr_code'
            ]
        });


      const scanLoop =
        async () => {

          if (
            !card.classList.contains(
              'camera-on'
            )
          ) {

            return;

          }


          try {

            const codes =
              await detector.detect(
                $('camera')
              );


            if (
              codes.length
            ) {

              stopCamera();


              applyScannedBag(
                codes[0].rawValue,
                'QR scan'
              );


              return;

            }

          } catch (
            error
          ) {

          }


          requestAnimationFrame(
            scanLoop
          );

        };


      scanLoop();

    } else {

      $('scan-message')
        .textContent =
          'Camera active, but this browser ' +
          'does not support QR detection. ' +
          'Use Demo QR.';

    }

  } catch (
    error
  ) {

    $('scan-message')
      .textContent =
        'Camera permission unavailable. Use Demo QR.';


    toast(
      'Camera could not be started'
    );

  }

}


function stopCamera() {

  const video =
    $('camera');


  if (
    video.srcObject
  ) {

    video
      .srcObject
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  video.srcObject =
    null;


  document
    .querySelector(
      '.camera-card'
    )
    .classList
    .remove(
      'camera-on'
    );

}


/* =====================================
   BAG CAPACITY
===================================== */


function getCurrentBagVolume() {

  if (
    !state.bag.id ||
    !state.bag.capacityMl
  ) {

    return 0;

  }


  const sensorTotal =
    Number(
      state.reading.volume ||
      0
    );


  let start =
    Number(
      state.bag.startSensorTotal ||
      0
    );


  if (
    sensorTotal <
    start
  ) {

    start =
      0;


    state.bag.startSensorTotal =
      0;

  }


  return Math.max(
    0,
    sensorTotal -
    start
  );

}


function getBagFillStatus() {

  const capacity =
    Number(
      state.bag.capacityMl ||
      0
    );


  if (
    capacity <=
    0
  ) {

    return {
      percentage: 0,
      level: 'unknown',
      shortLabel: 'Bag not scanned',
      message:
        'Scan the urinary bag to load its capacity.'
    };

  }


  const volume =
    getCurrentBagVolume();


  const percentage =
    (
      volume /
      capacity
    ) *
    100;


  if (
    percentage >
    100
  ) {

    return {
      percentage,
      level: 'overflow',
      shortLabel: 'Overflow risk',
      message:
        `Overflow risk: ` +
        `${volume.toFixed(0)} mL recorded ` +
        `in a ${capacity} mL bag.`
    };

  }


  if (
    percentage >=
    100
  ) {

    return {
      percentage,
      level: 'full',
      shortLabel: 'Full',
      message:
        'Urinary bag has reached full capacity. Replace the bag.'
    };

  }


  if (
    percentage >=
    90
  ) {

    return {
      percentage,
      level: 'nearly-full',
      shortLabel: 'Nearly full',
      message:
        'Urinary bag is at least 90% full.'
    };

  }


  if (
    percentage >=
    75
  ) {

    return {
      percentage,
      level: 'three-quarter',
      shortLabel: '75% full',
      message:
        'Urinary bag is approximately three-quarters full.'
    };

  }


  if (
    percentage >=
    50
  ) {

    return {
      percentage,
      level: 'half',
      shortLabel: 'Half full',
      message:
        'Urinary bag is approximately half full.'
    };

  }


  return {
    percentage,
    level: 'normal',
    shortLabel: 'Below half',
    message:
      'Urinary bag is below half capacity.'
  };

}


function evaluateBagCapacity() {

  if (
    !state.bag.id ||
    !state.bag.capacityMl
  ) {

    return;

  }


  const status =
    getBagFillStatus();


  const prefix =
    state.bag.sessionId ||
    state.bag.id;


  let key = null;
  let title = null;
  let message = null;


  if (
    status.level ===
    'overflow'
  ) {

    key =
      `${prefix}-bag-overflow`;

    title =
      'URGENT: Urinary bag overflow risk';

    message =
      status.message;

  } else if (
    status.level ===
    'full'
  ) {

    key =
      `${prefix}-bag-100`;

    title =
      'Urinary bag full';

    message =
      status.message;

  } else if (
    status.level ===
    'nearly-full'
  ) {

    key =
      `${prefix}-bag-90`;

    title =
      'Urinary bag nearly full';

    message =
      status.message;

  } else if (
    status.level ===
    'three-quarter'
  ) {

    key =
      `${prefix}-bag-75`;

    title =
      'Urinary bag 75% full';

    message =
      status.message;

  } else if (
    status.level ===
    'half'
  ) {

    key =
      `${prefix}-bag-50`;

    title =
      'Urinary bag half full';

    message =
      status.message;

  }


  if (
    !key
  ) {

    return;

  }


  const added =
    addNotification(
      key,
      title,
      message,
      'bag'
    );


  if (
    added
  ) {

    showMainAlert(
      title,
      message
    );


    playBagAlertSound();

  }

}


/* =====================================
   SENSOR DATA
===================================== */


function normalizeReading(
  input
) {

  if (
    !input ||
    typeof input !==
      'object'
  ) {

    return null;

  }


  const volume =
    Number(
      input.volume ??
      input.volume_ml ??
      input.totalVolumeMl ??
      input.total_volume_ml
    );


  if (
    !Number.isFinite(
      volume
    )
  ) {

    return null;

  }


  return {
    volume,

    pulses:
      Number(
        input.pulses ??
        input.pulseCount ??
        input.pulse_count ??
        0
      ),

    turbidityRaw:
      Number(
        input.turbidityRaw ??
        input.turbidity_raw ??
        input.raw ??
        0
      ),

    vout:
      Number(
        input.vout ??
        input.Vout ??
        0
      ),

    vin:
      Number(
        input.vin ??
        input.Vin ??
        input.turbidity_v ??
        0
      ),

    clarity:
      String(
        input.clarity ??
        input.status ??
        'UNKNOWN'
      )
      .toUpperCase()
  };

}


function acceptLiveReading(
  input,
  source =
    'Live feed'
) {

  const reading =
    normalizeReading(
      input
    );


  if (
    !reading
  ) {

    return false;

  }


  state.reading =
    reading;


  state.liveSource =
    source;


  $('feed-time')
    .textContent =
      new Date()
        .toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }
        );


  $('connection-pill')
    .textContent =
      source;


  $('connection-pill')
    .classList
    .add(
      'success'
    );


  $('settings-source')
    .textContent =
      source;


  processWindowSensorVolume(
    reading.volume
  );


  evaluateBagCapacity();


  updateDashboard();


  if (
    state.currentView ===
    'chart'
  ) {

    renderFluidChart();

  }


  return true;

}


function parsePrototypeLine(
  line
) {

  const clean =
    String(
      line ||
      ''
    )
    .trim();


  if (
    !clean
  ) {

    return false;

  }


  const parts =
    clean
      .split(',')
      .map(
        value =>
          value.trim()
      );


  if (
    parts.length >=
    7
  ) {

    const [
      timeMs,
      volume,
      pulses,
      raw,
      vout,
      vin,
      status
    ] =
      parts;


    const numbers =
      [
        volume,
        pulses,
        raw,
        vout,
        vin
      ]
      .map(
        Number
      );


    if (
      !numbers.some(
        Number.isNaN
      )
    ) {

      return acceptLiveReading(
        {
          volume:
            numbers[0],

          pulses:
            numbers[1],

          turbidityRaw:
            numbers[2],

          vout:
            numbers[3],

          vin:
            numbers[4],

          clarity:
            status
        },

        'Nesso N1 Web Serial'
      );

    }

  }


  return false;

}


/* =====================================
   DIRECT WEB SERIAL
===================================== */


async function connectSerial() {

  initialiseAudio();


  if (
    !(
      'serial'
      in navigator
    )
  ) {

    $('serial-status')
      .textContent =
        'Web Serial unavailable. ' +
        'Use desktop Chrome/Edge ' +
        'or use the separate Sensor Logger.';


    return;

  }


  try {

    state.serial.port =
      await navigator
        .serial
        .requestPort();


    await state.serial.port
      .open({
        baudRate:
          115200
      });


    state.serial.connected =
      true;


    state.liveSource =
      'Nesso N1 Web Serial';


    $('settings-source')
      .textContent =
        state.liveSource;


    const decoder =
      new TextDecoderStream();


    state.serial.port
      .readable
      .pipeTo(
        decoder.writable
      );


    state.serial.reader =
      decoder
        .readable
        .getReader();


    let buffer =
      '';


    while (
      state.serial.connected
    ) {

      const {
        value,
        done
      } =
        await state.serial
          .reader
          .read();


      if (
        done
      ) {

        break;

      }


      buffer +=
        value ||
        '';


      const lines =
        buffer.split(
          /\r?\n/
        );


      buffer =
        lines.pop();


      lines.forEach(
        parsePrototypeLine
      );

    }

  } catch (
    error
  ) {

    $('serial-status')
      .textContent =
        `Serial connection not completed: ` +
        `${error.message || error}`;

  }

}


/* =====================================
   DEMO SENSOR READING
===================================== */


function simulateReading() {

  initialiseAudio();


  if (
    state.lastSensorTotal ===
      null ||
    !Number.isFinite(
      state.lastSensorTotal
    )
  ) {

    state.lastSensorTotal =
      Number(
        state.reading.volume ||
        0
      );


    sessionStorage.setItem(
      SESSION_LAST_SENSOR,
      String(
        state.lastSensorTotal
      )
    );

  }


  acceptLiveReading(
    {
      volume:
        Number(
          state.reading.volume ||
          0
        ) +
        25,

      pulses:
        Number(
          state.reading.pulses ||
          0
        ) +
        112,

      turbidityRaw:
        1720 +
        Math.floor(
          Math.random() *
          40
        ),

      vout:
        1.36 +
        Math.random() *
        0.06,

      vin:
        2.04 +
        Math.random() *
        0.09,

      clarity:
        'CLOUDY'
    },

    'Demo feed'
  );

}


/* =====================================
   STORAGE
===================================== */


function loadFluidRows() {

  try {

    const rows =
      JSON.parse(
        localStorage.getItem(
          STORAGE_ROWS
        ) ||
        '[]'
      );


    return Array.isArray(
      rows
    )
      ? rows
      : [];

  } catch (
    error
  ) {

    return [];

  }

}


function saveFluidRows() {

  localStorage.setItem(
    STORAGE_ROWS,
    JSON.stringify(
      state.fluidRows
    )
  );

}


/* =====================================
   3-MINUTE MONITORING WINDOWS
===================================== */


function windowKey(
  date =
    new Date()
) {

  const current =
    new Date(
      date
    );


  const bucketStartMinute =
    Math.floor(
      current.getMinutes() /
      MONITORING_WINDOW_MINUTES
    ) *
    MONITORING_WINDOW_MINUTES;


  current.setMinutes(
    bucketStartMinute,
    0,
    0
  );


  return current.toISOString();

}


function windowLabel(
  key
) {

  const start =
    new Date(
      key
    );


  const end =
    new Date(
      start.getTime() +
      (
        MONITORING_WINDOW_MINUTES -
        1
      ) *
      60 *
      1000
    );


  const format =
    date =>
      `${String(
        date.getHours()
      ).padStart(
        2,
        '0'
      )}:` +
      `${String(
        date.getMinutes()
      ).padStart(
        2,
        '0'
      )}`;


  return (
    `${format(start)}` +
    `–` +
    `${format(end)}`
  );

}


function makeRow(
  key =
    windowKey()
) {

  return {
    key,
    oral: '',
    ivFluids: '',
    ivMeds: '',
    urine: 0,
    drain: '',
    vomit: '',
    initials: '',
    sensorSeen: false
  };

}


function getOrCreateCurrentRow() {

  const key =
    windowKey();


  let row =
    state.fluidRows
      .find(
        current =>
          current.key ===
          key
      );


  if (
    !row
  ) {

    row =
      makeRow(
        key
      );


    state.fluidRows
      .push(
        row
      );


    state.fluidRows
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            a.key
          ) -
          new Date(
            b.key
          )
      );


    saveFluidRows();

  }


  return row;

}


function asNumber(
  value
) {

  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


/* =====================================
   AUTOMATIC URINE LOGGING
===================================== */


function processWindowSensorVolume(
  cumulativeVolume
) {

  const current =
    Number(
      cumulativeVolume
    );


  if (
    !Number.isFinite(
      current
    ) ||
    current <
    0
  ) {

    return;

  }


  const row =
    getOrCreateCurrentRow();


  row.sensorSeen =
    true;


  if (
    state.lastSensorTotal ===
      null ||
    !Number.isFinite(
      state.lastSensorTotal
    )
  ) {

    state.lastSensorTotal =
      current;


    sessionStorage.setItem(
      SESSION_LAST_SENSOR,
      String(
        current
      )
    );


    saveFluidRows();


    evaluateCompletedWindows();


    return;

  }


  const previous =
    state.lastSensorTotal;


  let delta;


  if (
    current +
    0.5 <
    previous
  ) {

    delta =
      current;


    addNotification(
      `nesso-reset-${Date.now()}`,
      'Nesso N1 volume counter reset',
      'A lower cumulative sensor value was received. Monitoring continued from the new counter.',
      'window'
    );

  } else {

    delta =
      current -
      previous;

  }


  state.lastSensorTotal =
    current;


  sessionStorage.setItem(
    SESSION_LAST_SENSOR,
    String(
      current
    )
  );


  if (
    delta >
    0.01 &&
    delta <=
    5000
  ) {

    row.urine =
      Math.round(
        (
          asNumber(
            row.urine
          ) +
          delta
        ) *
        10
      ) /
      10;

  }


  saveFluidRows();


  evaluateUrineWindow(
    row,
    false
  );


  evaluateCompletedWindows();

}


/* =====================================
   3-MINUTE URINE THRESHOLDS
===================================== */


function evaluateUrineWindow(
  row,
  windowCompleted =
    false
) {

  if (
    !row ||
    !row.sensorSeen
  ) {

    return;

  }


  const urine =
    asNumber(
      row.urine
    );


  const min =
    state.urineLimits.minMl;


  const max =
    state.urineLimits.maxMl;


  const label =
    windowLabel(
      row.key
    );


  /*
    HIGH:
    > 150 mL in 3 minutes.
  */

  if (
    urine >
    max
  ) {

    const message =
      `${label}: ` +
      `${urine.toFixed(1)} mL ` +
      `has been recorded. ` +
      `Upper ${MONITORING_WINDOW_MINUTES}-minute ` +
      `threshold is ${max} mL.`;


    const added =
      addNotification(
        `window-high-${row.key}-${max}`,
        `High urine output in ${MONITORING_WINDOW_MINUTES}-minute window`,
        message,
        'window'
      );


    if (
      added
    ) {

      showMainAlert(
        `High urine output in ${MONITORING_WINDOW_MINUTES}-minute window`,
        message
      );


      playUrineAlertSound();

    }

  }


  /*
    LOW:
    < 50 mL after 3 minutes.
  */

  if (
    windowCompleted &&
    urine <
    min
  ) {

    const message =
      `${label}: ` +
      `${urine.toFixed(1)} mL ` +
      `was recorded. ` +
      `Lower ${MONITORING_WINDOW_MINUTES}-minute ` +
      `threshold is ${min} mL.`;


    const added =
      addNotification(
        `window-low-${row.key}-${min}`,
        `Low urine output in ${MONITORING_WINDOW_MINUTES}-minute window`,
        message,
        'window'
      );


    if (
      added
    ) {

      showMainAlert(
        `Low urine output in ${MONITORING_WINDOW_MINUTES}-minute window`,
        message
      );


      playUrineAlertSound();

    }

  }

}


function evaluateCompletedWindows() {

  const currentWindow =
    windowKey();


  state.fluidRows
    .forEach(
      row => {

        if (
          row.key !==
            currentWindow &&
          row.sensorSeen
        ) {

          evaluateUrineWindow(
            row,
            true
          );

        }

      }
    );

}


function getCurrentWindowRow() {

  return (
    state.fluidRows
      .find(
        row =>
          row.key ===
          windowKey()
      ) ||
    getOrCreateCurrentRow()
  );

}


function getCurrentWindowStatus() {

  const row =
    getCurrentWindowRow();


  const urine =
    asNumber(
      row.urine
    );


  const min =
    state.urineLimits.minMl;


  const max =
    state.urineLimits.maxMl;


  if (
    !row.sensorSeen
  ) {

    return {
      label:
        'Waiting for sensor',
      level:
        'unknown'
    };

  }


  if (
    urine >
    max
  ) {

    return {
      label:
        'Above upper threshold',
      level:
        'danger'
    };

  }


  if (
    urine <
    min
  ) {

    return {
      label:
        'Below lower threshold so far',
      level:
        'warning'
    };

  }


  return {
    label:
      'Within configured range',
    level:
      'success'
  };

}


function saveWindowThresholds(
  minValue,
  maxValue
) {

  const min =
    Number(
      minValue
    );


  const max =
    Number(
      maxValue
    );


  if (
    !Number.isFinite(
      min
    ) ||
    !Number.isFinite(
      max
    ) ||
    min <
    0 ||
    max <=
    min
  ) {

    toast(
      'Check the monitoring threshold values'
    );


    return false;

  }


  state.urineLimits.minMl =
    min;


  state.urineLimits.maxMl =
    max;


  localStorage.setItem(
    STORAGE_WINDOW_MIN,
    String(
      min
    )
  );


  localStorage.setItem(
    STORAGE_WINDOW_MAX,
    String(
      max
    )
  );


  toast(
    `${MONITORING_WINDOW_MINUTES}-minute range saved: ` +
    `${min}–${max} mL`
  );


  evaluateUrineWindow(
    getCurrentWindowRow(),
    false
  );


  updateDashboard();


  return true;

}


/* =====================================
   DASHBOARD
===================================== */


function updateDashboard() {

  const reading =
    state.reading;


  const bag =
    getBagFillStatus();


  const bagVolume =
    getCurrentBagVolume();


  const currentRow =
    getCurrentWindowRow();


  const windowStatus =
    getCurrentWindowStatus();


  $('sensor-total-value')
    .textContent =
      Number(
        reading.volume ||
        0
      )
      .toFixed(
        1
      );


  $('pulses-value')
    .textContent =
      Math.round(
        Number(
          reading.pulses ||
          0
        )
      );


  $('raw-value')
    .textContent =
      Math.round(
        Number(
          reading.turbidityRaw ||
          0
        )
      );


  $('vout-value')
    .textContent =
      Number(
        reading.vout ||
        0
      )
      .toFixed(
        2
      );


  $('vin-value')
    .textContent =
      Number(
        reading.vin ||
        0
      )
      .toFixed(
        2
      );


  $('clarity-value')
    .textContent =
      reading.clarity ||
      'UNKNOWN';


  $('bag-volume-value')
    .textContent =
      bagVolume
        .toFixed(
          1
        );


  $('bag-percent')
    .textContent =
      Math.max(
        0,
        bag.percentage
      )
      .toFixed(
        0
      );


  $('bag-capacity-display')
    .textContent =
      state.bag.capacityMl >
      0
        ? state.bag.capacityMl
        : '—';


  $('bag-fill-status')
    .textContent =
      bag.shortLabel;


  $('bag-message')
    .textContent =
      bag.message;


  $('bag-progress')
    .style
    .width =
      `${Math.min(
        Math.max(
          bag.percentage,
          0
        ),
        100
      )}%`;


  $('bag-progress')
    .classList
    .toggle(
      'warning',
      [
        'half',
        'three-quarter',
        'nearly-full'
      ]
      .includes(
        bag.level
      )
    );


  $('bag-progress')
    .classList
    .toggle(
      'danger',
      [
        'full',
        'overflow'
      ]
      .includes(
        bag.level
      )
    );


  $('bag-fill-status')
    .classList
    .toggle(
      'warning',
      [
        'half',
        'three-quarter',
        'nearly-full'
      ]
      .includes(
        bag.level
      )
    );


  $('bag-fill-status')
    .classList
    .toggle(
      'danger',
      [
        'full',
        'overflow'
      ]
      .includes(
        bag.level
      )
    );


  $('bag-fill-status')
    .classList
    .toggle(
      'success',
      bag.level ===
        'normal'
    );


  $('hourly-urine-value')
    .textContent =
      asNumber(
        currentRow.urine
      )
      .toFixed(
        1
      );


  $('hourly-range-display')
    .textContent =
      `${state.urineLimits.minMl}` +
      `–` +
      `${state.urineLimits.maxMl}`;


  $('hourly-status')
    .textContent =
      windowStatus.label;


  updateChartLiveStrip();

  updateBagIdentityUi();

  syncSettings();

}


/* =====================================
   SETTINGS
===================================== */


function syncSettings() {

  $('hourly-min-input')
    .value =
      state.urineLimits.minMl;


  $('hourly-max-input')
    .value =
      state.urineLimits.maxMl;


  updateBagIdentityUi();

}


/* =====================================
   ALERT UI
===================================== */


function showMainAlert(
  title,
  message
) {

  $('alert-banner')
    .classList
    .remove(
      'hidden'
    );


  $('alert-title')
    .textContent =
      title;


  $('alert-message')
    .textContent =
      message;

}


function addNotification(
  key,
  title,
  message,
  type =
    'window'
) {

  if (
    state.notifications
      .some(
        notification =>
          notification.key ===
          key
      )
  ) {

    return false;

  }


  state.notifications
    .unshift({
      key,
      title,
      message,
      type,
      time:
        new Date()
    });


  $('notification-dot')
    .classList
    .remove(
      'hidden'
    );


  renderNotifications();


  return true;

}


function renderNotifications() {

  const list =
    $('notification-list');


  if (
    !state.notifications.length
  ) {

    list.innerHTML = `

      <div class="empty-state">

        <div>
          🔔
        </div>

        <strong>
          No alerts yet
        </strong>

        <p>
          Bag-capacity and
          ${MONITORING_WINDOW_MINUTES}-minute
          urine-output alerts
          will appear here.
        </p>

      </div>

    `;


    return;

  }


  list.innerHTML =
    state.notifications
      .map(
        notification => `

          <div
            class="
              card
              notification-card
              ${escapeHtml(notification.type)}
            "
          >

            <strong>
              ${escapeHtml(notification.title)}
            </strong>

            <p>
              ${escapeHtml(notification.message)}
            </p>

            <time>
              ${
                new Date(
                  notification.time
                )
                .toLocaleString()
              }
            </time>

          </div>

        `
      )
      .join('');

}


/* =====================================
   FLUID BALANCE CALCULATIONS
===================================== */


function calculateFluidRows() {

  let runningInput =
    0;


  let runningOutput =
    0;


  return [
    ...state.fluidRows
  ]

  .sort(
    (
      a,
      b
    ) =>
      new Date(
        a.key
      ) -
      new Date(
        b.key
      )
  )

  .map(
    row => {

      runningInput +=
        asNumber(
          row.oral
        ) +
        asNumber(
          row.ivFluids
        ) +
        asNumber(
          row.ivMeds
        );


      runningOutput +=
        asNumber(
          row.urine
        ) +
        asNumber(
          row.drain
        ) +
        asNumber(
          row.vomit
        );


      return {
        ...row,

        runningInput:
          Math.round(
            runningInput *
            10
          ) /
          10,

        runningOutput:
          Math.round(
            runningOutput *
            10
          ) /
          10,

        balance:
          Math.round(
            (
              runningInput -
              runningOutput
            ) *
            10
          ) /
          10
      };

    }
  );

}


function inputCell(
  row,
  field,
  className =
    ''
) {

  const value =
    escapeHtml(
      row[field] ??
      ''
    );


  const type =
    field ===
    'initials'
      ? 'text'
      : 'number';


  const extra =
    type ===
    'number'
      ? 'min="0" step="1" inputmode="decimal"'
      : 'maxlength="4"';


  return `

    <input
      class="${className}"
      type="${type}"
      ${extra}
      value="${value}"
      data-row="${escapeHtml(row.key)}"
      data-field="${field}"
    >

  `;

}


function formatNumber(
  number
) {

  const value =
    Math.round(
      asNumber(
        number
      ) *
      10
    ) /
    10;


  return Number.isInteger(
    value
  )
    ? String(
        value
      )
    : value.toFixed(
        1
      );

}


function formatBalance(
  number
) {

  const value =
    Math.round(
      asNumber(
        number
      ) *
      10
    ) /
    10;


  return value >
    0
      ? `+${formatNumber(value)}`
      : formatNumber(
          value
        );

}


/* =====================================
   RENDER FLUID BALANCE CHART
===================================== */


function renderFluidChart() {

  const body =
    $('fluid-balance-body');


  if (
    !body
  ) {

    return;

  }


  if (
    !state.fluidRows.length
  ) {

    getOrCreateCurrentRow();

  }


  const rows =
    calculateFluidRows();


  body.innerHTML =
    rows
      .map(
        row => `

          <tr>

            <td class="time-cell">
              ${windowLabel(row.key)}
            </td>

            <td>
              ${inputCell(row, 'oral')}
            </td>

            <td>
              ${inputCell(row, 'ivFluids')}
            </td>

            <td>
              ${inputCell(row, 'ivMeds')}
            </td>

            <td class="calc-cell">
              ${formatNumber(row.runningInput)}
            </td>

            <td class="auto-urine">
              ${formatNumber(row.urine)}
            </td>

            <td>
              ${inputCell(row, 'drain')}
            </td>

            <td>
              ${inputCell(row, 'vomit')}
            </td>

            <td class="calc-cell">
              ${formatNumber(row.runningOutput)}
            </td>

            <td
              class="
                calc-cell
                ${
                  row.balance <
                  0
                    ? 'balance-negative'
                    : 'balance-positive'
                }
              "
            >
              ${formatBalance(row.balance)}
            </td>

            <td>
              ${
                inputCell(
                  row,
                  'initials',
                  'initials-input'
                )
              }
            </td>

          </tr>

        `
      )
      .join('');


  body
    .querySelectorAll(
      'input[data-row]'
    )
    .forEach(
      input => {

        input.addEventListener(
          'change',
          handleFluidInput
        );


        input.addEventListener(
          'blur',
          handleFluidInput
        );

      }
    );


  if (
    rows.length
  ) {

    const last =
      rows[
        rows.length -
        1
      ];


    $('summary-input')
      .textContent =
        formatNumber(
          last.runningInput
        );


    $('summary-output')
      .textContent =
        formatNumber(
          last.runningOutput
        );


    $('summary-balance')
      .textContent =
        `${formatBalance(
          last.balance
        )} mL`;


    $('summary-balance')
      .classList
      .toggle(
        'balance-negative',
        last.balance <
        0
      );


    $('summary-balance')
      .classList
      .toggle(
        'balance-positive',
        last.balance >=
        0
      );

  }


  updateChartLiveStrip();

}


function handleFluidInput(
  event
) {

  const element =
    event.target;


  const row =
    state.fluidRows
      .find(
        current =>
          current.key ===
          element.dataset.row
      );


  if (
    !row
  ) {

    return;

  }


  const field =
    element.dataset.field;


  row[field] =
    field ===
    'initials'
      ? element
          .value
          .toUpperCase()
          .trim()
      : element.value;


  saveFluidRows();

  renderFluidChart();

}


function updateChartLiveStrip() {

  if (
    !$(
      'chart-hourly-volume'
    )
  ) {

    return;

  }


  const row =
    getCurrentWindowRow();


  const status =
    getCurrentWindowStatus();


  $('chart-hourly-volume')
    .textContent =
      asNumber(
        row.urine
      )
      .toFixed(
        1
      );


  $('chart-source')
    .textContent =
      `${state.liveSource} · ` +
      `${MONITORING_WINDOW_MINUTES}-minute window`;


  $('chart-hourly-status')
    .textContent =
      status.label;


  $('chart-hourly-status')
    .classList
    .toggle(
      'success',
      status.level ===
      'success'
    );


  $('chart-hourly-status')
    .classList
    .toggle(
      'warning',
      status.level ===
      'warning'
    );


  $('chart-hourly-status')
    .classList
    .toggle(
      'danger',
      status.level ===
      'danger'
    );

}


function addCurrentHourRow() {

  getOrCreateCurrentRow();

  renderFluidChart();


  toast(
    `Current ` +
    `${MONITORING_WINDOW_MINUTES}-minute ` +
    `window added`
  );

}


/* =====================================
   CSV EXPORT
===================================== */


function exportFluidCsv() {

  const rows =
    calculateFluidRows();


  const header =
    [
      'Monitoring_Window',
      'Oral_mL',
      'IV_Fluids_mL',
      'IV_Meds_mL',
      'Running_Input_mL',
      'Urine_Auto_mL',
      'Drain_mL',
      'Vomit_mL',
      'Running_Output_mL',
      'Cumulative_Balance_mL',
      'RN_Initials'
    ];


  const lines =
    [
      header.join(',')
    ];


  rows.forEach(
    row => {

      lines.push(
        [
          `"${windowLabel(row.key)}"`,
          asNumber(
            row.oral
          ),
          asNumber(
            row.ivFluids
          ),
          asNumber(
            row.ivMeds
          ),
          row.runningInput,
          asNumber(
            row.urine
          ),
          asNumber(
            row.drain
          ),
          asNumber(
            row.vomit
          ),
          row.runningOutput,
          row.balance,
          `"${String(
            row.initials ||
            ''
          )
          .replaceAll(
            '"',
            '""'
          )}"`
        ]
        .join(',')
      );

    }
  );


  const blob =
    new Blob(
      [
        lines.join(
          '\n'
        )
      ],
      {
        type:
          'text/csv;charset=utf-8'
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      'a'
    );


  link.href =
    url;


  link.download =
    `fluid-balance-` +
    `${state.bag.patientId || 'patient'}-` +
    `${new Date().toISOString().slice(0,10)}.csv`;


  document.body
    .appendChild(
      link
    );


  link.click();

  link.remove();


  URL.revokeObjectURL(
    url
  );


  toast(
    'Fluid balance CSV exported'
  );

}


/* =====================================
   RESET SESSION
===================================== */


function resetFluidSession() {

  if (
    !confirm(
      'Start a new fluid-balance session? ' +
      'This clears the chart stored in this browser.'
    )
  ) {

    return;

  }


  state.fluidRows =
    [];


  state.lastSensorTotal =
    null;


  localStorage.removeItem(
    STORAGE_ROWS
  );


  sessionStorage.removeItem(
    SESSION_LAST_SENSOR
  );


  getOrCreateCurrentRow();

  renderFluidChart();

  updateDashboard();


  toast(
    'New fluid-balance session started'
  );

}


/* =====================================
   SENSOR LOGGER BRIDGE
===================================== */


const TRUSTED_LOGGER_ORIGINS =
  new Set(
    [
      'http://127.0.0.1:5000',
      'http://localhost:5000'
    ]
  );


function handleBridgePayload(
  payload
) {

  if (
    !payload
  ) {

    return;

  }


  if (
    payload.type &&
    payload.type !==
      'nesso-reading'
  ) {

    return;

  }


  const reading =
    payload.reading ||
    payload;


  acceptLiveReading(
    reading,
    'Nesso N1 Sensor Logger'
  );

}


window.addEventListener(
  'message',
  event => {

    const trusted =
      event.origin ===
        window.location.origin ||
      TRUSTED_LOGGER_ORIGINS
        .has(
          event.origin
        );


    if (
      !trusted
    ) {

      return;

    }


    handleBridgePayload(
      event.data
    );

  }
);


/* =====================================
   EVENT LISTENERS
===================================== */


$('login-form')
  .addEventListener(
    'submit',
    event => {

      event.preventDefault();

      login();

    }
  );


$('demo-login')
  .addEventListener(
    'click',
    login
  );


$('demo-scan')
  .addEventListener(
    'click',
    completeDemoScan
  );


$('start-camera')
  .addEventListener(
    'click',
    startCamera
  );


$('notification-button')
  .addEventListener(
    'click',
    () => {

      showView(
        'notifications'
      );

    }
  );


$('simulate-reading')
  .addEventListener(
    'click',
    simulateReading
  );


$('serial-connect')
  .addEventListener(
    'click',
    connectSerial
  );


$('ack-alert')
  .addEventListener(
    'click',
    () => {

      $('alert-banner')
        .classList
        .add(
          'hidden'
        );


      toast(
        'Alert acknowledged'
      );

    }
  );


document
  .querySelectorAll(
    '[data-go]'
  )
  .forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          initialiseAudio();

          showView(
            button.dataset.go
          );

        }
      );

    }
  );


$('hourly-threshold-form')
  .addEventListener(
    'submit',
    event => {

      event.preventDefault();

      initialiseAudio();


      if (
        saveWindowThresholds(
          $('hourly-min-input')
            .value,
          $('hourly-max-input')
            .value
        )
      ) {

        showView(
          'dashboard'
        );

      }

    }
  );


/*
  DEMO LOW-OUTPUT TEST
*/

$('evaluate-hour-now')
  .addEventListener(
    'click',
    () => {

      initialiseAudio();


      const row =
        getCurrentWindowRow();


      row.sensorSeen =
        true;


      saveFluidRows();


      const notificationsBefore =
        state.notifications.length;


      evaluateUrineWindow(
        row,
        true
      );


      if (
        state.notifications.length ===
        notificationsBefore
      ) {

        const urine =
          asNumber(
            row.urine
          );


        const min =
          state.urineLimits.minMl;


        const max =
          state.urineLimits.maxMl;


        if (
          urine >=
          min &&
          urine <=
          max
        ) {

          showMainAlert(
            `${MONITORING_WINDOW_MINUTES}-minute urine within configured range`,
            `${urine.toFixed(1)} mL ` +
            `is within the configured ` +
            `${min}–${max} mL per ` +
            `${MONITORING_WINDOW_MINUTES} minutes.`
          );

        }

      }


      updateDashboard();

      renderFluidChart();


      toast(
        `Current ` +
        `${MONITORING_WINDOW_MINUTES}-minute ` +
        `window evaluated`
      );

    }
  );


/* SOUND TEST BUTTONS */

$('test-bag-sound')
  .addEventListener(
    'click',
    () => {

      initialiseAudio();

      playBagAlertSound();

      toast(
        'Bag alert sound'
      );

    }
  );


$('test-urine-sound')
  .addEventListener(
    'click',
    () => {

      initialiseAudio();

      playUrineAlertSound();

      toast(
        'Urine-production alert sound'
      );

    }
  );


$('add-current-hour')
  .addEventListener(
    'click',
    addCurrentHourRow
  );


$('export-fluid-csv')
  .addEventListener(
    'click',
    exportFluidCsv
  );


$('reset-fluid-session')
  .addEventListener(
    'click',
    resetFluidSession
  );


/*
  Check every 15 seconds
  for completed 3-minute windows.
*/

setInterval(
  evaluateCompletedWindows,
  15000
);


/* =====================================
   START APPLICATION
===================================== */


getOrCreateCurrentRow();

updateBagIdentityUi();

syncSettings();

updateDashboard();

renderFluidChart();
