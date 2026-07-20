'use strict';

var messageKeys = require('message_keys');
var jpegDecoder = require('./jpeg_decoder');
var configPage = require('./config_page');
var snapshotSource = require('./snapshot_source');

var VIEW_W = 200;
var VIEW_H = 172;
var CHUNK_SIZE = 640;

var ERR_CONFIG = 1;
var ERR_HTTP = 2;
var ERR_DECODE = 3;
var ERR_TRANSFER = 4;

var activeSendSeq = 0;
var activeRequestTimer = null;
var frigateAuth = {
  key: '',
  authenticated: false,
  pending: false,
  waiters: []
};

function trim(s) {
  return snapshotSource.trim(s);
}

function cameraArrayFromSlots() {
  var cams = [];
  for (var i = 0; i < 6; i++) {
    var name = trim(localStorage.getItem('cam' + i + 'Name') || '');
    var stream = trim(localStorage.getItem('cam' + i + 'Stream') || '');
    if (name && stream) {
      cams.push({ name: name, source: stream });
    }
  }
  return cams;
}

function cameraListFromSlots() {
  var cams = cameraArrayFromSlots();
  return cams.length ? JSON.stringify(cams) : '';
}

function getSettings() {
  var cameraList = localStorage.getItem('cameraList') || '';
  if (!cameraList) {
    cameraList = cameraListFromSlots();
  }
  return {
    sourceType: snapshotSource.normalizeSourceType(
      localStorage.getItem('sourceType') || 'go2rtc'
    ),
    baseUrl: snapshotSource.normalizeBaseUrl(localStorage.getItem('baseUrl') || ''),
    cacheSeconds: Math.max(0, parseInt(localStorage.getItem('cacheSeconds') || '0', 10) || 0),
    authType: snapshotSource.normalizeAuthType(
      localStorage.getItem('authType') || 'none'
    ),
    authUsername: localStorage.getItem('authUsername') || '',
    authPassword: localStorage.getItem('authPassword') || '',
    authToken: localStorage.getItem('authToken') || '',
    cameras: snapshotSource.parseCameras(cameraList)
  };
}

function hydrateStoredSettings() {
  var raw = localStorage.getItem('clay-settings');
  if (!raw) return;

  var stored;
  try {
    stored = JSON.parse(raw);
  } catch (e) {
    return;
  }

  if (stored.BaseUrl !== undefined && !localStorage.getItem('baseUrl')) {
    localStorage.setItem('baseUrl', stored.BaseUrl || '');
  }
  if (stored.CacheSeconds !== undefined && !localStorage.getItem('cacheSeconds')) {
    localStorage.setItem('cacheSeconds', stored.CacheSeconds || '0');
  }
  if (stored.SourceType !== undefined && !localStorage.getItem('sourceType')) {
    localStorage.setItem('sourceType', stored.SourceType || 'go2rtc');
  }
  if (stored.AuthType !== undefined && !localStorage.getItem('authType')) {
    localStorage.setItem('authType', stored.AuthType || 'none');
  }
  if (stored.AuthUsername !== undefined && !localStorage.getItem('authUsername')) {
    localStorage.setItem('authUsername', stored.AuthUsername || '');
  }
  if (stored.AuthPassword !== undefined && !localStorage.getItem('authPassword')) {
    localStorage.setItem('authPassword', stored.AuthPassword || '');
  }
  if (stored.AuthToken !== undefined && !localStorage.getItem('authToken')) {
    localStorage.setItem('authToken', stored.AuthToken || '');
  }
  for (var i = 0; i < 6; i++) {
    var nameKey = 'Cam' + i + 'Name';
    var streamKey = 'Cam' + i + 'Stream';
    if (stored[nameKey] !== undefined && !localStorage.getItem('cam' + i + 'Name')) {
      localStorage.setItem('cam' + i + 'Name', stored[nameKey] || '');
    }
    if (stored[streamKey] !== undefined && !localStorage.getItem('cam' + i + 'Stream')) {
      localStorage.setItem('cam' + i + 'Stream', stored[streamKey] || '');
    }
  }

  if (!localStorage.getItem('cameraList')) {
    var migrated = cameraListFromSlots();
    if (migrated) {
      localStorage.setItem('cameraList', migrated);
    }
  }
}

function sendMessage(msg, ok, fail) {
  Pebble.sendAppMessage(msg, ok || function() {}, fail || function(e) {
    console.log('send failed: ' + JSON.stringify(e));
  });
}

function payloadValue(payload, name, fallback) {
  if (payload[name] !== undefined) {
    return payload[name];
  }
  if (messageKeys && messageKeys[name] !== undefined) {
    var key = messageKeys[name];
    if (payload[key] !== undefined) {
      return payload[key];
    }
    if (payload[String(key)] !== undefined) {
      return payload[String(key)];
    }
  }
  return fallback;
}

function sendConfig(forceRefresh) {
  var settings = getSettings();
  var msg = {
    CameraCount: settings.cameras.length
  };
  if (forceRefresh) {
    msg.RequestFrame = 1;
  }
  if (settings.cameras.length > 0) {
    msg.CameraName = settings.cameras[0].name;
  }
  sendMessage(msg);
}

function sendCameraName(index, seq) {
  var settings = getSettings();
  var name = '';
  if (index >= 0 && index < settings.cameras.length) {
    name = settings.cameras[index].name;
  }
  sendMessage({
    FrameSeq: seq,
    CameraIndex: index,
    CameraCount: settings.cameras.length,
    CameraName: name
  });
}

function sendError(seq, index, code, message) {
  if (seq !== activeSendSeq) return;
  sendMessage({
    FrameSeq: seq,
    CameraIndex: index,
    ErrorCode: code,
    ErrorMessage: String(message || 'ERROR').substring(0, 48)
  });
}

function buildSnapshotUrl(settings, cam) {
  return snapshotSource.buildSnapshotUrl(settings, cam);
}

function fetchArrayBuffer(url, options, cb) {
  var req = new XMLHttpRequest();
  var finished = false;
  var timer = setTimeout(function() {
    if (finished) return;
    finished = true;
    try { req.abort(); } catch (e) {}
    cb(new Error('TIMEOUT'));
  }, 20000);

  function done(err, data) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    cb(err, data);
  }

  req.open('GET', url, true);
  if (options && options.withCredentials) {
    req.withCredentials = true;
  }
  var headers = options && options.headers ? options.headers : {};
  for (var name in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, name)) {
      req.setRequestHeader(name, headers[name]);
    }
  }
  req.responseType = 'arraybuffer';
  req.timeout = 20000;
  req.onload = function() {
    if (req.status < 200 || req.status >= 300) {
      var statusError = new Error('HTTP ' + req.status);
      statusError.status = req.status;
      done(statusError);
      return;
    }
    done(null, req.response);
  };
  req.onerror = function() { done(new Error('NETWORK ERROR')); };
  req.ontimeout = function() { done(new Error('TIMEOUT')); };
  req.send();
}

function frigateAuthKey(settings) {
  return settings.baseUrl + '\n' + settings.authUsername + '\n' +
         settings.authPassword;
}

function finishFrigateLogin(error) {
  var waiters = frigateAuth.waiters;
  frigateAuth.waiters = [];
  frigateAuth.pending = false;
  frigateAuth.authenticated = !error;
  for (var i = 0; i < waiters.length; i++) {
    waiters[i](error);
  }
}

function ensureFrigateAuthenticated(settings, cb) {
  var key = frigateAuthKey(settings);
  if (frigateAuth.key !== key) {
    frigateAuth.key = key;
    frigateAuth.authenticated = false;
    frigateAuth.pending = false;
    frigateAuth.waiters = [];
  }

  if (frigateAuth.authenticated) {
    cb(null);
    return;
  }

  frigateAuth.waiters.push(cb);
  if (frigateAuth.pending) {
    return;
  }
  frigateAuth.pending = true;

  var req = new XMLHttpRequest();
  var finished = false;
  var timer = setTimeout(function() {
    if (finished) return;
    finished = true;
    try { req.abort(); } catch (e) {}
    finishFrigateLogin(new Error('AUTH TIMEOUT'));
  }, 8000);

  function done(error) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    finishFrigateLogin(error);
  }

  req.open('POST', settings.baseUrl + '/api/login', true);
  req.withCredentials = true;
  req.timeout = 8000;
  req.setRequestHeader('Content-Type', 'application/json');
  req.setRequestHeader('X-CSRF-TOKEN', '1');
  req.onload = function() {
    if (req.status >= 200 && req.status < 300) {
      done(null);
    } else if (req.status === 401) {
      done(new Error('AUTH FAILED'));
    } else if (req.status === 429) {
      done(new Error('AUTH RATE LIMITED'));
    } else {
      done(new Error('AUTH HTTP ' + req.status));
    }
  };
  req.onerror = function() { done(new Error('AUTH NETWORK ERROR')); };
  req.ontimeout = function() { done(new Error('AUTH TIMEOUT')); };
  req.send(JSON.stringify({
    user: settings.authUsername,
    password: settings.authPassword
  }));
}

function fetchSnapshot(settings, camera, cb, allowAuthRetry) {
  var options = snapshotSource.requestOptions(settings);
  var url = buildSnapshotUrl(settings, camera);

  function fetchNow() {
    fetchArrayBuffer(url, options, function(error, buffer) {
      if (error && error.status === 401 && options.authType === 'frigate' &&
          allowAuthRetry !== false) {
        frigateAuth.authenticated = false;
        ensureFrigateAuthenticated(settings, function(loginError) {
          if (loginError) {
            cb(loginError);
            return;
          }
          fetchSnapshot(settings, camera, cb, false);
        });
        return;
      }
      cb(error, buffer);
    });
  }

  if (options.authType === 'frigate') {
    ensureFrigateAuthenticated(settings, function(loginError) {
      if (loginError) {
        cb(loginError);
        return;
      }
      fetchNow();
    });
  } else {
    fetchNow();
  }
}

function fitSize(srcW, srcH) {
  var scale = Math.min(VIEW_W / srcW, VIEW_H / srcH);
  var w = Math.max(1, Math.floor(srcW * scale));
  var h = Math.max(1, Math.floor(srcH * scale));
  return { w: w, h: h };
}

function gcolor8(r, g, b) {
  return 0xC0 | ((r & 0xC0) >> 2) | ((g & 0xC0) >> 4) | ((b & 0xC0) >> 6);
}

function resizeAndQuantize(decoded) {
  var srcW = decoded.width;
  var srcH = decoded.height;
  var size = fitSize(srcW, srcH);
  var out = new Array(size.w * size.h);
  var src = decoded.data;

  for (var y = 0; y < size.h; y++) {
    var sy = Math.min(srcH - 1, Math.floor((y + 0.5) * srcH / size.h));
    for (var x = 0; x < size.w; x++) {
      var sx = Math.min(srcW - 1, Math.floor((x + 0.5) * srcW / size.w));
      var si = (sy * srcW + sx) * 4;
      out[y * size.w + x] = gcolor8(src[si], src[si + 1], src[si + 2]);
    }
  }

  return {
    width: size.w,
    height: size.h,
    bytes: out
  };
}

function sendChunks(seq, index, frame, offset) {
  if (seq !== activeSendSeq) return;

  if (offset >= frame.bytes.length) {
    sendMessage({
      FrameSeq: seq,
      CameraIndex: index,
      FrameComplete: 1
    }, null, function() {
      sendError(seq, index, ERR_TRANSFER, 'TRANSFER FAILED');
    });
    return;
  }

  var end = Math.min(offset + CHUNK_SIZE, frame.bytes.length);
  var chunk = frame.bytes.slice(offset, end);
  sendMessage({
    FrameSeq: seq,
    CameraIndex: index,
    FrameOffset: offset,
    FrameChunkSize: chunk.length,
    FrameChunk: chunk
  }, function() {
    setTimeout(function() {
      sendChunks(seq, index, frame, end);
    }, 20);
  }, function() {
    sendError(seq, index, ERR_TRANSFER, 'TRANSFER FAILED');
  });
}

function requestFrame(index, seq) {
  activeSendSeq = seq;
  if (activeRequestTimer) {
    clearTimeout(activeRequestTimer);
    activeRequestTimer = null;
  }
  var settings = getSettings();
  sendCameraName(index, seq);

  if (settings.sourceType !== 'custom' && !settings.baseUrl) {
    sendError(seq, index, ERR_CONFIG, 'SET BASE URL');
    return;
  }
  if (!settings.cameras.length) {
    sendError(seq, index, ERR_CONFIG, 'ADD CAMERAS');
    return;
  }
  if (index < 0 || index >= settings.cameras.length) {
    sendError(seq, index, ERR_CONFIG, 'BAD CAMERA');
    return;
  }

  var cam = settings.cameras[index];
  if (!buildSnapshotUrl(settings, cam)) {
    sendError(seq, index, ERR_CONFIG, 'SET SNAPSHOT URL');
    return;
  }
  activeRequestTimer = setTimeout(function() {
    if (seq === activeSendSeq) {
      sendError(seq, index, ERR_HTTP, 'PHONE TIMEOUT');
    }
  }, 30000);

  fetchSnapshot(settings, cam, function(fetchErr, buffer) {
    if (seq !== activeSendSeq) return;
    if (activeRequestTimer) {
      clearTimeout(activeRequestTimer);
      activeRequestTimer = null;
    }
    if (fetchErr) {
      sendError(seq, index, ERR_HTTP, fetchErr.message);
      return;
    }

    var decoded;
    try {
      decoded = jpegDecoder.decode(new Uint8Array(buffer));
    } catch (e) {
      sendError(seq, index, ERR_DECODE, 'JPEG DECODE FAILED');
      return;
    }

    var frame = resizeAndQuantize(decoded);
    sendMessage({
      FrameSeq: seq,
      CameraIndex: index,
      FrameWidth: frame.width,
      FrameHeight: frame.height,
      FrameTotalBytes: frame.bytes.length
    }, function() {
      sendChunks(seq, index, frame, 0);
    }, function() {
      sendError(seq, index, ERR_TRANSFER, 'METADATA FAILED');
    });
  });
}

Pebble.addEventListener('ready', function() {
  console.log('PinHole PKJS ready');
  hydrateStoredSettings();
  sendConfig(false);
});

Pebble.addEventListener('appmessage', function(e) {
  var payload = e && e.payload ? e.payload : {};
  if (payloadValue(payload, 'RequestFrame') !== undefined) {
    requestFrame(payloadValue(payload, 'CameraIndex', 0),
                 payloadValue(payload, 'RequestSeq', 0));
  }
});

Pebble.addEventListener('showConfiguration', function() {
  hydrateStoredSettings();
  Pebble.openURL(configPage.generateConfigUrl(getSettings()));
});

Pebble.addEventListener('webviewclosed', function(e) {
  if (!e || !e.response) return;
  var response = e.response;
  if (response.charAt(0) !== '{') {
    response = decodeURIComponent(response);
  }

  var dict;
  try {
    dict = JSON.parse(response);
  } catch (parseError) {
    console.log('config parse failed: ' + parseError.message);
    return;
  }

  if (dict.BaseUrl !== undefined) {
    localStorage.setItem('baseUrl', dict.BaseUrl.value || '');
  }
  if (dict.SourceType !== undefined) {
    localStorage.setItem('sourceType', dict.SourceType.value || 'go2rtc');
  }
  if (dict.AuthType !== undefined) {
    localStorage.setItem('authType', dict.AuthType.value || 'none');
  }
  if (dict.AuthUsername !== undefined) {
    localStorage.setItem('authUsername', dict.AuthUsername.value || '');
  }
  if (dict.AuthPassword !== undefined) {
    localStorage.setItem('authPassword', dict.AuthPassword.value || '');
  }
  if (dict.AuthToken !== undefined) {
    localStorage.setItem('authToken', dict.AuthToken.value || '');
  }
  if (dict.CameraList !== undefined) {
    localStorage.setItem('cameraList', dict.CameraList.value || '');
  }
  if (dict.CacheSeconds !== undefined) {
    localStorage.setItem('cacheSeconds', dict.CacheSeconds.value || '0');
  }
  frigateAuth.key = '';
  frigateAuth.authenticated = false;
  frigateAuth.pending = false;
  frigateAuth.waiters = [];
  for (var i = 0; i < 6; i++) {
    var nameKey = 'Cam' + i + 'Name';
    var streamKey = 'Cam' + i + 'Stream';
    if (dict[nameKey] !== undefined) {
      localStorage.setItem('cam' + i + 'Name', dict[nameKey].value || '');
    }
    if (dict[streamKey] !== undefined) {
      localStorage.setItem('cam' + i + 'Stream', dict[streamKey].value || '');
    }
  }

  sendConfig(true);
});
