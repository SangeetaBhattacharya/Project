const STORAGE_ROWS =
  'smartUrineFluidRowsV2';

const STORAGE_THRESHOLD =
  'urineThreshold';

const SESSION_LAST_SENSOR =
  'smartUrineLastSensorTotal';


const state = {

  loggedIn:
    false,

  currentView:
    'scan',

  scanned:
    false,

  threshold:
    Number(
      localStorage.getItem(
        STORAGE_THRESHOLD
      )
    ) || 400,

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
    document.getElementById(id);



/* ==========================
   TOAST
========================== */


function toast(message) {

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



/* ==========================
   LOGIN
========================== */


function login() {

  $('login-screen')
    .classList
    .remove('active');


  $('app-screen')
    .classList
    .add('active');


  state.loggedIn =
    true;


  showView(
    'scan'
  );

}



/* ==========================
   NAVIGATION
========================== */


function showView(name) {

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
          view.dataset.view === name
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
          button.dataset.go === name
        );

      }
    );


  $('page-title').textContent =
    titles[name] ||
    'Smart Urine Monitoring';


  if (
    name === 'dashboard'
  ) {

    updateDashboard();

  }


  if (
    name === 'chart'
  ) {

    renderFluidChart();

  }


  if (
    name === 'notifications'
  ) {

    renderNotifications();

  }


  if (
    name === 'settings'
  ) {

    syncThresholdInputs();

  }

}



/* ==========================
   QR CODE
========================== */


function completeDemoScan(
  source = 'Demo QR'
) {

  state.scanned =
    true;


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


  $('scan-message')
    .textContent =
      `${source}: ` +
      `UB-2026-001 linked ` +
      `to Patient P-0001.`;


  toast(
    'Urinary bag linked successfully'
  );


  setTimeout(
    () =>
      showView(
        'patient'
      ),
    450
  );

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

              $('scan-message')
                .textContent =
                  `QR detected: ` +
                  codes[0].rawValue;


              stopCamera();


              completeDemoScan(
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
          'QR detection is not supported ' +
          'in this browser. Use Demo QR.';

    }

  } catch (error) {

    $('scan-message')
      .textContent =
        'Camera permission unavailable.';


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



/* ==========================
   THRESHOLD
========================== */


function syncThresholdInputs() {

  $('threshold-input')
    .value =
      state.threshold;


  $('threshold-range')
    .value =
      Math.min(
        1000,
        state.threshold
      );


  $('threshold-preview')
    .textContent =
      state.threshold;


  $('threshold-inline')
    .textContent =
      state.threshold;


  $('threshold-card')
    .textContent =
      state.threshold;

}



function saveThreshold(
  value
) {

  const next =
    Math.max(

      50,

      Math.min(
        2000,
        Number(value) ||
        400
      )

    );


  state.threshold =
    next;


  localStorage.setItem(
    STORAGE_THRESHOLD,
    String(next)
  );


  syncThresholdInputs();

  updateDashboard();


  toast(
    `Alert threshold saved at ${next} mL`
  );

}



/* ==========================
   DASHBOARD
========================== */


function updateDashboard() {

  const r =
    state.reading;


  $('volume-value')
    .textContent =
      Number(
        r.volume || 0
      ).toFixed(1);


  $('pulses-value')
    .textContent =
      Math.round(
        Number(
          r.pulses || 0
        )
      );


  $('raw-value')
    .textContent =
      Math.round(
        Number(
          r.turbidityRaw || 0
        )
      );


  $('vout-value')
    .textContent =
      Number(
        r.vout || 0
      ).toFixed(2);


  $('vin-value')
    .textContent =
      Number(
        r.vin || 0
      ).toFixed(2);


  $('clarity-value')
    .textContent =
      r.clarity ||
      '—';


  syncThresholdInputs();


  const ratio =
    Math.min(

      (
        Number(
          r.volume || 0
        )
        /
        state.threshold
      )
      *
      100,

      100

    );


  $('volume-progress')
    .style
    .width =
      `${ratio}%`;


  const exceeded =
    Number(
      r.volume || 0
    )
    >
    state.threshold;


  $('volume-progress')
    .classList
    .toggle(
      'danger',
      exceeded
    );


  $('volume-status')
    .textContent =
      exceeded
        ? 'Threshold exceeded'
        : 'Within threshold';


  $('volume-status')
    .classList
    .toggle(
      'success',
      !exceeded
    );


  $('volume-status')
    .classList
    .toggle(
      'danger',
      exceeded
    );


  if (
    exceeded
  ) {

    triggerAlert();

  } else {

    $('alert-banner')
      .classList
      .add(
        'hidden'
      );

  }


  updateChartLiveStrip();

}



/* ==========================
   ALERTS
========================== */


function triggerAlert() {

  $('alert-banner')
    .classList
    .remove(
      'hidden'
    );


  $('alert-volume')
    .textContent =
      Number(
        state.reading.volume || 0
      ).toFixed(1);


  $('alert-threshold')
    .textContent =
      state.threshold;


  const key =
    `${Math.floor(
      Number(
        state.reading.volume || 0
      )
    )}-${state.threshold}`;


  const exists =
    state.notifications
      .some(
        notification =>
          notification.key === key
      );


  if (
    !exists
  ) {

    state.notifications
      .unshift({

        key,

        title:
          'Urine volume above threshold',

        message:
          `${
            Number(
              state.reading.volume || 0
            ).toFixed(1)
          } mL recorded; ` +
          `threshold is ` +
          `${state.threshold} mL.`,

        time:
          new Date()

      });

  }


  $('notification-dot')
    .classList
    .remove(
      'hidden'
    );


  renderNotifications();

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
          An alert will appear here
          when urine volume exceeds
          the configured threshold.
        </p>

      </div>

    `;


    return;

  }


  list.innerHTML =
    state.notifications
      .map(
        notification => `

          <div class="card notification-card">

            <strong>
              ${
                escapeHtml(
                  notification.title
                )
              }
            </strong>

            <p>
              ${
                escapeHtml(
                  notification.message
                )
              }
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



/* ==========================
   ESCAPE HTML
========================== */


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



/* ==========================
   SENSOR READING
========================== */


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


  logAutomaticUrine(
    reading.volume
  );


  updateDashboard();


  if (
    state.currentView ===
      'chart'
  ) {

    renderFluidChart();

  }


  return true;

}



/* ==========================
   DEMO READING
========================== */


function simulateReading() {

  const previous =
    Number(
      state.reading.volume ||
      0
    );


  const next =
    previous +
    50;


  acceptLiveReading(

    {

      volume:
        next,

      pulses:
        Number(
          state.reading.pulses ||
          0
        )
        +
        224,

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



/* ==========================
   DIRECT WEB SERIAL
========================== */


function parsePrototypeLine(
  line
) {

  const clean =
    String(
      line || ''
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
        'Use Chrome/Edge or Sensor Logger.';


    return;

  }


  try {

    state.serial.port =
      await navigator.serial
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
        value || '';


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

  } catch (error) {

    $('serial-status')
      .textContent =
        `Serial connection failed: ${
          error.message ||
          error
        }`;

  }

}



/* ==========================
   FLUID BALANCE STORAGE
========================== */


function loadFluidRows() {

  try {

    const rows =
      JSON.parse(

        localStorage
          .getItem(
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



/* ==========================
   HOURLY ROW
========================== */


function hourKey(
  date = new Date()
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
      ''

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



function totalRecordedUrine() {

  return state
    .fluidRows
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



/* ==========================
   AUTOMATIC URINE LOGGING
========================== */


function logAutomaticUrine(
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


  let previous =
    state.lastSensorTotal;


  if (
    previous === null ||
    !Number.isFinite(
      previous
    )
  ) {

    previous =
      totalRecordedUrine() >
      0

        ? current

        : 0;

  }


  let delta;


  if (
    current + 0.5 <
    previous
  ) {

    /*
      The Nesso counter has
      been reset.
    */

    delta =
      current;


    state.notifications
      .unshift({

        key:
          `reset-${Date.now()}`,

        title:
          'Nesso N1 volume counter reset',

        message:
          'A lower cumulative volume was received. ' +
          'Automatic hourly logging continued from the new reading.',

        time:
          new Date()

      });


    $('notification-dot')
      .classList
      .remove(
        'hidden'
      );

  } else {

    /*
      Normal case:
      new cumulative total
      minus previous total.
    */

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
    No change in sensor volume.
  */

  if (
    delta <=
    0.01
  ) {

    return;

  }


  /*
    Basic protection against
    obviously invalid readings.
  */

  if (
    delta >
    5000
  ) {

    return;

  }


  const row =
    getOrCreateCurrentRow();


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


  saveFluidRows();

}



/* ==========================
   CALCULATIONS
========================== */


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



/* ==========================
   NURSE INPUT CELLS
========================== */


function inputCell(
  row,
  field,
  className = ''
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

      ? ' min="0" step="1" inputmode="decimal"'

      : ' maxlength="4"';


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



/* ==========================
   FORMAT VALUES
========================== */


function formatNumber(
  number
) {

  const value =
    Math.round(
      asNumber(number) *
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
      asNumber(number) *
      10
    )
    /
    10;


  if (
    value > 0
  ) {

    return (
      '+' +
      formatNumber(
        value
      )
    );

  }


  return formatNumber(
    value
  );

}



/* ==========================
   RENDER FLUID CHART
========================== */


function renderFluidChart() {

  const body =
    $('fluid-balance-body');


  if (
    !body
  ) {
    return;
  }


  const rows =
    calculateFluidRows();


  if (
    !rows.length
  ) {

    getOrCreateCurrentRow();

    return renderFluidChart();

  }


  body.innerHTML =
    rows
      .map(
        row => `

          <tr>

            <td class="time-cell">

              ${
                hourLabel(
                  row.key
                )
              }

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
      last.balance < 0
    );


  $('summary-balance')
    .classList
    .toggle(
      'balance-positive',
      last.balance >= 0
    );


  updateChartLiveStrip();

}



/* ==========================
   HANDLE NURSE ENTRY
========================== */


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



/* ==========================
   LIVE CHART STATUS
========================== */


function updateChartLiveStrip() {

  if (
    !$(
      'chart-live-volume'
    )
  ) {

    return;

  }


  $('chart-live-volume')
    .textContent =
      Number(
        state.reading.volume ||
        0
      )
      .toFixed(
        1
      );


  $('chart-source')
    .textContent =
      state.liveSource;


  $('chart-connection-pill')
    .textContent =

      state.liveSource ===
      'Waiting for live feed'

        ? 'Waiting'

        : 'Live';


  $('chart-connection-pill')
    .classList
    .toggle(

      'success',

      state.liveSource !==
      'Waiting for live feed'

    );

}



/* ==========================
   ADD CURRENT HOUR
========================== */


function addCurrentHourRow() {

  getOrCreateCurrentRow();

  renderFluidChart();

  toast(
    'Current hour added'
  );

}



/* ==========================
   CSV EXPORT
========================== */


function exportFluidCsv() {

  const rows =
    calculateFluidRows();


  const header = [

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


  const lines = [

    header.join(',')

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
    `fluid-balance-P-0001-${
      new Date()
        .toISOString()
        .slice(
          0,
          10
        )
    }.csv`;


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



/* ==========================
   RESET SESSION
========================== */


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


  toast(
    'New fluid-balance session started'
  );

}



/* ==========================
   SENSOR LOGGER BRIDGE
========================== */


/*
  The Sensor Logger is normally:

  http://127.0.0.1:5000

  The GitHub application is:

  https://sangeetabhattacharya.github.io/Project/

  postMessage allows the local
  logger to send readings to
  the GitHub page.
*/


const TRUSTED_LOGGER_ORIGINS =
  new Set([

    'http://127.0.0.1:5000',

    'http://localhost:5000'

  ]);



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



/* ==========================
   EVENT LISTENERS
========================== */


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

    () =>
      completeDemoScan()

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


$('threshold-input')
  .addEventListener(

    'input',

    event => {

      const value =
        Number(
          event.target.value
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        $('threshold-preview')
          .textContent =
            value;


        $('threshold-range')
          .value =
            Math.min(
              1000,
              Math.max(
                50,
                value
              )
            );

      }

    }

  );


$('threshold-range')
  .addEventListener(

    'input',

    event => {

      $('threshold-input')
        .value =
          event.target.value;


      $('threshold-preview')
        .textContent =
          event.target.value;

    }

  );


$('threshold-form')
  .addEventListener(

    'submit',

    event => {

      event.preventDefault();


      saveThreshold(
        $('threshold-input')
          .value
      );


      showView(
        'dashboard'
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



/* ==========================
   START APPLICATION
========================== */


syncThresholdInputs();

updateDashboard();

getOrCreateCurrentRow();

renderFluidChart();
