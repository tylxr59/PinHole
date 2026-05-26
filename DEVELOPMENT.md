# Development

## Common Commands

```bash
npm install
npm run build
npm run install:emery
```

Use `--vnc` for emulator commands in headless sessions.

## Message Flow

1. The watch sends `RequestFrame`, `RequestSeq`, and `CameraIndex`.
2. PebbleKitJS fetches `/api/frame.jpeg` from go2rtc.
3. JS decodes the JPEG, fits it into the Time 2 viewport, and quantizes pixels to Pebble `GColor8`.
4. JS sends frame metadata followed by byte chunks.
5. The watch ignores stale sequence numbers, copies a complete frame into a runtime bitmap, and redraws.

## Release Checklist

```bash
pebble clean
npm install
pebble build
```

Then install `build/PinHole.pbw` on a device or emulator and verify:

- Settings page opens and saves.
- Camera list appears on the watch.
- SELECT refreshes the active camera.
- UP/DOWN switch cameras and fetch a frame.
- Existing frame remains visible while refreshing.
