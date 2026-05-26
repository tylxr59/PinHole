# PinHole

PinHole is a Pebble Time 2 app for glancing at go2rtc security-camera snapshots from your wrist.

It is built for quick checks: pick a camera with the hardware buttons, fetch a fresh still frame, and keep the last good image on screen while the next one loads.

## Features

- Direct go2rtc snapshot support, no proxy required
- Pebble companion settings powered by Clay
- Up to six configured cameras
- Previous frame stays visible while refreshing
- Manual refresh with SELECT
- Camera switching with UP/DOWN
- 30-second backlight hold after a fresh frame arrives
- Low-frequency footer updates to avoid unnecessary redraws

## Requirements

- Pebble SDK 4.x / Pebble Tool
- Pebble Time 2 target, `emery`
- A reachable go2rtc instance from the paired phone
- go2rtc streams that support `/api/frame.jpeg`

PinHole requests snapshots from:

```text
<base-url>/api/frame.jpeg?src=<stream>&w=200
```

If your go2rtc instance requires authentication, include it in the base URL or expose go2rtc through an already-authenticated local endpoint.

## Settings

Open PinHole from the Pebble companion app settings and configure:

- **go2rtc Base URL**: for example `http://192.168.1.10:1984`
- **Cache seconds**: optional go2rtc snapshot cache value; use `0` for live refreshes
- **Camera slots**: a display name and go2rtc stream name for each camera

Example:

```text
Base URL: http://192.168.1.10:1984
Camera 1 name: Front Door
Camera 1 stream: front
Camera 2 name: Garage
Camera 2 stream: garage
```

## Controls

- **UP**: previous camera and fetch a new frame
- **DOWN**: next camera and fetch a new frame
- **SELECT**: refresh the current camera
- **BACK**: exit the app

## Build

Install dependencies and build the PBW:

```bash
npm install
pebble build
```

Install to the Time 2 emulator:

```bash
pebble install --emulator emery --vnc
```

Install to a connected watch:

```bash
pebble install --phone <phone-ip>
```

The compiled package is written to:

```text
build/PinHole.pbw
```

## Troubleshooting

- **SET BASE URL**: the base URL setting is empty.
- **ADD CAMERAS**: no camera slot has both a name and stream value.
- **HTTP 404**: the stream name does not match a go2rtc stream.
- **TIMEOUT / PHONE TIMEOUT**: the phone cannot reach go2rtc or PebbleKitJS did not answer the watch request.
- **JPEG DECODE FAILED**: the endpoint did not return a decodable JPEG image.

For quick testing, open this URL from the paired phone's browser:

```text
http://your-go2rtc-host:1984/api/frame.jpeg?src=your_stream&w=200
```

If that does not load, PinHole will not be able to fetch it either.

## Project Layout

```text
src/c/                 Pebble C app and UI
src/pkjs/              PebbleKitJS bridge, settings, fetch/decode pipeline
src/pkjs/vendor/       Vendored JPEG decoder source
package.json           Pebble metadata and message keys
wscript                Pebble SDK build script
```

## Notes

PinHole currently targets `emery` only. The JPEG decoder in `src/pkjs/vendor/` is derived from the `jpeg-js` decoder and kept in-tree with small ES5 compatibility edits for Pebble's older webpack toolchain.
