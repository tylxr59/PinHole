'use strict';

var assert = require('assert');
var childProcess = require('child_process');
var path = require('path');

var root = path.resolve(__dirname, '..');
var script = path.join(root, 'tools', 'extract-release-notes.js');
var notes = childProcess.execFileSync(process.execPath, [script, '1.2.2'], {
  cwd: root,
  encoding: 'utf8'
});

assert.ok(notes.indexOf('- Fixed snapshot refreshes') === 0);
assert.ok(notes.indexOf('## ') === -1, 'Output should contain only one version body');

var missing = childProcess.spawnSync(process.execPath, [script, '0.0.0'], {
  cwd: root,
  encoding: 'utf8'
});
assert.notStrictEqual(missing.status, 0, 'Missing changelog versions must fail');
assert.ok(missing.stderr.indexOf('No CHANGELOG.md entry found for 0.0.0') !== -1);

console.log('release notes tests passed');
