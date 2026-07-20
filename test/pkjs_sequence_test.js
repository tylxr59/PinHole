'use strict';

var assert = require('assert');
var Module = require('module');

var storage = {
  sourceType: 'custom',
  baseUrl: '',
  authType: 'none',
  authUsername: '',
  authPassword: '',
  authToken: '',
  cacheSeconds: '0',
  cameraList: JSON.stringify([{ name: 'Front', source: 'http://camera/snapshot.jpg' }])
};
var listeners = {};
var messages = [];
var firstMetadataFailure;
var secondMetadataFailure;

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
  sendAppMessage: function(message, ok, fail) {
    messages.push(message);
    if (message.FrameWidth !== undefined) {
      if (message.FrameSeq === 1) firstMetadataFailure = fail;
      if (message.FrameSeq === 2) secondMetadataFailure = fail;
      return;
    }
    if (ok) ok();
  },
  openURL: function() {}
};

function FakeXMLHttpRequest() {
  this.status = 0;
  this.response = null;
}

FakeXMLHttpRequest.prototype.open = function() {};
FakeXMLHttpRequest.prototype.setRequestHeader = function() {};
FakeXMLHttpRequest.prototype.abort = function() {};
FakeXMLHttpRequest.prototype.send = function() {
  this.status = 200;
  this.response = new ArrayBuffer(1);
  if (this.onload) this.onload();
};
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

listeners.appmessage({
  payload: { RequestFrame: 1, CameraIndex: 0, RequestSeq: 1 }
});
listeners.appmessage({
  payload: { RequestFrame: 1, CameraIndex: 0, RequestSeq: 2 }
});

assert.strictEqual(typeof firstMetadataFailure, 'function');
assert.strictEqual(typeof secondMetadataFailure, 'function');

firstMetadataFailure();
assert.ok(!messages.some(function(message) {
  return message.FrameSeq === 1 && message.ErrorCode !== undefined;
}), 'A superseded transfer must not report an error');

secondMetadataFailure();
assert.ok(messages.some(function(message) {
  return message.FrameSeq === 2 && message.ErrorMessage === 'METADATA FAILED';
}), 'The active transfer should still report errors');

var cameraMessages = messages.filter(function(message) {
  return message.CameraName === 'Front';
});
assert.deepStrictEqual(cameraMessages.map(function(message) {
  return message.FrameSeq;
}), [1, 2], 'Camera metadata should carry its request sequence');

listeners.ready();
var readyConfig = messages[messages.length - 1];
assert.strictEqual(readyConfig.RequestFrame, undefined,
  'Ready configuration should let the watch fallback timer coordinate startup');

listeners.webviewclosed({
  response: JSON.stringify({
    CameraList: { value: storage.cameraList }
  })
});
var savedConfig = messages[messages.length - 1];
assert.strictEqual(savedConfig.RequestFrame, 1,
  'Saving settings should explicitly refresh the watch');

console.log('PKJS sequence tests passed');
