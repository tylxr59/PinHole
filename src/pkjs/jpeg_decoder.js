'use strict';

var decodeJpeg = require('./vendor/jpeg_decoder');

function decode(bytes) {
  return decodeJpeg(bytes, { useTArray: true, maxMemoryUsageInMB: 32 });
}

module.exports = {
  decode: decode
};
