/* =====================================
   SMART URINE MONITORING PROTOTYPE

   Demo configuration:
   Bag capacity: 200 mL
   Monitoring window: 3 minutes
   Low threshold: < 50 mL
   High threshold: > 150 mL
===================================== */


const MONITORING_WINDOW_MINUTES = 3;

const DEFAULT_WINDOW_MIN_ML = 50;
const DEFAULT_WINDOW_MAX_ML = 150;

const STORAGE_PATIENT_RECORDS =
  'smartUrinePatientRecordsV2';

const STORAGE_WINDOW_MIN =
  'smartUrine3MinMinMl';

const STORAGE_WINDOW_MAX =
  'smartUrine3MinMaxMl';


const NURSE_WARD =
  'Ward 5A';


const DEMO_PATIENTS = [

  {
    id: 'P-0001',
    name: 'Aisha Rahman',
    ward: 'Ward 5A',
    bed: '12'
  },

  {
    id: 'P-0002',
    name: 'John Miller',
    ward: 'Ward 5A',
    bed: '14'
  }

];


const titles = {

  patients:
    'Ward 5A patients',

  scan:
    'Scan urinary bag',

  patient:
    'Patient details',

  dashboard:
    'Live urine monitoring',

  chart:
    'Fluid balance chart',

  notifications:
    'Ward alerts',

  settings:
    'Settings'

};


const $ =
  id =>
    document.getElementById(
      id
    );


/* =====================================
   PATIENT RECORD CREATION
===================================== */

function createEmptyPatientRecord(
  patient
) {

  return {

    patientId:
      patient.id,

    patientName:
      patient.name,

    ward:
      patient.ward,

    bed:
      patient.bed,

    loggingDate:
      null,

    lastUpdated:
      null,

    monitoringActive:
      false,

    bag: {

      id:
        null,

      capacityMl:
        0,

      deviceId:
        null,

      attachedAt:
        null,

      startSensorTotal:
        0,

      bagVolumeMl:
        0,

      sessionId:
        null

    },

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

    fluidRows:
      [],

    notifications:
      [],

    lastSensorTotal:
      null

  };

}


function normalisePatientRecord(
  patient,
  stored
) {

  const blank =
    createEmptyPatientRecord(
      patient
    );


  if (
    !stored ||
    typeof stored !==
      'object'
  ) {

    return blank;

  }


  return {

    ...blank,

    ...stored,

    patientId:
      patient.id,

    patientName:
      patient.name,

    ward:
      patient.ward,

    bed:
      patient.bed,

    /*
      Monitoring must be explicitly
      activated again by selecting the
      patient and attaching the bag.
    */

    monitoringActive:
      false,

    bag: {

      ...blank.bag,

      ...(
        stored.bag ||
        {}
      )

    },

    reading: {

      ...blank.reading,

      ...(
        stored.reading ||
        {}
      )

    },

    fluidRows:

      Array.isArray(
        stored.fluidRows
      )

        ?

        stored.fluidRows

        :

        [],

    notifications:

      Array.isArray(
        stored.notifications
      )

        ?

        stored.notifications

        :

        []

  };

}


function loadPatientRecords() {

  let stored =
    {};


  try {

    stored =
      JSON.parse(

        localStorage.getItem(
          STORAGE_PATIENT_RECORDS
        )

        ||

        '{}'

      );

  } catch (
    error
  ) {

    stored =
      {};

  }


  const records =
    {};


  DEMO_PATIENTS
    .forEach(
      patient => {

        records[
          patient.id
        ] =
          normalisePatientRecord(

            patient,

            stored[
              patient.id
            ]

          );

      }
    );


  return records;

}


function savePatientRecords() {

  localStorage.setItem(

    STORAGE_PATIENT_RECORDS,

    JSON.stringify(
      state.patientRecords
    )

  );

}


/* =====================================
   APPLICATION STATE
===================================== */

const state = {

  loggedIn:
    false,

  currentView:
    'patients',

  selectedPatientId:
    null,

  patientRecords:
    loadPatientRecords(),

  liveReading: {

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

  liveSource:
    'Waiting for live feed',

  urineLimits: {

    minMl:

      Number(
        localStorage.getItem(
          STORAGE_WINDOW_MIN
        )
      )

      ||

      DEFAULT_WINDOW_MIN_ML,

    maxMl:

      Number(
        localStorage.getItem(
          STORAGE_WINDOW_MAX
        )
      )

      ||

      DEFAULT_WINDOW_MAX_ML

  },

  serial: {

    port:
      null,

    reader:
      null,

    connected:
      false

  }

};


/* =====================================
   GENERAL HELPERS
===================================== */

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
  .replace(

    /[&<>'"]/g,

    character => ({

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

    }[character])

  );

}


function toast(
  message
) {

  const element =
    $('toast');


  element.textContent =
    message;


  element.classList.add(
    'show'
  );


  clearTimeout(
    toast.timer
  );


  toast.timer =
    setTimeout(

      () =>
        element
          .classList
          .remove(
            'show'
          ),

      2200

    );

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

    ?

    number

    :

    0;

}


function getPatientById(
  patientId
) {

  return DEMO_PATIENTS
    .find(

      patient =>
        patient.id ===
        patientId

    )

    ||

    null;

}


function getSelectedPatient() {

  return getPatientById(
    state.selectedPatientId
  );

}


function getSelectedRecord() {

  if (
    !state.selectedPatientId
  ) {

    return null;

  }


  return state.patientRecords[
    state.selectedPatientId
  ]

  ||

  null;

}


function patientContextText(
  patient
) {

  if (
    !patient
  ) {

    return '';

  }


  return (

    `${patient.name} · ` +
    `${patient.id} · ` +
    `Bed ${patient.bed}`

  );

}


function patientInitials(
  name
) {

  return String(
    name ||
    ''
  )
  .split(
    /\s+/
  )
  .filter(
    Boolean
  )
  .map(
    word =>
      word[0]
  )
  .join('')
  .slice(
    0,
    2
  )
  .toUpperCase();

}


/* =====================================
   AUDIO
===================================== */

let audioContext =
  null;

let audioEnabled =
  false;


async function enableAlertSounds() {

  const AudioContextClass =
    window.AudioContext
    ||
    window.webkitAudioContext;


  if (
    !AudioContextClass
  ) {

    return false;

  }


  if (
    !audioContext
  ) {

    audioContext =
      new AudioContextClass();

  }


  try {

    if (
      audioContext.state ===
      'suspended'
    ) {

      await audioContext.resume();

    }


    const oscillator =
      audioContext
        .createOscillator();


    const gain =
      audioContext
        .createGain();


    gain.gain.value =
      0.00001;


    oscillator.connect(
      gain
    );


    gain.connect(
      audioContext.destination
    );


    oscillator.start();


    oscillator.stop(

      audioContext.currentTime
      +
      0.03

    );


    audioEnabled =
      true;


    return true;

  } catch (
    error
  ) {

    console.error(
      error
    );


    return false;

  }

}


function playTone(
  frequency,
  delay,
  duration,
  volume,
  type
) {

  if (
    !audioContext ||
    audioContext.state !==
      'running'
  ) {

    return;

  }


  const oscillator =
    audioContext
      .createOscillator();


  const gain =
    audioContext
      .createGain();


  const start =
    audioContext.currentTime
    +
    delay;


  const end =
    start
    +
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
      0.001,
      start
    );


  gain.gain
    .linearRampToValueAtTime(
      volume,
      start + 0.03
    );


  gain.gain
    .linearRampToValueAtTime(
      0.001,
      end
    );


  oscillator.connect(
    gain
  );


  gain.connect(
    audioContext.destination
  );


  oscillator.start(
    start
  );


  oscillator.stop(
    end + 0.05
  );

}


/*
  BAG ALERT SOUND:
  rising chime
*/

async function playBagAlertSound() {

  if (
    !audioEnabled
  ) {

    return;

  }


  if (
    audioContext.state ===
    'suspended'
  ) {

    await audioContext.resume();

  }


  playTone(
    440,
    0.00,
    0.25,
    0.30,
    'sine'
  );


  playTone(
    660,
    0.30,
    0.25,
    0.30,
    'sine'
  );


  playTone(
    880,
    0.60,
    0.40,
    0.32,
    'sine'
  );

}


/*
  URINE PRODUCTION ALERT:
  urgent alternating alarm
*/

async function playUrineAlertSound() {

  if (
    !audioEnabled
  ) {

    return;

  }


  if (
    audioContext.state ===
    'suspended'
  ) {

    await audioContext.resume();

  }


  playTone(
    950,
    0.00,
    0.20,
    0.35,
    'square'
  );


  playTone(
    620,
    0.25,
    0.20,
    0.35,
    'square'
  );


  playTone(
    950,
    0.50,
    0.20,
    0.35,
    'square'
  );


  playTone(
    620,
    0.75,
    0.30,
    0.35,
    'square'
  );

}


/* =====================================
   LOGIN
===================================== */

async function login() {

  await enableAlertSounds();


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
    'patients'
  );

}


/* =====================================
   NAVIGATION
===================================== */

function showView(
  requestedView
) {

  let name =
    requestedView;


  const patientRequiredViews =
    new Set(
      [
        'scan',
        'patient',
        'dashboard',
        'chart'
      ]
    );


  if (
    patientRequiredViews.has(
      name
    )

    &&

    !state.selectedPatientId
  ) {

    toast(
      'Select a patient first'
    );


    name =
      'patients';

  }


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
      titles[
        name
      ]

      ||

      'Smart Urine Monitoring';


  if (
    name ===
    'patients'
  ) {

    renderPatientSelection();

  }


  if (
    name ===
    'scan'
  ) {

    updateSelectedPatientUi();

  }


  if (
    name ===
    'patient'
  ) {

    updatePatientDetails();

  }


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
   PATIENT SELECTION
===================================== */

function totalUrineForPatient(
  record
) {

  return record.fluidRows
    .reduce(

      (
        total,
        row
      ) =>

        total +
        asNumber(
          row.urine
        ),

      0

    );

}


function renderPatientSelection() {

  const container =
    $('patient-selection-list');


  if (
    !container
  ) {

    return;

  }


  container.innerHTML =
    DEMO_PATIENTS
      .map(
        patient => {

          const record =
            state.patientRecords[
              patient.id
            ];


          const loggingDate =
            record.loggingDate

              ?

              new Date(
                record.loggingDate
              )
              .toLocaleString()

              :

              'Not started';


          const bagText =
            record.bag.id

              ?

              `${record.bag.id} · ` +
              `${record.bag.capacityMl} mL`

              :

              'No bag attached';


          const alertCount =
            record.notifications.length;


          const urineTotal =
            totalUrineForPatient(
              record
            )
            .toFixed(
              1
            );


          return `

            <div class="card patient-select-card">

              <div class="patient-card-top">

                <div class="avatar">

                  ${
                    escapeHtml(
                      patientInitials(
                        patient.name
                      )
                    )
                  }

                </div>


                <div>

                  <strong class="patient-name">

                    ${
                      escapeHtml(
                        patient.name
                      )
                    }

                  </strong>


                  <p>

                    ${
                      escapeHtml(
                        patient.id
                      )
                    }

                    · Bed

                    ${
                      escapeHtml(
                        patient.bed
                      )
                    }

                  </p>

                </div>

              </div>


              <div class="patient-mini-details">

                <div>

                  <span>
                    Logging started
                  </span>

                  <strong>
                    ${
                      escapeHtml(
                        loggingDate
                      )
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Urinary bag
                  </span>

                  <strong>
                    ${
                      escapeHtml(
                        bagText
                      )
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Recorded urine
                  </span>

                  <strong>
                    ${urineTotal} mL
                  </strong>

                </div>


                <div>

                  <span>
                    Alerts logged
                  </span>

                  <strong>
                    ${alertCount}
                  </strong>

                </div>

              </div>


              <button
                class="btn primary select-patient-button"
                data-patient-id="${escapeHtml(patient.id)}"
              >

                Select ${escapeHtml(patient.name)}

              </button>

            </div>

          `;

        }
      )
      .join('');


  container
    .querySelectorAll(
      '.select-patient-button'
    )
    .forEach(
      button => {

        button.addEventListener(

          'click',

          () => {

            selectPatient(
              button.dataset.patientId
            );

          }

        );

      }
    );

}


function selectPatient(
  patientId
) {

  /*
    Stop monitoring whichever
    patient was previously active.
  */

  Object
    .values(
      state.patientRecords
    )
    .forEach(
      record => {

        record.monitoringActive =
          false;

      }
    );


  const patient =
    getPatientById(
      patientId
    );


  if (
    !patient
  ) {

    return;

  }


  state.selectedPatientId =
    patientId;


  savePatientRecords();


  updateSelectedPatientUi();


  toast(
    `${patient.name} selected`
  );


  showView(
    'scan'
  );

}


function updateSelectedPatientUi() {

  const patient =
    getSelectedPatient();


  if (
    !patient
  ) {

    return;

  }


  $('scan-patient-name')
    .textContent =
      patient.name;


  $('scan-patient-details')
    .textContent =

      `${patient.id} · ` +
      `Ward ${patient.ward.replace('Ward ', '')} · ` +
      `Bed ${patient.bed}`;


  const demoQr =
    getDemoBagQr();


  $('demo-qr-code-text')
    .textContent =
      demoQr ||
      'Select a patient first';

}


/* =====================================
   BAG QR
===================================== */

function getDemoBagQr() {

  const patient =
    getSelectedPatient();


  if (
    !patient
  ) {

    return null;

  }


  return (

    `BAG=UB-${patient.id}-001|` +

    `PATIENT=${patient.id}|` +

    `DEVICE=NC-72X|` +

    `CAPACITY_ML=200`

  );

}


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


      fields[
        key
      ] =
        value;

    }
  );


  const capacity =
    Number(
      fields.CAPACITY_ML
    );


  if (
    !fields.BAG

    ||

    !Number.isFinite(
      capacity
    )

    ||

    capacity <=
    0
  ) {

    throw new Error(
      'Invalid urinary bag QR code.'
    );

  }


  return {

    bag:
      fields.BAG,

    patient:
      fields.PATIENT ||
      null,

    device:
      fields.DEVICE ||
      'Unknown device',

    capacityMl:
      capacity

  };

}


function completeDemoScan() {

  const qr =
    getDemoBagQr();


  if (
    !qr
  ) {

    toast(
      'Select a patient first'
    );


    showView(
      'patients'
    );


    return;

  }


  applyScannedBag(
    qr,
    'Demo QR'
  );

}


function applyScannedBag(
  rawValue,
  sourceLabel =
    'QR scan'
) {

  const patient =
    getSelectedPatient();


  const record =
    getSelectedRecord();


  if (
    !patient ||
    !record
  ) {

    toast(
      'Select a patient before scanning a bag'
    );


    showView(
      'patients'
    );


    return false;

  }


  try {

    const bag =
      parseBagQr(
        rawValue
      );


    /*
      Safety check:
      scanned patient must match
      selected patient.
    */

    if (
      bag.patient

      &&

      bag.patient !==
        patient.id
    ) {

      const message =

        `The scanned bag belongs to ` +
        `${bag.patient}, but the selected ` +
        `patient is ${patient.name} (${patient.id}).`;


      $('scan-message')
        .textContent =
          message;


      addNotificationForPatient(

        patient.id,

        `mismatch-${Date.now()}`,

        'Patient / bag mismatch',

        message,

        'safety'

      );


      toast(
        'Patient / bag mismatch'
      );


      return false;

    }


    const now =
      new Date()
        .toISOString();


    record.loggingDate =
      now;


    record.lastUpdated =
      now;


    record.monitoringActive =
      true;


    record.bag = {

      id:
        bag.bag,

      capacityMl:
        bag.capacityMl,

      deviceId:
        bag.device,

      attachedAt:
        now,

      startSensorTotal:
        Number(
          state.liveReading.volume ||
          0
        ),

      bagVolumeMl:
        0,

      sessionId:

        `${patient.id}-` +
        `${bag.bag}-` +
        `${Date.now()}`

    };


    /*
      Baseline for this patient's
      urine logging.
    */

    record.lastSensorTotal =
      Number(
        state.liveReading.volume ||
        0
      );


    record.reading =
      {
        ...state.liveReading
      };


    savePatientRecords();


    $('scan-message')
      .textContent =

        `${sourceLabel}: ` +
        `${bag.bag} linked to ` +
        `${patient.name}. ` +
        `Capacity ${bag.capacityMl} mL.`;


    toast(
      `Bag attached to ${patient.name}`
    );


    updatePatientDetails();


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


/* =====================================
   CAMERA
===================================== */

async function startCamera() {

  await enableAlertSounds();


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
        'Camera active. Looking for QR code…';


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

          'Camera is active, but automatic QR ' +
          'detection is unavailable. Use Demo QR.';

    }

  } catch (
    error
  ) {

    $('scan-message')
      .textContent =

        'Camera unavailable. Use Demo QR.';


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
   PATIENT DETAILS
===================================== */

function updatePatientDetails() {

  const patient =
    getSelectedPatient();


  const record =
    getSelectedRecord();


  if (
    !patient ||
    !record
  ) {

    return;

  }


  $('patient-avatar')
    .textContent =
      patientInitials(
        patient.name
      );


  $('patient-name')
    .textContent =
      patient.name;


  $('patient-id')
    .textContent =
      patient.id;


  $('patient-bed')
    .textContent =
      patient.bed;


  $('patient-bed-detail')
    .textContent =
      patient.bed;


  $('patient-ward')
    .textContent =
      patient.ward;


  $('patient-bag-id')
    .textContent =

      record.bag.id
      ||
      'Not attached';


  $('patient-bag-capacity')
    .textContent =

      record.bag.capacityMl
      ||
      '—';


  $('patient-device-id')
    .textContent =

      record.bag.deviceId
      ||
      'Not linked';


  $('patient-logging-date')
    .textContent =

      record.loggingDate

        ?

        new Date(
          record.loggingDate
        )
        .toLocaleString()

        :

        'Not started';


  const status =
    $('patient-monitoring-status');


  status.textContent =

    record.monitoringActive

      ?

      'Monitoring'

      :

      'Not monitoring';


  status.classList.toggle(

    'success',

    record.monitoringActive

  );

}


/* =====================================
   BAG VOLUME / CAPACITY
===================================== */

function getCurrentBagVolume(
  record
) {

  if (
    !record ||
    !record.bag.id
  ) {

    return 0;

  }


  /*
    Only the actively monitored patient
    uses the current Nesso value.
  */

  if (
    record.monitoringActive

    &&

    state.selectedPatientId ===
      record.patientId
  ) {

    const current =
      Number(
        state.liveReading.volume ||
        0
      );


    let start =
      Number(
        record.bag.startSensorTotal ||
        0
      );


    /*
      Handle Nesso counter reset.
    */

    if (
      current <
      start
    ) {

      start =
        0;


      record.bag.startSensorTotal =
        0;

    }


    record.bag.bagVolumeMl =
      Math.max(

        0,

        current -
        start

      );

  }


  return asNumber(
    record.bag.bagVolumeMl
  );

}


function getBagFillStatus(
  record
) {

  if (
    !record ||
    !record.bag.capacityMl
  ) {

    return {

      percentage:
        0,

      level:
        'unknown',

      shortLabel:
        'No bag',

      message:
        'No urinary bag is attached.'

    };

  }


  const volume =
    getCurrentBagVolume(
      record
    );


  const capacity =
    record.bag.capacityMl;


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

        `${volume.toFixed(1)} mL is above ` +
        `the ${capacity} mL bag capacity.`

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
        'Urinary bag has reached full capacity.'

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


function evaluateBagCapacity(
  record
) {

  if (
    !record ||
    !record.monitoringActive ||
    !record.bag.id
  ) {

    return;

  }


  const patient =
    getPatientById(
      record.patientId
    );


  const status =
    getBagFillStatus(
      record
    );


  const prefix =
    record.bag.sessionId;


  let newAlert =
    false;


  const milestones =
    [

      {
        level: 50,
        key: '50',
        title: 'Urinary bag half full',
        message: 'Urinary bag has reached approximately 50% capacity.'
      },

      {
        level: 75,
        key: '75',
        title: 'Urinary bag 75% full',
        message: 'Urinary bag has reached approximately 75% capacity.'
      },

      {
        level: 90,
        key: '90',
        title: 'Urinary bag nearly full',
        message: 'Urinary bag has reached at least 90% capacity.'
      },

      {
        level: 100,
        key: '100',
        title: 'Urinary bag full',
        message: 'Urinary bag has reached full capacity. Replace the bag.'
      }

    ];


  milestones
    .forEach(
      milestone => {

        if (
          status.percentage >=
          milestone.level
        ) {

          const added =
            addNotificationForPatient(

              record.patientId,

              `${prefix}-bag-${milestone.key}`,

              milestone.title,

              milestone.message,

              'bag'

            );


          if (
            added
          ) {

            newAlert =
              true;

          }

        }

      }
    );


  if (
    status.percentage >
    100
  ) {

    const added =
      addNotificationForPatient(

        record.patientId,

        `${prefix}-overflow`,

        'URGENT: Urinary bag overflow risk',

        status.message,

        'bag'

      );


    if (
      added
    ) {

      newAlert =
        true;

    }

  }


  if (
    newAlert
  ) {

    let title =
      'Urinary bag alert';


    if (
      status.level ===
      'overflow'
    ) {

      title =
        'URGENT: Urinary bag overflow risk';

    } else if (
      status.level ===
      'full'
    ) {

      title =
        'Urinary bag full';

    } else if (
      status.level ===
      'nearly-full'
    ) {

      title =
        'Urinary bag nearly full';

    } else if (
      status.level ===
      'three-quarter'
    ) {

      title =
        'Urinary bag 75% full';

    } else if (
      status.level ===
      'half'
    ) {

      title =
        'Urinary bag half full';

    }


    showMainAlertForPatient(

      patient,

      title,

      status.message

    );


    playBagAlertSound();

  }


  savePatientRecords();

}


/* =====================================
   SENSOR READING
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

      input.volume
      ??
      input.volume_ml
      ??
      input.totalVolumeMl
      ??
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

        input.pulses
        ??
        input.pulseCount
        ??
        input.pulse_count
        ??
        0

      ),

    turbidityRaw:

      Number(

        input.turbidityRaw
        ??
        input.turbidity_raw
        ??
        input.raw
        ??
        0

      ),

    vout:

      Number(

        input.vout
        ??
        input.Vout
        ??
        0

      ),

    vin:

      Number(

        input.vin
        ??
        input.Vin
        ??
        input.turbidity_v
        ??
        0

      ),

    clarity:

      String(

        input.clarity
        ??
        input.status
        ??
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


  /*
    Global physical Nesso reading.
  */

  state.liveReading =
    reading;


  state.liveSource =
    source;


  $('settings-source')
    .textContent =
      source;


  if (
    $('feed-time')
  ) {

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

  }


  const record =
    getSelectedRecord();


  /*
    Only attribute sensor data to the
    selected patient after a bag has
    actually been attached.
  */

  if (
    record &&
    record.monitoringActive &&
    record.bag.id
  ) {

    record.reading =
      {
        ...reading
      };


    record.lastUpdated =
      new Date()
        .toISOString();


    processWindowSensorVolume(

      record,

      reading.volume

    );


    evaluateBagCapacity(
      record
    );


    savePatientRecords();

  }


  if (
    state.currentView ===
    'dashboard'
  ) {

    updateDashboard();

  }


  if (
    state.currentView ===
    'chart'
  ) {

    renderFluidChart();

  }


  return true;

}


/* =====================================
   3-MINUTE TIME WINDOWS
===================================== */

function windowKey(
  date =
    new Date()
) {

  const current =
    new Date(
      date
    );


  const startMinute =

    Math.floor(

      current.getMinutes()
      /
      MONITORING_WINDOW_MINUTES

    )

    *

    MONITORING_WINDOW_MINUTES;


  current.setMinutes(
    startMinute,
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

      start.getTime()

      +

      (
        MONITORING_WINDOW_MINUTES
        -
        1
      )

      *

      60000

    );


  const display =
    date =>

      `${String(
        date.getHours()
      ).padStart(2, '0')}:` +

      `${String(
        date.getMinutes()
      ).padStart(2, '0')}`;


  return (

    `${display(start)}` +
    `–` +
    `${display(end)}`

  );

}


function makeFluidRow(
  key
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


function getOrCreateCurrentRow(
  record
) {

  const key =
    windowKey();


  let row =
    record.fluidRows
      .find(

        item =>
          item.key ===
          key

      );


  if (
    !row
  ) {

    row =
      makeFluidRow(
        key
      );


    record.fluidRows
      .push(
        row
      );


    record.fluidRows
      .sort(

        (
          a,
          b
        ) =>

          new Date(
            a.key
          )

          -

          new Date(
            b.key
          )

      );


    savePatientRecords();

  }


  return row;

}


/* =====================================
   AUTOMATIC URINE LOGGING
===================================== */

function processWindowSensorVolume(
  record,
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

    current <
    0
  ) {

    return;

  }


  const row =
    getOrCreateCurrentRow(
      record
    );


  row.sensorSeen =
    true;


  if (
    record.lastSensorTotal ===
    null

    ||

    !Number.isFinite(
      Number(
        record.lastSensorTotal
      )
    )
  ) {

    record.lastSensorTotal =
      current;


    savePatientRecords();


    return;

  }


  const previous =
    Number(
      record.lastSensorTotal
    );


  let delta;


  /*
    Nesso counter reset.
  */

  if (
    current +
    0.5 <
    previous
  ) {

    delta =
      current;


    addNotificationForPatient(

      record.patientId,

      `sensor-reset-${Date.now()}`,

      'Nesso counter reset',

      'A lower cumulative sensor reading was received. Monitoring continued from the new counter.',

      'safety'

    );

  } else {

    delta =
      current -
      previous;

  }


  record.lastSensorTotal =
    current;


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


  savePatientRecords();


  /*
    High output can alert immediately.
  */

  evaluateUrineWindow(

    record,

    row,

    false

  );


  /*
    Low output is checked for
    completed windows.
  */

  evaluateCompletedWindowsForRecord(
    record
  );

}


/* =====================================
   URINE PRODUCTION ALERTS
===================================== */

function evaluateUrineWindow(
  record,
  row,
  windowCompleted =
    false
) {

  if (
    !record ||
    !row ||
    !row.sensorSeen
  ) {

    return;

  }


  const patient =
    getPatientById(
      record.patientId
    );


  const urine =
    asNumber(
      row.urine
    );


  const minimum =
    state.urineLimits.minMl;


  const maximum =
    state.urineLimits.maxMl;


  const time =
    windowLabel(
      row.key
    );


  /*
    HIGH URINE OUTPUT
  */

  if (
    urine >
    maximum
  ) {

    const message =

      `${urine.toFixed(1)} mL was recorded ` +
      `during ${time}. ` +
      `The configured upper limit is ` +
      `${maximum} mL / 3 min.`;


    const added =
      addNotificationForPatient(

        record.patientId,

        `high-${row.key}-${maximum}`,

        'High urine output',

        message,

        'urine'

      );


    if (
      added
    ) {

      showMainAlertForPatient(

        patient,

        'High urine output',

        message

      );


      playUrineAlertSound();

    }

  }


  /*
    LOW URINE OUTPUT

    Only after the 3-minute
    window finishes.
  */

  if (
    windowCompleted

    &&

    urine <
    minimum
  ) {

    const message =

      `${urine.toFixed(1)} mL was recorded ` +
      `during ${time}. ` +
      `The configured lower limit is ` +
      `${minimum} mL / 3 min.`;


    const added =
      addNotificationForPatient(

        record.patientId,

        `low-${row.key}-${minimum}`,

        'Low urine output',

        message,

        'urine'

      );


    if (
      added
    ) {

      showMainAlertForPatient(

        patient,

        'Low urine output',

        message

      );


      playUrineAlertSound();

    }

  }

}


function evaluateCompletedWindowsForRecord(
  record
) {

  const currentKey =
    windowKey();


  record.fluidRows
    .forEach(
      row => {

        if (
          row.key !==
          currentKey

          &&

          row.sensorSeen
        ) {

          evaluateUrineWindow(

            record,

            row,

            true

          );

        }

      }
    );

}


function evaluateAllPatientCompletedWindows() {

  Object
    .values(
      state.patientRecords
    )
    .forEach(
      record => {

        evaluateCompletedWindowsForRecord(
          record
        );

      }
    );

}


/* =====================================
   CURRENT WINDOW STATUS
===================================== */

function getCurrentWindowStatus(
  record
) {

  if (
    !record
  ) {

    return {

      value:
        0,

      label:
        'No patient selected',

      level:
        'unknown'

    };

  }


  const row =
    getOrCreateCurrentRow(
      record
    );


  const urine =
    asNumber(
      row.urine
    );


  if (
    !row.sensorSeen
  ) {

    return {

      value:
        urine,

      label:
        'Waiting for sensor',

      level:
        'unknown'

    };

  }


  if (
    urine >
    state.urineLimits.maxMl
  ) {

    return {

      value:
        urine,

      label:
        'Above upper threshold',

      level:
        'danger'

    };

  }


  if (
    urine <
    state.urineLimits.minMl
  ) {

    return {

      value:
        urine,

      label:
        'Below lower threshold so far',

      level:
        'warning'

    };

  }


  return {

    value:
      urine,

    label:
      'Within configured range',

    level:
      'success'

  };

}


/* =====================================
   ALERT STORAGE
===================================== */

function addNotificationForPatient(
  patientId,
  key,
  title,
  message,
  type
) {

  const patient =
    getPatientById(
      patientId
    );


  const record =
    state.patientRecords[
      patientId
    ];


  if (
    !patient ||
    !record
  ) {

    return false;

  }


  const exists =
    record.notifications
      .some(

        notification =>
          notification.key ===
          key

      );


  if (
    exists
  ) {

    return false;

  }


  record.notifications
    .unshift({

      key,

      patientId:
        patient.id,

      patientName:
        patient.name,

      ward:
        patient.ward,

      bed:
        patient.bed,

      title,

      message,

      type,

      time:
        new Date()
          .toISOString()

    });


  savePatientRecords();


  updateNotificationDot();


  if (
    state.currentView ===
    'notifications'
  ) {

    renderNotifications();

  }


  return true;

}


function getAllWardNotifications() {

  return Object
    .values(
      state.patientRecords
    )
    .flatMap(

      record =>
        record.notifications

    )
    .sort(

      (
        a,
        b
      ) =>

        new Date(
          b.time
        )

        -

        new Date(
          a.time
        )

    );

}


function updateNotificationDot() {

  const notifications =
    getAllWardNotifications();


  $('notification-dot')
    .classList
    .toggle(

      'hidden',

      notifications.length ===
      0

    );

}


function renderNotifications() {

  const list =
    $('notification-list');


  const notifications =
    getAllWardNotifications();


  if (
    !notifications.length
  ) {

    list.innerHTML = `

      <div class="empty-state">

        <div>
          🔔
        </div>

        <strong>
          No Ward 5A alerts
        </strong>

        <p>
          Bag-capacity and urine-output
          alerts for Aisha Rahman and
          John Miller will appear here.
        </p>

      </div>

    `;


    return;

  }


  list.innerHTML =
    notifications
      .map(
        notification => `

          <div
            class="
              card
              notification-card
              ${escapeHtml(notification.type)}
            "
          >

            <div class="alert-patient-label">

              <strong>

                ${escapeHtml(notification.patientName)}

              </strong>


              <span>

                ${escapeHtml(notification.patientId)}
                · Bed
                ${escapeHtml(notification.bed)}

              </span>

            </div>


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
   MAIN ALERT BANNER
===================================== */

function showMainAlertForPatient(
  patient,
  title,
  message
) {

  if (
    !patient
  ) {

    return;

  }


  $('alert-banner')
    .classList
    .remove(
      'hidden'
    );


  $('alert-patient-context')
    .textContent =
      patientContextText(
        patient
      );


  $('alert-title')
    .textContent =
      title;


  $('alert-message')
    .textContent =
      message;

}


/* =====================================
   DASHBOARD
===================================== */

function updateDashboard() {

  const patient =
    getSelectedPatient();


  const record =
    getSelectedRecord();


  if (
    !patient ||
    !record
  ) {

    return;

  }


  const bag =
    getBagFillStatus(
      record
    );


  const bagVolume =
    getCurrentBagVolume(
      record
    );


  const urineStatus =
    getCurrentWindowStatus(
      record
    );


  $('dashboard-patient-name')
    .textContent =
      patient.name;


  $('dashboard-patient-id')
    .textContent =
      patient.id;


  $('dashboard-bed')
    .textContent =
      patient.bed;


  $('dashboard-bag')
    .textContent =

      record.bag.id
      ||
      'NO BAG';


  $('connection-pill')
    .textContent =

      record.monitoringActive

        ?

        state.liveSource

        :

        'Not monitoring';


  $('connection-pill')
    .classList
    .toggle(

      'success',

      record.monitoringActive

    );


  $('sensor-total-value')
    .textContent =

      Number(
        state.liveReading.volume ||
        0
      )
      .toFixed(
        1
      );


  $('pulses-value')
    .textContent =

      Math.round(
        asNumber(
          state.liveReading.pulses
        )
      );


  $('raw-value')
    .textContent =

      Math.round(
        asNumber(
          state.liveReading.turbidityRaw
        )
      );


  $('vout-value')
    .textContent =

      asNumber(
        state.liveReading.vout
      )
      .toFixed(
        2
      );


  $('vin-value')
    .textContent =

      asNumber(
        state.liveReading.vin
      )
      .toFixed(
        2
      );


  $('clarity-value')
    .textContent =

      state.liveReading.clarity
      ||
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

      record.bag.capacityMl
      ||
      '—';


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
      urineStatus.value
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
      urineStatus.label;


  savePatientRecords();

}


/* =====================================
   FLUID BALANCE CALCULATIONS
===================================== */

function calculateFluidRows(
  record
) {

  let runningInput =
    0;


  let runningOutput =
    0;


  return [
    ...record.fluidRows
  ]
  .sort(

    (
      a,
      b
    ) =>

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
              runningInput -
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

    ?

    String(
      value
    )

    :

    value.toFixed(
      1
    );

}


function formatBalance(
  number
) {

  const value =
    asNumber(
      number
    );


  return value >
    0

    ?

    `+${formatNumber(value)}`

    :

    formatNumber(
      value
    );

}


function inputCell(
  row,
  field,
  className =
    ''
) {

  const type =

    field ===
    'initials'

      ?

      'text'

      :

      'number';


  const extra =

    type ===
    'number'

      ?

      'min="0" step="1" inputmode="decimal"'

      :

      'maxlength="4"';


  return `

    <input
      class="${className}"
      type="${type}"
      ${extra}
      value="${escapeHtml(row[field] ?? '')}"
      data-row="${escapeHtml(row.key)}"
      data-field="${field}"
    >

  `;

}


/* =====================================
   FLUID BALANCE RENDER
===================================== */

function renderFluidChart() {

  const patient =
    getSelectedPatient();


  const record =
    getSelectedRecord();


  if (
    !patient ||
    !record
  ) {

    return;

  }


  $('chart-patient-name')
    .textContent =
      patient.name;


  $('chart-patient-details')
    .textContent =

      `${patient.id} · ` +
      `Bed ${patient.bed} · ` +
      `${patient.ward}`;


  if (
    !record.fluidRows.length
  ) {

    getOrCreateCurrentRow(
      record
    );

  }


  const rows =
    calculateFluidRows(
      record
    );


  $('fluid-balance-body')
    .innerHTML =

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
                    row.balance < 0
                      ?
                      'balance-negative'
                      :
                      'balance-positive'
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


  document
    .querySelectorAll(
      '#fluid-balance-body input'
    )
    .forEach(
      input => {

        input.addEventListener(

          'change',

          handleFluidInput

        );

      }
    );


  const currentStatus =
    getCurrentWindowStatus(
      record
    );


  $('chart-hourly-volume')
    .textContent =
      currentStatus.value
        .toFixed(
          1
        );


  $('chart-source')
    .textContent =

      `${state.liveSource} · ` +
      `3-minute window`;


  $('chart-hourly-status')
    .textContent =
      currentStatus.label;


  $('chart-hourly-status')
    .classList
    .toggle(

      'success',

      currentStatus.level ===
      'success'

    );


  $('chart-hourly-status')
    .classList
    .toggle(

      'warning',

      currentStatus.level ===
      'warning'

    );


  $('chart-hourly-status')
    .classList
    .toggle(

      'danger',

      currentStatus.level ===
      'danger'

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

  }

}


function handleFluidInput(
  event
) {

  const record =
    getSelectedRecord();


  if (
    !record
  ) {

    return;

  }


  const input =
    event.target;


  const row =
    record.fluidRows
      .find(

        item =>
          item.key ===
          input.dataset.row

      );


  if (
    !row
  ) {

    return;

  }


  const field =
    input.dataset.field;


  row[
    field
  ] =

    field ===
    'initials'

      ?

      input.value
        .toUpperCase()
        .trim()

      :

      input.value;


  savePatientRecords();


  renderFluidChart();

}


/* =====================================
   THRESHOLDS
===================================== */

function saveWindowThresholds(
  minimumValue,
  maximumValue
) {

  const minimum =
    Number(
      minimumValue
    );


  const maximum =
    Number(
      maximumValue
    );


  if (
    !Number.isFinite(
      minimum
    )

    ||

    !Number.isFinite(
      maximum
    )

    ||

    minimum <
    0

    ||

    maximum <=
    minimum
  ) {

    toast(
      'Check threshold values'
    );


    return false;

  }


  state.urineLimits.minMl =
    minimum;


  state.urineLimits.maxMl =
    maximum;


  localStorage.setItem(

    STORAGE_WINDOW_MIN,

    String(
      minimum
    )

  );


  localStorage.setItem(

    STORAGE_WINDOW_MAX,

    String(
      maximum
    )

  );


  toast(

    `3-minute range saved: ` +
    `${minimum}–${maximum} mL`

  );


  return true;

}


function syncSettings() {

  $('hourly-min-input')
    .value =
      state.urineLimits.minMl;


  $('hourly-max-input')
    .value =
      state.urineLimits.maxMl;


  $('settings-source')
    .textContent =
      state.liveSource;


  const patient =
    getSelectedPatient();


  const record =
    getSelectedRecord();


  if (
    !patient ||
    !record
  ) {

    $('settings-patient-name')
      .textContent =
        'None selected';


    $('settings-patient-id')
      .textContent =
        '—';


    $('settings-bag-id')
      .textContent =
        '—';


    $('settings-bag-capacity')
      .textContent =
        '—';


    return;

  }


  $('settings-patient-name')
    .textContent =
      patient.name;


  $('settings-patient-id')
    .textContent =
      patient.id;


  $('settings-bag-id')
    .textContent =

      record.bag.id
      ||
      'Not attached';


  $('settings-bag-capacity')
    .textContent =

      record.bag.capacityMl
      ||
      '—';

}


/* =====================================
   DEMO READING
===================================== */

function simulateReading() {

  const next =
    Number(
      state.liveReading.volume ||
      0
    )
    +
    25;


  acceptLiveReading(

    {

      volume:
        next,

      pulses:

        Number(
          state.liveReading.pulses ||
          0
        )
        +
        112,

      turbidityRaw:

        1720

        +

        Math.floor(
          Math.random() *
          40
        ),

      vout:

        1.36

        +

        Math.random() *
        0.06,

      vin:

        2.04

        +

        Math.random() *
        0.09,

      clarity:
        'CLOUDY'

    },

    'Demo feed'

  );

}


/* =====================================
   SERIAL PARSING
===================================== */

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
    parts.length <
    7
  ) {

    return false;

  }


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
    numbers.some(
      Number.isNaN
    )
  ) {

    return false;

  }


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


/* =====================================
   DIRECT WEB SERIAL
===================================== */

async function connectSerial() {

  await enableAlertSounds();


  if (
    !(
      'serial'
      in navigator
    )
  ) {

    $('serial-status')
      .textContent =

        'Web Serial is unavailable. ' +
        'Use the separate Nesso Sensor Logger.';


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
   CSV EXPORT
===================================== */

function exportFluidCsv() {

  const patient =
    getSelectedPatient();


  const record =
    getSelectedRecord();


  if (
    !patient ||
    !record
  ) {

    return;

  }


  const rows =
    calculateFluidRows(
      record
    );


  const header =
    [

      'Patient_ID',
      'Patient_Name',
      'Ward',
      'Bed',
      'Logging_Date',
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

          patient.id,

          `"${patient.name}"`,

          `"${patient.ward}"`,

          patient.bed,

          `"${record.loggingDate || ''}"`,

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

    `fluid-balance-${patient.id}-` +

    `${new Date().toISOString().slice(0, 10)}.csv`;


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
    `${patient.name} CSV exported`
  );

}


/* =====================================
   RESET PATIENT SESSION
===================================== */

function resetFluidSession() {

  const patient =
    getSelectedPatient();


  const record =
    getSelectedRecord();


  if (
    !patient ||
    !record
  ) {

    return;

  }


  const confirmed =
    confirm(

      `Start a new fluid-balance ` +
      `session for ${patient.name}?`

    );


  if (
    !confirmed
  ) {

    return;

  }


  record.fluidRows =
    [];


  record.lastSensorTotal =
    Number(
      state.liveReading.volume ||
      0
    );


  record.loggingDate =
    new Date()
      .toISOString();


  savePatientRecords();


  renderFluidChart();


  toast(
    `New session started for ${patient.name}`
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


  acceptLiveReading(

    payload.reading
    ||
    payload,

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

    async event => {

      event.preventDefault();

      await login();

    }

  );


$('demo-login')
  .addEventListener(

    'click',

    async () => {

      await login();

    }

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

    async () => {

      await enableAlertSounds();


      const record =
        getSelectedRecord();


      if (
        !record ||
        !record.monitoringActive
      ) {

        toast(
          'Select a patient and attach a bag first'
        );


        return;

      }


      simulateReading();

    }

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


$('hourly-threshold-form')
  .addEventListener(

    'submit',

    event => {

      event.preventDefault();


      saveWindowThresholds(

        $('hourly-min-input')
          .value,

        $('hourly-max-input')
          .value

      );

    }

  );


/*
  Demonstrate low / normal / high
  without waiting three minutes.
*/

$('evaluate-hour-now')
  .addEventListener(

    'click',

    async () => {

      await enableAlertSounds();


      const patient =
        getSelectedPatient();


      const record =
        getSelectedRecord();


      if (
        !patient ||
        !record
      ) {

        toast(
          'Select a patient first'
        );


        return;

      }


      const row =
        getOrCreateCurrentRow(
          record
        );


      row.sensorSeen =
        true;


      const before =
        record.notifications.length;


      evaluateUrineWindow(

        record,

        row,

        true

      );


      if (
        record.notifications.length ===
        before
      ) {

        const urine =
          asNumber(
            row.urine
          );


        showMainAlertForPatient(

          patient,

          'Urine output within configured range',

          `${urine.toFixed(1)} mL is within ` +
          `${state.urineLimits.minMl}–` +
          `${state.urineLimits.maxMl} mL / 3 min.`

        );

      }


      savePatientRecords();


      updateDashboard();


      renderFluidChart();

    }

  );


$('test-bag-sound')
  .addEventListener(

    'click',

    async () => {

      const ready =
        await enableAlertSounds();


      if (
        ready
      ) {

        await playBagAlertSound();


        toast(
          'Bag alert sound'
        );

      }

    }

  );


$('test-urine-sound')
  .addEventListener(

    'click',

    async () => {

      const ready =
        await enableAlertSounds();


      if (
        ready
      ) {

        await playUrineAlertSound();


        toast(
          'Urine-output alert sound'
        );

      }

    }

  );


$('add-current-hour')
  .addEventListener(

    'click',

    () => {

      const record =
        getSelectedRecord();


      if (
        record
      ) {

        getOrCreateCurrentRow(
          record
        );


        renderFluidChart();

      }

    }

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


/* =====================================
   AUTOMATIC COMPLETED-WINDOW CHECK
===================================== */

setInterval(

  evaluateAllPatientCompletedWindows,

  15000

);


/* =====================================
   STARTUP
===================================== */

updateNotificationDot();

renderPatientSelection();

renderNotifications();

syncSettings();
