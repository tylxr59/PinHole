# PinHole

PinHole turns your Pebble Time 2 into a quick, button-first viewer for go2rtc security-camera snapshots.

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
- Clear first-run, loading, and retry states on the watch

## Requirements

- Pebble Time 2, `emery`
- Pebble SDK 4.x / Pebble Tool for local builds
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
- **Camera slots**: a display name and go2rtc stream alias for each camera

Example:

```text
Base URL: http://192.168.1.10:1984
Camera 1 name: Front Door
Camera 1 stream: front
Camera 2 name: Garage
Camera 2 stream: garage
```

The stream value should be the go2rtc alias only, not the full snapshot URL. If a camera does not load, test the generated URL from the paired phone's browser first.

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

## Store Notes

PinHole is designed for Pebble Time 2 only. It shows still JPEG frames through go2rtc's `/api/frame.jpeg` endpoint; it does not stream video.

Recommended screenshots for a store listing:

- A configured camera with a loaded frame and `UPDATED NOW`
- A refresh in progress with the previous frame still visible
- The first-run or missing-settings state
- A retryable error state such as `CHECK PHONE` or `SELECT TO RETRY`

## Privacy and Security

PinHole does not use an external service or proxy. Snapshot requests are made by PebbleKitJS on the paired phone directly to the go2rtc base URL you configure.

Camera names, stream aliases, cache preference, and base URL are stored in the Pebble companion app's local storage for this app. If your go2rtc endpoint is exposed outside your local network, protect it with your own authentication or network controls.

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

AI assistance was used during development for code review, UI polish, documentation drafting, and implementation support. The app behavior, configuration choices, and release decisions were reviewed by the project maintainer.
