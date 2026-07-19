'use strict';

function htmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function option(value, label, selected) {
  return '<option value="' + value + '"' +
    (value === selected ? ' selected' : '') + '>' + label + '</option>';
}

function configController(settings, returnTo) {
  var cameras = settings.cameras || [];
  var results = [];
  var authChanged = false;
  var list = document.getElementById('cameras');
  var error = document.getElementById('error');
  var summary = document.getElementById('summary');
  var sourceType = document.getElementById('sourceType');
  var baseUrl = document.getElementById('baseUrl');
  var cacheSeconds = document.getElementById('cacheSeconds');
  var authType = document.getElementById('authType');
  var authUsername = document.getElementById('authUsername');
  var authPassword = document.getElementById('authPassword');
  var authToken = document.getElementById('authToken');
  var modal = document.getElementById('modal');
  var modalImg = document.getElementById('modalImg');

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function trim(s) {
    return String(s || '').replace(/^\s+|\s+$/g, '');
  }

  function normalize(url) {
    url = trim(url);
    while (url.length > 1 && url.charAt(url.length - 1) === '/') {
      url = url.substring(0, url.length - 1);
    }
    return url;
  }

  function appendQuery(url, key, value) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') +
      encodeURIComponent(key) + '=' + encodeURIComponent(value);
  }

  function cameraSource(camera) {
    if (camera && camera.source !== undefined) return camera.source;
    return camera && camera.stream !== undefined ? camera.stream : '';
  }

  function sourceUi() {
    var type = sourceType.value;
    if (type === 'frigate') {
      return { label: 'Frigate camera name', placeholder: 'front_door' };
    }
    if (type === 'unifi') {
      return { label: 'Protect camera ID', placeholder: '67dda6dd00547203e40003ec' };
    }
    if (type === 'custom') {
      return { label: 'Snapshot URL', placeholder: 'http://camera/snapshot.jpg' };
    }
    return { label: 'go2rtc stream', placeholder: 'front' };
  }

  function snapshotUrl(source) {
    var type = sourceType.value;
    var base = normalize(baseUrl.value);
    var url;
    if (type === 'custom') {
      url = trim(source);
    } else if (type === 'frigate') {
      url = base + '/api/' + encodeURIComponent(source) + '/latest.jpg?height=172';
    } else if (type === 'unifi') {
      url = base + '/proxy/protect/integration/v1/cameras/' +
        encodeURIComponent(source) + '/snapshot?highQuality=false';
    } else {
      url = base + '/api/frame.jpeg?src=' + encodeURIComponent(source) + '&w=200';
      var cache = parseInt(cacheSeconds.value || '0', 10) || 0;
      if (cache > 0) url = appendQuery(url, 'cache', cache + 's');
    }
    return appendQuery(url, '_pinhole_test', Date.now());
  }

  function show(id, visible) {
    document.getElementById(id).className = visible ? '' : 'hidden';
  }

  function renderOptions() {
    var type = sourceType.value;
    var auth = authType.value;
    show('baseUrlGroup', type !== 'custom');
    show('cacheGroup', type === 'go2rtc');
    show('credentialsGroup', auth === 'frigate' || auth === 'basic');
    show('tokenGroup', auth === 'bearer' || auth === 'apikey');
    document.getElementById('tokenLabel').innerHTML = auth === 'apikey' ?
      'API key (sent as X-API-Key)' : 'Bearer token';

    var notes = [];
    var base = normalize(baseUrl.value);
    var hasHttpCamera = base.indexOf('http://') === 0;
    var hasHttpsCamera = base.indexOf('https://') === 0;
    if (type === 'custom') {
      hasHttpCamera = false;
      hasHttpsCamera = false;
      for (var i = 0; i < cameras.length; i++) {
        var cameraUrl = trim(cameraSource(cameras[i]));
        if (cameraUrl.indexOf('http://') === 0) hasHttpCamera = true;
        if (cameraUrl.indexOf('https://') === 0) hasHttpsCamera = true;
      }
    }
    if (hasHttpCamera) {
      notes.push('HTTP sends snapshots and any configured credentials without encryption. Use it only on a trusted local network.');
    }
    if (hasHttpsCamera) {
      notes.push('HTTPS certificates must already be trusted by the paired phone. PinHole cannot bypass self-signed certificate errors.');
    }
    if (auth !== 'none') {
      notes.push('Credentials are stored in PinHole local storage on the paired phone, not on the watch or a PinHole server.');
    }
    document.getElementById('securityNotice').innerHTML = notes.length ?
      '<strong>Security:</strong> ' + esc(notes.join(' ')) : '';
  }

  function setResult(index, state, message, url) {
    results[index] = { state: state, message: message, url: url || '' };
    renderResult(index);
  }

  function resultHtml(index) {
    var result = results[index];
    if (!result) return '';
    var cls = result.state === 'ok' ? ' ok' : result.state === 'bad' ? ' bad' : '';
    var html = '<div class="result' + cls + '">' + esc(result.message) + '</div>';
    if (result.state === 'ok' && result.url) {
      html += '<img class="preview" data-preview="' + index + '" src="' +
        esc(result.url) + '" alt="Camera preview">';
    }
    return html;
  }

  function renderResult(index) {
    var box = document.querySelector('[data-result="' + index + '"]');
    if (box) box.innerHTML = resultHtml(index);
  }

  function render() {
    list.innerHTML = '';
    var ui = sourceUi();
    if (!cameras.length) list.innerHTML = '<div class="empty">No cameras yet.</div>';
    for (var i = 0; i < cameras.length; i++) {
      var camera = cameras[i] || {};
      var div = document.createElement('div');
      div.className = 'camera';
      div.innerHTML = '<div class="camera-head"><div class="camera-title">Camera ' +
        (i + 1) + '</div><div class="camera-tools"><button type="button" class="secondary" data-test="' +
        i + '">Test</button><button type="button" class="danger" data-remove="' + i +
        '">Remove</button></div></div><div class="row"><div><label>Name</label><input data-name="' +
        i + '" value="' + esc(camera.name) + '" placeholder="Front Door"></div><div><label>' +
        esc(ui.label) + '</label><input data-source="' + i + '" value="' +
        esc(cameraSource(camera)) + '" placeholder="' + esc(ui.placeholder) +
        '"></div></div><div data-result="' + i + '">' + resultHtml(i) + '</div>';
      list.appendChild(div);
    }
    renderOptions();
  }

  function sync() {
    var names = list.querySelectorAll('[data-name]');
    var sources = list.querySelectorAll('[data-source]');
    var i;
    for (i = 0; i < names.length; i++) {
      var index = parseInt(names[i].getAttribute('data-name'), 10);
      cameras[index].name = names[i].value;
    }
    for (i = 0; i < sources.length; i++) {
      index = parseInt(sources[i].getAttribute('data-source'), 10);
      cameras[index].source = sources[i].value;
    }
  }

  function validHttpUrl(value) {
    return /^https?:\/\/[^\s]+$/i.test(trim(value));
  }

  function cameraValid(index) {
    sync();
    var camera = cameras[index] || {};
    var name = trim(camera.name);
    var source = trim(cameraSource(camera));
    if (sourceType.value !== 'custom' && !validHttpUrl(baseUrl.value)) {
      setResult(index, 'bad', 'Enter an HTTP or HTTPS base URL.');
      return false;
    }
    if (!name || !source) {
      setResult(index, 'bad', 'Enter both a display name and camera source.');
      return false;
    }
    if (sourceType.value === 'custom' && !validHttpUrl(source)) {
      setResult(index, 'bad', 'Snapshot URL must start with http:// or https://.');
      return false;
    }
    return true;
  }

  function testCamera(index, done) {
    if (!cameraValid(index)) {
      if (done) done(false, false);
      return;
    }
    if (authType.value !== 'none') {
      setResult(index, 'info', 'Save, then test this authenticated camera from the watch.');
      if (done) done(true, true);
      return;
    }
    var source = trim(cameraSource(cameras[index]));
    var url = snapshotUrl(source);
    var img = new Image();
    var finished = false;
    var timer = setTimeout(function() { finish(false, 'Timeout loading snapshot.'); }, 15000);
    function finish(ok, message) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      setResult(index, ok ? 'ok' : 'bad', message, ok ? url : '');
      if (done) done(ok, false);
    }
    img.onload = function() { finish(true, 'Loaded preview.'); };
    img.onerror = function() { finish(false, 'Could not load snapshot. Check the URL, network, and certificate.'); };
    setResult(index, 'loading', 'Loading preview...');
    img.src = url;
  }

  function authValid() {
    var auth = authType.value;
    if (auth === 'frigate' && sourceType.value !== 'frigate') {
      error.innerHTML = 'Frigate account authentication requires the Frigate source preset.';
      return false;
    }
    if ((auth === 'frigate' || auth === 'basic') &&
        (!trim(authUsername.value) || !authPassword.value)) {
      error.innerHTML = 'Enter both an authentication username and password.';
      return false;
    }
    if ((auth === 'bearer' || auth === 'apikey') && !trim(authToken.value)) {
      error.innerHTML = 'Enter the authentication token or API key.';
      return false;
    }
    return true;
  }

  document.getElementById('add').onclick = function() {
    sync();
    cameras.push({ name: '', source: '' });
    results.push(null);
    summary.innerHTML = '';
    render();
  };

  document.getElementById('validate').onclick = function() {
    sync();
    summary.innerHTML = 'Validating cameras...';
    error.innerHTML = '';
    var total = cameras.length;
    if (!total) {
      summary.innerHTML = 'Add at least one camera to validate.';
      return;
    }
    var index = 0;
    var pass = 0;
    var deferred = 0;
    function next() {
      if (index >= total) {
        summary.innerHTML = deferred ?
          deferred + ' authenticated camera(s) ready to test after saving.' :
          pass + ' of ' + total + ' cameras loaded.';
        return;
      }
      testCamera(index, function(ok, wasDeferred) {
        if (ok) pass++;
        if (wasDeferred) deferred++;
        index++;
        next();
      });
    }
    next();
  };

  list.onclick = function(event) {
    var target = event.target;
    if (!target) return;
    if (target.getAttribute('data-remove') !== null) {
      sync();
      var index = parseInt(target.getAttribute('data-remove'), 10);
      cameras.splice(index, 1);
      results.splice(index, 1);
      summary.innerHTML = '';
      render();
      return;
    }
    if (target.getAttribute('data-test') !== null) {
      summary.innerHTML = '';
      error.innerHTML = '';
      testCamera(parseInt(target.getAttribute('data-test'), 10));
      return;
    }
    if (target.getAttribute('data-preview') !== null) {
      var result = results[parseInt(target.getAttribute('data-preview'), 10)];
      if (result && result.url) {
        modalImg.src = result.url;
        modal.className = 'modal open';
      }
    }
  };

  list.oninput = function(event) {
    var target = event.target;
    if (!target) return;
    var attr = target.getAttribute('data-name') !== null ? 'data-name' : 'data-source';
    if (target.getAttribute(attr) !== null) {
      var index = parseInt(target.getAttribute(attr), 10);
      results[index] = null;
      summary.innerHTML = '';
      renderResult(index);
      sync();
      renderOptions();
    }
  };

  sourceType.onchange = function() {
    sync();
    if (!authChanged || authType.value === 'none') {
      authType.value = sourceType.value === 'frigate' ? 'frigate' :
        sourceType.value === 'unifi' ? 'apikey' : 'none';
    }
    results = [];
    summary.innerHTML = '';
    render();
  };
  authType.onchange = function() {
    authChanged = true;
    results = [];
    summary.innerHTML = '';
    render();
  };
  baseUrl.oninput = function() { results = []; summary.innerHTML = ''; render(); };
  cacheSeconds.onchange = function() { results = []; summary.innerHTML = ''; render(); };

  document.getElementById('closeModal').onclick = function() {
    modal.className = 'modal';
    modalImg.src = '';
  };
  modal.onclick = function(event) {
    if (event.target === modal) {
      modal.className = 'modal';
      modalImg.src = '';
    }
  };

  document.getElementById('form').onsubmit = function(event) {
    event.preventDefault();
    sync();
    error.innerHTML = '';
    if (sourceType.value !== 'custom' && !validHttpUrl(baseUrl.value)) {
      error.innerHTML = 'Base URL must start with http:// or https://.';
      return;
    }
    if (!authValid()) return;
    var clean = [];
    for (var i = 0; i < cameras.length; i++) {
      var name = trim(cameras[i].name);
      var source = trim(cameraSource(cameras[i]));
      if (!name && !source) continue;
      if (!name || !source) {
        error.innerHTML = 'Each camera needs both a display name and source.';
        return;
      }
      if (sourceType.value === 'custom' && !validHttpUrl(source)) {
        error.innerHTML = 'Every custom snapshot URL must start with http:// or https://.';
        return;
      }
      clean.push({ name: name, source: source });
    }

    var auth = authType.value;
    var username = auth === 'frigate' || auth === 'basic' ? trim(authUsername.value) : '';
    var password = auth === 'frigate' || auth === 'basic' ? authPassword.value : '';
    var token = auth === 'bearer' || auth === 'apikey' ? trim(authToken.value) : '';
    var payload = {
      SourceType: { value: sourceType.value },
      BaseUrl: { value: baseUrl.value },
      CacheSeconds: { value: cacheSeconds.value },
      AuthType: { value: auth },
      AuthUsername: { value: username },
      AuthPassword: { value: password },
      AuthToken: { value: token },
      CameraList: { value: JSON.stringify(clean) }
    };
    document.location = returnTo + encodeURIComponent(JSON.stringify(payload));
  };

  render();
}

function page(settings, returnTo) {
  settings = settings || {};
  var source = settings.sourceType || 'go2rtc';
  var auth = settings.authType || 'none';
  var sourceOptions = option('go2rtc', 'go2rtc', source) +
    option('frigate', 'Frigate', source) +
    option('unifi', 'Ubiquiti UniFi Protect', source) +
    option('custom', 'Custom snapshot URLs', source);
  var authOptions = option('none', 'None', auth) +
    option('frigate', 'Frigate account', auth) +
    option('basic', 'HTTP Basic', auth) +
    option('bearer', 'Bearer token', auth) +
    option('apikey', 'X-API-Key', auth);
  var cacheOptions = ['0', '5', '10', '15', '30', '60'].map(function(value) {
    return option(value, value + ' seconds', String(settings.cacheSeconds || 0));
  }).join('');

  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>PinHole Settings</title><style>' +
    'body{margin:0;background:#111;color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:16px}' +
    'main{max-width:720px;margin:0 auto;padding:18px 14px 28px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:24px 0 10px}' +
    'p,li{color:#bbb;line-height:1.4}p{margin:0 0 14px}li{margin:6px 0}label{display:block;font-weight:700;margin:14px 0 6px}' +
    'input,select{box-sizing:border-box;width:100%;background:#252525;color:#fff;border:1px solid #444;border-radius:6px;padding:10px;font:inherit}' +
    'code{color:#ffd1bf;overflow-wrap:anywhere}.camera{border:1px solid #333;background:#1b1b1b;border-radius:8px;padding:12px;margin:10px 0}' +
    '.camera-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}.camera-title{font-weight:700;color:#ddd}' +
    '.camera-tools{display:flex;gap:8px}.row{display:grid;grid-template-columns:1fr;gap:0}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}' +
    'button,a.button{border:0;border-radius:6px;padding:10px 12px;font:inherit;font-weight:700;text-align:center;text-decoration:none}' +
    'button{background:#ff4700;color:#fff}.secondary{background:#333;color:#fff}.danger{background:#3a2020;color:#ffb0a0}.actions button{flex:1}' +
    '.empty{border:1px dashed #444;border-radius:8px;padding:18px;text-align:center;color:#aaa;margin:10px 0}.hint{font-size:13px;color:#999;margin-top:6px}' +
    '.error{color:#ffb0a0;margin-top:10px;font-weight:700}.result{font-size:13px;color:#aaa;margin-top:10px}.result.ok{color:#9ee7a2}.result.bad{color:#ffb0a0}' +
    '.preview{display:block;max-width:200px;width:100%;height:auto;border:1px solid #444;border-radius:6px;margin-top:8px;background:#000}.summary{font-size:14px;color:#bbb;margin-top:10px}' +
    '.notice{font-size:13px;color:#ffcf8a;margin-top:12px;line-height:1.4}.hidden{display:none}.guides details{border:1px solid #333;background:#1b1b1b;border-radius:8px;margin:10px 0;padding:10px 12px}' +
    '.guides summary{font-weight:700;cursor:pointer}.guides ol,.guides ul{padding-left:22px}.modal{position:fixed;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,.86);display:none;align-items:center;justify-content:center;padding:18px;z-index:10}' +
    '.modal.open{display:flex}.modal img{max-width:100%;max-height:86vh;background:#000;border:1px solid #555}.modal button{position:fixed;right:14px;top:14px}' +
    '@media(min-width:620px){.row{grid-template-columns:1fr 1fr;gap:12px}.actions button{flex:0 0 auto}}</style></head><body><main>' +
    '<h1>PinHole Settings</h1><p>Configure JPEG snapshots fetched directly by your paired phone.</p>' +
    '<section class="guides"><h2>Setup Instructions</h2>' +
    '<details><summary>Frigate</summary><ol>' +
    '<li>Select <strong>Frigate</strong> as the source.</li>' +
    '<li>For authenticated access, use a trusted HTTPS URL (normally port 8971), choose <strong>Frigate account</strong>, and enter a dedicated viewer or camera-restricted account.</li>' +
    '<li>For an isolated LAN, Frigate port 5000 can use <code>http://frigate-host:5000</code> with no authentication. Port 5000 grants anonymous admin-equivalent API access and must not be exposed outside a trusted network.</li>' +
    '<li>Enter each camera\'s Frigate configuration name, such as <code>front_door</code>. PinHole generates <code>/api/front_door/latest.jpg?height=172</code>.</li>' +
    '</ol><p class="hint">Frigate\'s default self-signed certificate must be trusted by the paired phone, or replaced/terminated by a trusted certificate. PinHole cannot ignore certificate errors.</p></details>' +
    '<details><summary>Ubiquiti UniFi Protect</summary><ol>' +
    '<li>In UniFi Site Manager, open <strong>Settings &rarr; API Keys</strong>, create a key, and copy it.</li>' +
    '<li>Select <strong>Ubiquiti UniFi Protect</strong> and <strong>X-API-Key</strong>.</li>' +
    '<li>For the official cloud connector, use <code>https://api.ui.com/v1/connector/consoles/CONSOLE_ID</code> as the base URL. For local access, use <code>https://CONSOLE_ADDRESS</code>; its certificate must be trusted by the paired phone.</li>' +
    '<li>Enter each Protect camera ID. It is the ID shown in the camera device URL. PinHole generates the official <code>/proxy/protect/integration/v1/cameras/ID/snapshot</code> request.</li>' +
    '</ol><p class="hint">The cloud connector requires UniFi remote access. Local console HTTPS often uses a private certificate; PinHole cannot bypass its validation.</p></details>' +
    '<details><summary>HTTP, HTTPS, and custom URLs</summary><ul>' +
    '<li>HTTP snapshot URLs are supported, but credentials and images are unencrypted. Use them only on a trusted LAN.</li>' +
    '<li>HTTPS works only when the paired phone trusts the certificate and its hostname matches the configured URL.</li>' +
    '<li>Custom sources must be direct HTTP(S) JPEG snapshot URLs. RTSP, RTSPS, MJPEG, and video streams are not supported.</li>' +
    '<li>Authenticated previews cannot run inside this settings page. Save first, then test with SELECT on the watch.</li>' +
    '</ul></details></section>' +
    '<form id="form"><h2>Source</h2><label for="sourceType">System</label><select id="sourceType">' + sourceOptions + '</select>' +
    '<div id="baseUrlGroup"><label for="baseUrl">Base URL</label><input id="baseUrl" type="url" placeholder="http://host:port" value="' + htmlEscape(settings.baseUrl) + '">' +
    '<div class="hint">Must be reachable from the paired phone.</div></div>' +
    '<div id="cacheGroup"><label for="cacheSeconds">Cache seconds</label><select id="cacheSeconds">' + cacheOptions + '</select></div>' +
    '<h2>Authentication</h2><label for="authType">Method</label><select id="authType">' + authOptions + '</select>' +
    '<div id="credentialsGroup"><div class="row"><div><label for="authUsername">Username</label><input id="authUsername" autocomplete="username" value="' + htmlEscape(settings.authUsername) + '"></div>' +
    '<div><label for="authPassword">Password</label><input id="authPassword" type="password" autocomplete="current-password" value="' + htmlEscape(settings.authPassword) + '"></div></div></div>' +
    '<div id="tokenGroup"><label id="tokenLabel" for="authToken">Token</label><input id="authToken" type="password" autocomplete="off" value="' + htmlEscape(settings.authToken) + '"></div>' +
    '<div id="securityNotice" class="notice"></div>' +
    '<h2>Cameras</h2><p>Add camera identifiers or direct snapshot URLs for the selected system.</p><div id="cameras"></div>' +
    '<button type="button" class="secondary" id="add">Add Camera</button><div id="summary" class="summary"></div><div id="error" class="error"></div>' +
    '<div class="actions"><button type="button" class="secondary" id="validate">Validate All</button><button type="submit">Save</button>' +
    '<a class="button secondary" href="' + htmlEscape(returnTo) + '">Cancel</a></div></form></main>' +
    '<div id="modal" class="modal"><button type="button" id="closeModal">Close</button><img id="modalImg"></div>' +
    '<script>(' + configController.toString() + ')(' + scriptJson(settings) + ',' + scriptJson(returnTo) + ');</script></body></html>';
}

exports.generateConfigUrl = function(settings) {
  var returnTo = 'pebblejs://close#';
  if (typeof Pebble !== 'undefined' && Pebble.platform === 'pypkjs') {
    returnTo = '$$$RETURN_TO$$$';
  }
  return 'data:text/html;charset=utf-8,' +
    encodeURIComponent(page(settings || {}, returnTo));
};
