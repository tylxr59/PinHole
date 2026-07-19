'use strict';

var VIEW_W = 200;
var VIEW_H = 172;

function trim(s) {
  return String(s || '').replace(/^\s+|\s+$/g, '');
}

function normalizeBaseUrl(url) {
  url = trim(url);
  while (url.length > 1 && url.charAt(url.length - 1) === '/') {
    url = url.substring(0, url.length - 1);
  }
  return url;
}

function normalizeSourceType(value) {
  value = trim(value).toLowerCase();
  if (value === 'frigate' || value === 'unifi' || value === 'custom') {
    return value;
  }
  return 'go2rtc';
}

function normalizeAuthType(value) {
  value = trim(value).toLowerCase();
  if (value === 'frigate' || value === 'basic' || value === 'bearer' ||
      value === 'apikey') {
    return value;
  }
  return 'none';
}

function cameraSource(camera) {
  camera = camera || {};
  if (camera.source !== undefined) {
    return trim(camera.source);
  }
  return trim(camera.stream);
}

function normalizeCamera(camera) {
  camera = camera || {};
  return {
    name: trim(camera.name),
    source: cameraSource(camera)
  };
}

function parseCameraJson(text) {
  var parsed;
  try {
    parsed = JSON.parse(text || '[]');
  } catch (e) {
    return null;
  }

  var cameras = [];
  if (!Array.isArray(parsed)) {
    return cameras;
  }

  for (var i = 0; i < parsed.length; i++) {
    var camera = normalizeCamera(parsed[i]);
    if (camera.name && camera.source) {
      cameras.push(camera);
    }
  }
  return cameras;
}

function parseCameraLines(text) {
  var lines = String(text || '').split(/\r?\n/);
  var cameras = [];
  for (var i = 0; i < lines.length; i++) {
    var line = trim(lines[i]);
    if (!line) continue;
    var eq = line.indexOf('=');
    if (eq <= 0) continue;
    var camera = normalizeCamera({
      name: line.substring(0, eq),
      source: line.substring(eq + 1)
    });
    if (camera.name && camera.source) {
      cameras.push(camera);
    }
  }
  return cameras;
}

function parseCameras(text) {
  var jsonCameras = parseCameraJson(text);
  if (jsonCameras) {
    return jsonCameras;
  }
  return parseCameraLines(text);
}

function appendQuery(url, key, value) {
  var separator = url.indexOf('?') === -1 ? '?' : '&';
  return url + separator + encodeURIComponent(key) + '=' +
         encodeURIComponent(value);
}

function buildSnapshotUrl(settings, camera) {
  settings = settings || {};
  var sourceType = normalizeSourceType(settings.sourceType);
  var source = cameraSource(camera);
  var baseUrl = normalizeBaseUrl(settings.baseUrl);
  var url;

  if (sourceType === 'custom') {
    return source;
  }

  if (sourceType === 'frigate') {
    return baseUrl + '/api/' + encodeURIComponent(source) +
           '/latest.jpg?height=' + VIEW_H;
  }

  if (sourceType === 'unifi') {
    return baseUrl + '/proxy/protect/integration/v1/cameras/' +
           encodeURIComponent(source) + '/snapshot?highQuality=false';
  }

  url = baseUrl + '/api/frame.jpeg?src=' + encodeURIComponent(source) +
        '&w=' + VIEW_W;
  if (settings.cacheSeconds > 0) {
    url = appendQuery(url, 'cache', settings.cacheSeconds + 's');
  }
  return url;
}

function utf8Bytes(value) {
  var encoded = encodeURIComponent(String(value || ''));
  var bytes = [];
  for (var i = 0; i < encoded.length; i++) {
    if (encoded.charAt(i) === '%') {
      bytes.push(parseInt(encoded.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

function base64Encode(value) {
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var bytes = utf8Bytes(value);
  var result = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var a = bytes[i];
    var hasB = i + 1 < bytes.length;
    var hasC = i + 2 < bytes.length;
    var b = hasB ? bytes[i + 1] : 0;
    var c = hasC ? bytes[i + 2] : 0;
    var value24 = (a << 16) | (b << 8) | c;
    result += alphabet.charAt((value24 >> 18) & 63);
    result += alphabet.charAt((value24 >> 12) & 63);
    result += hasB ? alphabet.charAt((value24 >> 6) & 63) : '=';
    result += hasC ? alphabet.charAt(value24 & 63) : '=';
  }
  return result;
}

function requestOptions(settings) {
  settings = settings || {};
  var authType = normalizeAuthType(settings.authType);
  var headers = {};

  if (authType === 'basic') {
    headers.Authorization = 'Basic ' + base64Encode(
      trim(settings.authUsername) + ':' + String(settings.authPassword || '')
    );
  } else if (authType === 'bearer') {
    headers.Authorization = 'Bearer ' + trim(settings.authToken);
  } else if (authType === 'apikey') {
    headers['X-API-Key'] = trim(settings.authToken);
  }

  return {
    authType: authType,
    headers: headers,
    withCredentials: authType === 'frigate'
  };
}

exports.trim = trim;
exports.normalizeBaseUrl = normalizeBaseUrl;
exports.normalizeSourceType = normalizeSourceType;
exports.normalizeAuthType = normalizeAuthType;
exports.cameraSource = cameraSource;
exports.normalizeCamera = normalizeCamera;
exports.parseCameras = parseCameras;
exports.appendQuery = appendQuery;
exports.buildSnapshotUrl = buildSnapshotUrl;
exports.base64Encode = base64Encode;
exports.requestOptions = requestOptions;
