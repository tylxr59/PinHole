'use strict';

var assert = require('assert');
var Module = require('module');

var storage = {
  sourceType: 'frigate',
  baseUrl: 'http://frigate.local:8971',
  authType: 'frigate',
  authUsername: 'viewer',
  authPassword: 'secret',
  authToken: '',
  cacheSeconds: '0',
  cameraList: JSON.stringify([{ name: 'Front', source: 'front_door' }])
};
var listeners = {};
var messages = [];
var requests = [];
var snapshotCount = 0;

global.localStorage = {
  getItem: function(key) {
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
  },
  setItem: function(key, value) {
    storage[key] = String(value);
  }
};

global.Pebble = {
  addEventListener: function(name, cb) {
    listeners[name] = cb;
  },
  sendAppMessage: function(message, ok) {
    messages.push(message);
    if (ok) ok();
  },
  openURL: function() {}
};

function FakeXMLHttpRequest() {
  this.headers = {};
  this.status = 0;
  this.response = null;
  this.withCredentials = false;
  requests.push(this);
}

FakeXMLHttpRequest.prototype.open = function(method, url) {
  this.method = method;
  this.url = url;
};

FakeXMLHttpRequest.prototype.setRequestHeader = function(name, value) {
  this.headers[name] = value;
};

FakeXMLHttpRequest.prototype.send = function(body) {
  this.body = body;
  if (this.url.indexOf('/api/login') !== -1) {
    this.status = 200;
  } else {
    snapshotCount++;
    this.status = snapshotCount === 1 ? 401 : 200;
    this.response = new ArrayBuffer(1);
  }
  if (this.onload) this.onload();
};

FakeXMLHttpRequest.prototype.abort = function() {};
global.XMLHttpRequest = FakeXMLHttpRequest;

var originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'message_keys') return {};
  if (request === './jpeg_decoder') {
    return {
      decode: function() {
        return { width: 1, height: 1, data: [255, 0, 0, 255] };
      }
    };
  }
  if (request === './config_page') {
    return { generateConfigUrl: function() { return 'data:text/html,'; } };
  }
  return originalLoad(request, parent, isMain);
};

require('../src/pkjs/index');
Module._load = originalLoad;

listeners.ready();
listeners.appmessage({
  payload: { RequestFrame: 1, CameraIndex: 0, RequestSeq: 1 }
});

var loginRequests = requests.filter(function(request) {
  return request.url.indexOf('/api/login') !== -1;
});
var snapshotRequests = requests.filter(function(request) {
  return request.url.indexOf('/latest.jpg') !== -1;
});

assert.strictEqual(loginRequests.length, 2, 'Frigate should re-login once after HTTP 401');
assert.strictEqual(snapshotRequests.length, 2, 'Frigate should retry the snapshot once');
assert.strictEqual(loginRequests[0].method, 'POST');
assert.strictEqual(loginRequests[0].withCredentials, true);
assert.strictEqual(loginRequests[0].headers['Content-Type'], 'application/json');
assert.deepStrictEqual(JSON.parse(loginRequests[0].body), {
  user: 'viewer',
  password: 'secret'
});
assert.strictEqual(snapshotRequests[0].withCredentials, true);
assert.strictEqual(
  snapshotRequests[0].url,
  'http://frigate.local:8971/api/front_door/latest.jpg?height=172'
);

storage.sourceType = 'unifi';
storage.baseUrl = 'http://unifi.local';
storage.authType = 'apikey';
storage.authUsername = '';
storage.authPassword = '';
storage.authToken = 'api-secret';
storage.cameraList = JSON.stringify([{ name: 'Doorbell', source: 'camera-id' }]);
snapshotCount = 1;
listeners.appmessage({
  payload: { RequestFrame: 1, CameraIndex: 0, RequestSeq: 2 }
});

var unifiRequest = requests[requests.length - 1];
assert.strictEqual(
  unifiRequest.url,
  'http://unifi.local/proxy/protect/integration/v1/cameras/camera-id/snapshot?highQuality=false'
);
assert.strictEqual(unifiRequest.headers['X-API-Key'], 'api-secret');
assert.ok(messages.some(function(message) { return message.FrameWidth > 0; }));

console.log('PKJS authentication tests passed');
