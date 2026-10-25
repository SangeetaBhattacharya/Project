const STORAGE_ROWS =
  'smartUrineFluidRowsV3';

const STORAGE_HOURLY_MIN =
  'hourlyUrineMinMl';

const STORAGE_HOURLY_MAX =
  'hourlyUrineMaxMl';

const SESSION_LAST_SENSOR =
  'smartUrineLastSensorTotal';


const DEMO_BAG_QR =
  'BAG=UB-2026-001|' +
  'PATIENT=P-0001|' +
  'DEVICE=NC-72X|' +
  'CAPACITY_ML=2000';


const state = {

  loggedIn:
    false,

  currentView:
    'scan',

  scanned:
    false,

  reading: {

    volume:
      0,

    pulses:
      0,

    turbidityRaw:
      0,

    vout:
      0,

    vin:
      0,

    clarity:
      'UNKNOWN'

  },

  bag: {

    id:
      null,

    patientId:
      'P-0001',

    deviceId:
      null,

    capacityMl:
      0,

    startSensorTotal:
      0,

    sessionId:
      null

  },

  hourlyLimits: {

    minMl:
      Number(
        localStorage.getItem(
          STORAGE_HOURLY_MIN
        )
      ) || 50,

    maxMl:
      Number(
        localStorage.getItem(
          STORAGE_HOURLY_MAX
        )
      ) || 200

  },

  notifications:
    [],

  serial: {

    port:
      null,

    reader:
      null,

    connected:
      false

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

  scan:
    'Scan urinary bag',

  patient:
    'Patient details',

  dashboard:
    'Live urine monitoring',

  chart:
    'Fluid balance chart',

  notifications:
    'Alerts & notifications',

  settings:
    'Settings'

};


const $ =
  id =>
    document.getElementById(
      id
    );


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

    c => ({

      '&':
        '&amp;',

      '<':
        '&lt;',

      '>':
        '&gt;',

      "'":
        '&#39;',

      '"':
        '&quot;'

    }[c])

  );

}


/* LOGIN */

function login() {

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


/* NAVIGATION */

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

      const pos =
        part.indexOf(
          '='
        );


      if (
        pos ===
        -1
      ) {

        return;

      }


      const key =
        part
          .slice(
            0,
            pos
          )
          .trim()
          .toUpperCase();


      const value =
        part
          .slice(
            pos + 1
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
    capacity <= 0
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

      /*
        Record the sensor total
        when this bag is attached.

        Bag fullness then starts
        from zero for this bag.
      */

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

              hour:
                '2-digit',

              minute:
                '2-digit'

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

  } catch (err) {

    $('scan-message')
      .textContent =
        err.message ||
        String(err);


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


async function startCamera() {

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
            ['qr_code']

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

          } catch (_) {}


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

  } catch (err) {

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


  /*
    If the Nesso itself was reset,
    continue from zero.
  */

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
    capacity <= 0
  ) {

    return {

      percentage:
        0,

      level:
        'unknown',

      shortLabel:
        'Bag not scanned',

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
    )
    *
    100;


  if (
    percentage >
    100
  ) {

    return {

      percentage,

      level:
        'overflow',

      shortLabel:
        'Overflow risk',

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

      level:
        'full',

      shortLabel:
        'Full',

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

      level:
        'nearly-full',

      shortLabel:
        'Nearly full',

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

      level:
        'three-quarter',

      shortLabel:
        '75% full',

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

      level:
        'half',

      shortLabel:
        'Half full',

      message:
        'Urinary bag is approximately half full.'

    };

  }


  return {

    percentage,

    level:
      'normal',

    shortLabel:
      'Below half',

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


  const milestones =
    [

      {

        pct:
          50,

        key:
          '50',

        title:
          'Urinary bag half full',

        message:
          'Urinary bag has reached approximately 50% capacity.'

      },

      {

        pct:
          75,

        key:
          '75',

        title:
          'Urinary bag 75% full',

        message:
          'Urinary bag has reached approximately 75% capacity.'

      },

      {

        pct:
          90,

        key:
          '90',

        title:
          'Urinary bag nearly full',

        message:
          'Urinary bag has reached at least 90% capacity.'

      },

      {

        pct:
          100,

        key:
          '100',

        title:
          'Urinary bag full',

        message:
          'Urinary bag has reached full capacity. Replace the bag.'

      }

    ];


  milestones
    .forEach(
      milestone => {

        if (
          status.percentage >=
          milestone.pct
        ) {

          const added =
            addNotification(

              `${prefix}-bag-${milestone.key}`,

              milestone.title,

              milestone.message,

              'bag'

            );


          if (
            added
          ) {

            showMainAlert(

              milestone.title,

              milestone.message

            );

          }

        }

      }
    );


  if (
    status.percentage >
    100
  ) {

    const message =
      `Overflow risk: ` +
      `${getCurrentBagVolume().toFixed(0)} mL ` +
      `is above the ` +
      `${state.bag.capacityMl} mL bag capacity.`;


    const added =
      addNotification(

        `${prefix}-bag-overflow`,

        'URGENT: Urinary bag overflow risk',

        message,

        'bag'

      );


    if (
      added
    ) {

      showMainAlert(

        'URGENT: Urinary bag overflow risk',

        message

      );

    }

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

            hour:
              '2-digit',

            minute:
              '2-digit',

            second:
              '2-digit'

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


  processHourlySensorVolume(
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


    const nums =
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
      !nums.some(
        Number.isNaN
      )
    ) {

      return acceptLiveReading(

        {

          volume:
            nums[0],

          pulses:
            nums[1],

          turbidityRaw:
            nums[2],

          vout:
            nums[3],

          vin:
            nums[4],

          clarity:
            status

        },

        'Nesso N1 Web Serial'

      );

    }

  }


  return false;

}


async function connectSerial() {

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

  } catch (err) {

    $('serial-status')
      .textContent =
        `Serial connection not completed: ` +
        `${err.message || err}`;

  }

}


/* DEMO SENSOR READING */

function simulateReading() {

  /*
    For demo mode, ensure the first
    +250 mL is counted as an increment.
  */

  if (
    state.lastSensorTotal ===
      null

    ||

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
        )
        +
        250,

      pulses:
        Number(
          state.reading.pulses ||
          0
        )
        +
        1120,

      turbidityRaw:
        1720 +
        Math.floor(
          Math.random() *
          40
        ),

      vout:
        1.36 +
        Math.random() *
        .06,

      vin:
        2.04 +
        Math.random() *
        .09,

      clarity:
        'CLOUDY'

    },

    'Demo feed'

  );

}


/* =====================================
   HOURLY FLUID BALANCE
===================================== */

function loadFluidRows() {

  try {

    const rows =
      JSON.parse(

        localStorage.getItem(
          STORAGE_ROWS
        )
        ||
        '[]'

      );


    return Array.isArray(
      rows
    )
      ? rows
      : [];

  } catch (_) {

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


function hourKey(
  date =
    new Date()
) {

  const d =
    new Date(
      date
    );


  d.setMinutes(
    0,
    0,
    0
  );


  return d.toISOString();

}


function hourLabel(
  key
) {

  const d =
    new Date(
      key
    );


  return (

    String(
      d.getHours()
    )
    .padStart(
      2,
      '0'
    )

    +

    '00'

  );

}


function makeRow(
  key =
    hourKey()
) {

  return {

    key,

    oral:
      '',

    ivFluids:
      '',

    ivMeds:
      '',

    urine:
      0,

    drain:
      '',

    vomit:
      '',

    initials:
      '',

    sensorSeen:
      false

  };

}


function getOrCreateCurrentRow() {

  const key =
    hourKey();


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

        (a, b) =>

          new Date(
            a.key
          )

          -

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
   AUTOMATIC HOURLY URINE
===================================== */

function processHourlySensorVolume(
  cumulativeVolume
) {

  const current =
    Number(
      cumulativeVolume
    );


  if (
    !Number.isFinite(
      current
    )
    ||
    current < 0
  ) {

    return;

  }


  const row =
    getOrCreateCurrentRow();


  row.sensorSeen =
    true;


  /*
    First live reading establishes
    the baseline.

    This avoids incorrectly assigning
    old cumulative urine to the
    current hour when the app opens.
  */

  if (
    state.lastSensorTotal ===
      null

    ||

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


    evaluateCompletedHours();


    return;

  }


  const previous =
    state.lastSensorTotal;


  let delta;


  /*
    If the Nesso counter becomes
    smaller, assume the device
    counter was reset.
  */

  if (
    current + 0.5 <
    previous
  ) {

    delta =
      current;


    addNotification(

      `nesso-reset-${Date.now()}`,

      'Nesso N1 volume counter reset',

      'A lower cumulative sensor value was received. ' +
      'Hourly logging continued from the new counter.',

      'hourly'

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


  /*
    Add only NEW urine volume
    to the current hourly row.
  */

  if (
    delta >
    0.01

    &&

    delta <=
    5000
  ) {

    row.urine =
      Math.round(

        (
          asNumber(
            row.urine
          )

          +

          delta
        )

        *

        10

      )

      /

      10;

  }


  saveFluidRows();


  /*
    HIGH hourly output can
    alert immediately.
  */

  evaluateHourlyUrine(

    row,

    false

  );


  /*
    LOW hourly output is checked
    for completed hours.
  */

  evaluateCompletedHours();

}


/* =====================================
   HOURLY THRESHOLD ALERTS
===================================== */

function evaluateHourlyUrine(
  row,
  hourCompleted =
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
    state.hourlyLimits.minMl;


  const max =
    state.hourlyLimits.maxMl;


  const label =
    hourLabel(
      row.key
    );


  /*
    HIGH OUTPUT:
    Alert immediately.
  */

  if (
    urine >
    max
  ) {

    const message =
      `${label}: ` +
      `${urine.toFixed(1)} mL ` +
      `has been recorded this hour. ` +
      `Upper hourly threshold is ` +
      `${max} mL/hour.`;


    const added =
      addNotification(

        `hour-high-${row.key}-${max}`,

        'High hourly urine output',

        message,

        'hourly'

      );


    if (
      added
    ) {

      showMainAlert(

        'High hourly urine output',

        message

      );

    }

  }


  /*
    LOW OUTPUT:
    Normally evaluate after
    the hour has finished.
  */

  if (
    hourCompleted

    &&

    urine <
    min
  ) {

    const message =
      `${label}: ` +
      `${urine.toFixed(1)} mL ` +
      `was recorded. ` +
      `Lower hourly threshold is ` +
      `${min} mL/hour.`;


    const added =
      addNotification(

        `hour-low-${row.key}-${min}`,

        'Low hourly urine output',

        message,

        'hourly'

      );


    if (
      added
    ) {

      showMainAlert(

        'Low hourly urine output',

        message

      );

    }

  }

}


function evaluateCompletedHours() {

  const current =
    hourKey();


  state.fluidRows
    .forEach(
      row => {

        if (
          row.key !==
            current

          &&

          row.sensorSeen
        ) {

          evaluateHourlyUrine(

            row,

            true

          );

        }

      }
    );

}


function getCurrentHourRow() {

  return (

    state.fluidRows
      .find(
        row =>
          row.key ===
          hourKey()
      )

    ||

    getOrCreateCurrentRow()

  );

}


function getCurrentHourlyStatus() {

  const row =
    getCurrentHourRow();


  const urine =
    asNumber(
      row.urine
    );


  const min =
    state.hourlyLimits.minMl;


  const max =
    state.hourlyLimits.maxMl;


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


  /*
    Current-hour value can be
    below the lower threshold
    without yet being an alert,
    because the hour is still active.
  */

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
      'Within hourly range',

    level:
      'success'

  };

}


function saveHourlyThresholds(
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
    )

    ||

    !Number.isFinite(
      max
    )

    ||

    min <
    0

    ||

    max <=
    min
  ) {

    toast(
      'Check the hourly threshold values'
    );


    return false;

  }


  state.hourlyLimits.minMl =
    min;


  state.hourlyLimits.maxMl =
    max;


  localStorage.setItem(

    STORAGE_HOURLY_MIN,

    String(
      min
    )

  );


  localStorage.setItem(

    STORAGE_HOURLY_MAX,

    String(
      max
    )

  );


  toast(

    `Hourly range saved: ` +
    `${min}–${max} mL/hour`

  );


  evaluateHourlyUrine(

    getCurrentHourRow(),

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


  const hourlyRow =
    getCurrentHourRow();


  const hourly =
    getCurrentHourlyStatus();


  /*
    Sensor fields
  */

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


  /*
    Bag capacity display
  */

  $('bag-volume-value')
    .textContent =
      bagVolume.toFixed(
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


  /*
    Hourly urine display
  */

  $('hourly-urine-value')
    .textContent =
      asNumber(
        hourlyRow.urine
      )
      .toFixed(
        1
      );


  $('hourly-range-display')
    .textContent =
      `${state.hourlyLimits.minMl}` +
      `–` +
      `${state.hourlyLimits.maxMl}`;


  $('hourly-status')
    .textContent =
      hourly.label;


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
      state.hourlyLimits.minMl;


  $('hourly-max-input')
    .value =
      state.hourlyLimits.maxMl;


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
    'hourly'
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
          Bag-capacity and hourly
          urine-output alerts will
          appear here.
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

    (a, b) =>

      new Date(
        a.key
      )

      -

      new Date(
        b.key
      )

  )

  .map(
    row => {

      runningInput +=

        asNumber(
          row.oral
        )

        +

        asNumber(
          row.ivFluids
        )

        +

        asNumber(
          row.ivMeds
        );


      runningOutput +=

        asNumber(
          row.urine
        )

        +

        asNumber(
          row.drain
        )

        +

        asNumber(
          row.vomit
        );


      return {

        ...row,

        runningInput:
          Math.round(
            runningInput *
            10
          )
          /
          10,

        runningOutput:
          Math.round(
            runningOutput *
            10
          )
          /
          10,

        balance:
          Math.round(
            (
              runningInput
              -
              runningOutput
            )
            *
            10
          )
          /
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
      )
      *
      10
    )
    /
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
      )
      *
      10
    )
    /
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

              ${hourLabel(row.key)}

            </td>


            <td>

              ${
                inputCell(
                  row,
                  'oral'
                )
              }

            </td>


            <td>

              ${
                inputCell(
                  row,
                  'ivFluids'
                )
              }

            </td>


            <td>

              ${
                inputCell(
                  row,
                  'ivMeds'
                )
              }

            </td>


            <td class="calc-cell">

              ${
                formatNumber(
                  row.runningInput
                )
              }

            </td>


            <td class="auto-urine">

              ${
                formatNumber(
                  row.urine
                )
              }

            </td>


            <td>

              ${
                inputCell(
                  row,
                  'drain'
                )
              }

            </td>


            <td>

              ${
                inputCell(
                  row,
                  'vomit'
                )
              }

            </td>


            <td class="calc-cell">

              ${
                formatNumber(
                  row.runningOutput
                )
              }

            </td>


            <td
              class="
                calc-cell
                ${
                  row.balance < 0

                    ? 'balance-negative'

                    : 'balance-positive'
                }
              "
            >

              ${
                formatBalance(
                  row.balance
                )
              }

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
    getCurrentHourRow();


  const hourly =
    getCurrentHourlyStatus();


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
      state.liveSource;


  $('chart-hourly-status')
    .textContent =
      hourly.label;


  $('chart-hourly-status')
    .classList
    .toggle(

      'success',

      hourly.level ===
      'success'

    );


  $('chart-hourly-status')
    .classList
    .toggle(

      'warning',

      hourly.level ===
      'warning'

    );


  $('chart-hourly-status')
    .classList
    .toggle(

      'danger',

      hourly.level ===
      'danger'

    );

}


function addCurrentHourRow() {

  getOrCreateCurrentRow();

  renderFluidChart();


  toast(
    'Current hour added'
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

      'Time',

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

      header.join(
        ','
      )

    ];


  rows.forEach(
    row => {

      lines.push(

        [

          hourLabel(
            row.key
          ),

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
   RESET FLUID SESSION
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
    payload.type

    &&

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
        window.location.origin

      ||

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

    () =>
      showView(
        'notifications'
      )

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

        () =>
          showView(
            button.dataset.go
          )

      );

    }
  );


/* SAVE HOURLY THRESHOLDS */

$('hourly-threshold-form')
  .addEventListener(

    'submit',

    event => {

      event.preventDefault();


      if (
        saveHourlyThresholds(

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
  DEMONSTRATION BUTTON:

  Allows the low-output alert
  to be shown without waiting
  until the current hour ends.
*/

$('evaluate-hour-now')
  .addEventListener(

    'click',

    () => {

      const row =
        getCurrentHourRow();


      row.sensorSeen =
        true;


      saveFluidRows();


      const notificationsBefore =
        state.notifications.length;


      evaluateHourlyUrine(

        row,

        true

      );


      /*
        If neither high nor low,
        show that the value is
        within the configured range.
      */

      if (
        state.notifications.length ===
        notificationsBefore
      ) {

        const urine =
          asNumber(
            row.urine
          );


        const min =
          state.hourlyLimits.minMl;


        const max =
          state.hourlyLimits.maxMl;


        if (
          urine >= min

          &&

          urine <= max
        ) {

          showMainAlert(

            'Hourly urine within configured range',

            `${urine.toFixed(1)} mL ` +
            `is within the configured ` +
            `${min}–${max} mL/hour range.`

          );

        }

      }


      updateDashboard();

      renderFluidChart();


      toast(
        'Current hour evaluated'
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
  Re-check completed hours
  even if no additional urine
  reading has arrived.
*/

setInterval(

  evaluateCompletedHours,

  60000

);


/* =====================================
   START APPLICATION
===================================== */

getOrCreateCurrentRow();

updateBagIdentityUi();

syncSettings();

updateDashboard();

renderFluidChart();
