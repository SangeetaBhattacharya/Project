const state = {
  loggedIn: false,
  currentView: 'scan',
  scanned: false,
  threshold: Number(localStorage.getItem('urineThreshold')) || 400,
  reading: {
    volume: 50.4,
    pulses: 226,
    turbidityRaw: 1731,
    vout: 1.39,
    vin: 2.09,
    clarity: 'CLOUDY'
  },
  notifications: [],
  serial: { port: null, reader: null, connected: false }
};

const titles = {
  scan: 'Scan urinary bag',
  patient: 'Patient details',
  dashboard: 'Fluid balance',
  notifications: 'Alerts & notifications',
  settings: 'Settings'
};

const $ = (id) => document.getElementById(id);

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function login() {
  $('login-screen').classList.remove('active');
  $('app-screen').classList.add('active');
  state.loggedIn = true;
  showView('scan');
}

function showView(name) {
  state.currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.go === name));
  $('page-title').textContent = titles[name] || 'Smart Urine Monitoring';
  if (name === 'dashboard') updateDashboard();
  if (name === 'notifications') renderNotifications();
  if (name === 'settings') syncThresholdInputs();
}

function completeDemoScan(source = 'Demo QR') {
  state.scanned = true;
  $('last-scan-time').textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  $('scan-message').textContent = `${source}: UB-2026-001 linked to Patient P-0001.`;
  toast('Urinary bag linked successfully');
  setTimeout(() => showView('patient'), 450);
}

async function startCamera() {
  const card = document.querySelector('.camera-card');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    $('camera').srcObject = stream;
    await $('camera').play();
    card.classList.add('camera-on');
    $('scan-message').textContent = 'Camera active. Looking for a QR code…';

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const scanLoop = async () => {
        if (!card.classList.contains('camera-on')) return;
        try {
          const codes = await detector.detect($('camera'));
          if (codes.length) {
            $('scan-message').textContent = `QR detected: ${codes[0].rawValue}`;
            stopCamera();
            completeDemoScan('QR scan');
            return;
          }
        } catch (_) {}
        requestAnimationFrame(scanLoop);
      };
      scanLoop();
    } else {
      $('scan-message').textContent = 'Camera active. QR detection is not supported in this browser; use Demo QR to continue.';
    }
  } catch (err) {
    $('scan-message').textContent = 'Camera permission unavailable. Use Demo QR to continue.';
    toast('Camera could not be started');
  }
}

function stopCamera() {
  const video = $('camera');
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  document.querySelector('.camera-card').classList.remove('camera-on');
}

function syncThresholdInputs() {
  $('threshold-input').value = state.threshold;
  $('threshold-range').value = Math.min(1000, state.threshold);
  $('threshold-preview').textContent = state.threshold;
  $('threshold-inline').textContent = state.threshold;
  $('threshold-card').textContent = state.threshold;
}

function updateDashboard() {
  const r = state.reading;
  $('volume-value').textContent = r.volume.toFixed(1);
  $('pulses-value').textContent = Math.round(r.pulses);
  $('raw-value').textContent = Math.round(r.turbidityRaw);
  $('vout-value').textContent = Number(r.vout).toFixed(2);
  $('vin-value').textContent = Number(r.vin).toFixed(2);
  $('clarity-value').textContent = r.clarity;
  $('feed-time').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  syncThresholdInputs();

  const ratio = Math.min((r.volume / state.threshold) * 100, 100);
  $('volume-progress').style.width = `${ratio}%`;

  const exceeded = r.volume > state.threshold;
  $('volume-progress').classList.toggle('danger', exceeded);
  $('volume-status').textContent = exceeded ? 'Threshold exceeded' : 'Within threshold';
  $('volume-status').classList.toggle('success', !exceeded);
  $('volume-status').classList.toggle('danger', exceeded);

  if (exceeded) triggerAlert();
  else $('alert-banner').classList.add('hidden');
}

function triggerAlert() {
  $('alert-banner').classList.remove('hidden');
  $('alert-volume').textContent = state.reading.volume.toFixed(1);
  $('alert-threshold').textContent = state.threshold;

  const key = `${Math.floor(state.reading.volume)}-${state.threshold}`;
  const exists = state.notifications.some(n => n.key === key);
  if (!exists) {
    state.notifications.unshift({
      key,
      title: 'Urine volume above threshold',
      message: `${state.reading.volume.toFixed(1)} mL recorded for Patient P-0001; configured threshold is ${state.threshold} mL.`,
      time: new Date()
    });
  }
  $('notification-dot').classList.remove('hidden');
  renderNotifications();
}

function renderNotifications() {
  const list = $('notification-list');
  if (!state.notifications.length) {
    list.innerHTML = `<div class="empty-state"><div>🔔</div><strong>No alerts yet</strong><p>An alert will appear here when the monitored urine volume exceeds the configured threshold.</p></div>`;
    return;
  }
  list.innerHTML = state.notifications.map(n => `
    <div class="card notification-card">
      <strong>${escapeHtml(n.title)}</strong>
      <p>${escapeHtml(n.message)}</p>
      <time>${n.time.toLocaleString()}</time>
    </div>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function saveThreshold(value) {
  const next = Math.max(50, Math.min(2000, Number(value) || 400));
  state.threshold = next;
  localStorage.setItem('urineThreshold', String(next));
  syncThresholdInputs();
  updateDashboard();
  toast(`Alert threshold saved at ${next} mL`);
}

function simulateReading() {
  state.reading.volume += 50;
  state.reading.pulses += 224;
  state.reading.turbidityRaw = 1720 + Math.floor(Math.random() * 40);
  state.reading.vout = 1.36 + Math.random() * .06;
  state.reading.vin = 2.04 + Math.random() * .09;
  state.reading.clarity = 'CLOUDY';
  updateDashboard();
}

function parsePrototypeLine(line) {
  // Expected logger format observed in the prototype demo:
  // time_ms, volume_ml, pulses, turbidity_raw, vout, vin, status
  const parts = line.trim().split(',').map(v => v.trim());
  if (parts.length < 7) return false;
  const [timeMs, volume, pulses, raw, vout, vin, status] = parts;
  const nums = [volume, pulses, raw, vout, vin].map(Number);
  if (nums.some(Number.isNaN)) return false;
  state.reading = {
    volume: nums[0], pulses: nums[1], turbidityRaw: nums[2],
    vout: nums[3], vin: nums[4], clarity: status.toUpperCase()
  };
  $('feed-time').textContent = `Device ${timeMs} ms`;
  updateDashboard();
  return true;
}

async function connectSerial() {
  if (!('serial' in navigator)) {
    $('serial-status').textContent = 'Web Serial is not supported here. Use desktop Chrome/Edge or keep Demo feed.';
    toast('Web Serial unavailable in this browser');
    return;
  }
  try {
    state.serial.port = await navigator.serial.requestPort();
    await state.serial.port.open({ baudRate: 115200 });
    state.serial.connected = true;
    $('connection-pill').textContent = 'Serial connected';
    $('connection-pill').classList.add('success');
    $('serial-status').textContent = 'Connected at 115200 baud. Waiting for prototype CSV lines…';
    $('settings-source').textContent = 'Nesso N1 Web Serial';

    const decoder = new TextDecoderStream();
    state.serial.port.readable.pipeTo(decoder.writable);
    state.serial.reader = decoder.readable.getReader();
    let buffer = '';
    while (state.serial.connected) {
      const { value, done } = await state.serial.reader.read();
      if (done) break;
      buffer += value || '';
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach(parsePrototypeLine);
    }
  } catch (err) {
    $('serial-status').textContent = `Serial connection not completed: ${err.message || err}`;
  }
}

$('login-form').addEventListener('submit', e => { e.preventDefault(); login(); });
$('demo-login').addEventListener('click', login);
$('demo-scan').addEventListener('click', () => completeDemoScan());
$('start-camera').addEventListener('click', startCamera);
$('notification-button').addEventListener('click', () => showView('notifications'));
$('simulate-reading').addEventListener('click', simulateReading);
$('serial-connect').addEventListener('click', connectSerial);
$('ack-alert').addEventListener('click', () => { $('alert-banner').classList.add('hidden'); toast('Alert acknowledged'); });

document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.go)));

$('threshold-input').addEventListener('input', e => {
  const val = Number(e.target.value);
  if (Number.isFinite(val)) {
    $('threshold-preview').textContent = val;
    $('threshold-range').value = Math.min(1000, Math.max(50, val));
  }
});
$('threshold-range').addEventListener('input', e => {
  $('threshold-input').value = e.target.value;
  $('threshold-preview').textContent = e.target.value;
});
$('threshold-form').addEventListener('submit', e => {
  e.preventDefault();
  saveThreshold($('threshold-input').value);
  showView('dashboard');
});

syncThresholdInputs();
updateDashboard();
