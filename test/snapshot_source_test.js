'use strict';

var assert = require('assert');
var source = require('../src/pkjs/snapshot_source');
var configPage = require('../src/pkjs/config_page');

function testCameraMigration() {
  assert.deepStrictEqual(
    source.parseCameras('[{"name":"Front","stream":"front"}]'),
    [{ name: 'Front', source: 'front' }]
  );
  assert.deepStrictEqual(
    source.parseCameras('Front = front\nGarage=http://camera/snapshot.jpg'),
    [
      { name: 'Front', source: 'front' },
      { name: 'Garage', source: 'http://camera/snapshot.jpg' }
    ]
  );
}

function testProviderUrls() {
  assert.strictEqual(
    source.buildSnapshotUrl(
      { sourceType: 'go2rtc', baseUrl: 'http://host:1984/', cacheSeconds: 5 },
      { source: 'front door' }
    ),
    'http://host:1984/api/frame.jpeg?src=front%20door&w=200&cache=5s'
  );
  assert.strictEqual(
    source.buildSnapshotUrl(
      { sourceType: 'frigate', baseUrl: 'http://frigate:5000' },
      { source: 'front_door' }
    ),
    'http://frigate:5000/api/front_door/latest.jpg?height=172'
  );
  assert.strictEqual(
    source.buildSnapshotUrl(
      { sourceType: 'unifi', baseUrl: 'https://console.example' },
      { source: 'camera/id' }
    ),
    'https://console.example/proxy/protect/integration/v1/cameras/camera%2Fid/snapshot?highQuality=false'
  );
  assert.strictEqual(
    source.buildSnapshotUrl(
      { sourceType: 'custom' },
      { source: 'http://camera.local/snapshot.jpg?profile=low' }
    ),
    'http://camera.local/snapshot.jpg?profile=low'
  );
}

function testAuthenticationHeaders() {
  assert.deepStrictEqual(
    source.requestOptions({
      authType: 'basic',
      authUsername: 'user',
      authPassword: 'pass'
    }),
    {
      authType: 'basic',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      withCredentials: false
    }
  );
  assert.deepStrictEqual(
    source.requestOptions({ authType: 'bearer', authToken: ' token ' }).headers,
    { Authorization: 'Bearer token' }
  );
  assert.deepStrictEqual(
    source.requestOptions({ authType: 'apikey', authToken: ' secret ' }).headers,
    { 'X-API-Key': 'secret' }
  );
  assert.strictEqual(
    source.requestOptions({ authType: 'frigate' }).withCredentials,
    true
  );
}

function testSettingsPage() {
  var url = configPage.generateConfigUrl({
    sourceType: 'frigate',
    authType: 'frigate',
    cameras: []
  });
  var html = decodeURIComponent(url.substring(url.indexOf(',') + 1));
  assert.ok(html.indexOf('Setup Instructions') !== -1);
  assert.ok(html.indexOf('Frigate') !== -1);
  assert.ok(html.indexOf('Ubiquiti UniFi Protect') !== -1);
  assert.ok(html.indexOf('X-API-Key') !== -1);
  assert.ok(html.indexOf('cannot bypass self-signed certificate errors') !== -1);
}

testCameraMigration();
testProviderUrls();
testAuthenticationHeaders();
testSettingsPage();
console.log('snapshot source tests passed');
