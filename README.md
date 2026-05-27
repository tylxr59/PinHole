# PinHole

Check your go2rtc security cameras from your Pebble Time 2.

PinHole is built for fast wrist checks: switch cameras with the hardware buttons, refresh the current view with SELECT, and keep the last good snapshot on screen while the next one loads. No cloud service, proxy, account, or external relay required.

Install PinHole from the [Repebble App Store](https://apps.repebble.com/789d24302fcd416ab4f68cf4).

![PinHole Pebble screenshot](https://github.com/tylxr59/PinHole/blob/main/pebble_screenshot.png?raw=true)

## Why PinHole?

- Check cameras without opening your phone
- Built around Pebble's hardware buttons for quick, one-handed use
- Talks directly to your go2rtc server from the paired phone
- Keeps the previous frame visible while a fresh snapshot loads
- Supports multiple cameras through the companion app settings
- Holds the backlight after a new frame arrives so you can actually inspect it
- Shows clear setup, loading, retry, and error states on the watch

## What You Need

- Pebble Time 2, `emery`
- A reachable go2rtc instance from the paired phone
- go2rtc streams that support `/api/frame.jpeg`
- Pebble SDK 4.x / Pebble Tool, only if you want to build locally

PinHole requests snapshots from:

```text
<base-url>/api/frame.jpeg?src=<stream>&w=200
```

If your go2rtc instance requires authentication, include it in the base URL or expose go2rtc through an already-authenticated local endpoint.

## Setup

Open PinHole from the Pebble companion app settings and configure:

- **go2rtc Base URL**: for example `http://192.168.1.10:1984`
- **Cache seconds**: optional go2rtc snapshot cache value; use `0` for live refreshes
- **Cameras**: add a display name and go2rtc stream alias for each camera

Use **Test** on an individual camera to load a preview from the paired phone. Use **Validate All** to check every configured camera before saving.

Example:

```text
Base URL: http://192.168.1.10:1984
Camera: Front Door / front
Camera: Garage / garage
```

The stream value should be the go2rtc alias only, not the full snapshot URL. If a camera does not load, test the generated URL from the paired phone's browser first.

## Controls

- **UP**: previous camera and fetch a new frame
- **DOWN**: next camera and fetch a new frame
- **SELECT**: refresh the current camera
- **BACK**: exit the app

## Troubleshooting

- **SET BASE URL**: the base URL setting is empty.
- **ADD CAMERAS**: no cameras have both a name and stream value.
- **HTTP 404**: the stream name does not match a go2rtc stream.
- **TIMEOUT / PHONE TIMEOUT**: the phone cannot reach go2rtc or PebbleKitJS did not answer the watch request.
- **JPEG DECODE FAILED**: the endpoint did not return a decodable JPEG image.

For quick testing, open this URL from the paired phone's browser:

```text
http://your-go2rtc-host:1984/api/frame.jpeg?src=your_stream&w=200
```

If that does not load, PinHole will not be able to fetch it either.

## Privacy and Security

PinHole does not use an external service or proxy. Snapshot requests are made on the paired phone directly to the go2rtc base URL you configure.

Camera names, stream aliases, cache preference, and base URL are stored in the Pebble companion app's local storage for this app. If your go2rtc endpoint is exposed outside your local network, protect it with your own authentication or network controls.

## Development

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

## Project Layout

```text
src/c/                 Pebble C app and UI
src/pkjs/              PebbleKitJS bridge, settings page, fetch/decode pipeline
src/pkjs/vendor/       Vendored JPEG decoder source
package.json           Pebble metadata and message keys
wscript                Pebble SDK build script
```

## Notes

PinHole currently targets `emery` only. The settings page is generated locally by PebbleKitJS and stores the camera list on the paired phone. The JPEG decoder in `src/pkjs/vendor/` is derived from the `jpeg-js` decoder and kept in-tree with small ES5 compatibility edits for Pebble's older webpack toolchain.

AI assistance was used during development for code review, UI polish, documentation drafting, and implementation support. The app behavior, configuration choices, and release decisions were reviewed by the project maintainer.
