module.exports = [
  {
    "type": "heading",
    "defaultValue": "PinHole Settings"
  },
  {
    "type": "text",
    "defaultValue": "Configure go2rtc snapshots for your Pebble Time 2."
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "go2rtc"
      },
      {
        "type": "input",
        "messageKey": "BaseUrl",
        "label": "Base URL",
        "description": "Example: http://192.168.1.10:1984",
        "attributes": {
          "placeholder": "http://host:1984",
          "limit": 128
        }
      },
      {
        "type": "input",
        "messageKey": "CacheSeconds",
        "label": "Cache seconds",
        "description": "Optional. Use 0 for no go2rtc frame cache.",
        "defaultValue": "0",
        "attributes": {
          "type": "number",
          "min": "0",
          "max": "60"
        }
      }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Cameras"
      },
      {
        "type": "text",
        "defaultValue": "Add up to six go2rtc streams. Leave unused rows blank."
      },
      {
        "type": "input",
        "messageKey": "Cam0Name",
        "label": "Camera 1 name",
        "attributes": {
          "placeholder": "Front Door",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam0Stream",
        "label": "Camera 1 stream",
        "attributes": {
          "placeholder": "front",
          "limit": 96
        }
      },
      {
        "type": "input",
        "messageKey": "Cam1Name",
        "label": "Camera 2 name",
        "attributes": {
          "placeholder": "Garage",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam1Stream",
        "label": "Camera 2 stream",
        "attributes": {
          "placeholder": "garage",
          "limit": 96
        }
      },
      {
        "type": "input",
        "messageKey": "Cam2Name",
        "label": "Camera 3 name",
        "attributes": {
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam2Stream",
        "label": "Camera 3 stream",
        "attributes": {
          "limit": 96
        }
      },
      {
        "type": "input",
        "messageKey": "Cam3Name",
        "label": "Camera 4 name",
        "attributes": {
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam3Stream",
        "label": "Camera 4 stream",
        "attributes": {
          "limit": 96
        }
      },
      {
        "type": "input",
        "messageKey": "Cam4Name",
        "label": "Camera 5 name",
        "attributes": {
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam4Stream",
        "label": "Camera 5 stream",
        "attributes": {
          "limit": 96
        }
      },
      {
        "type": "input",
        "messageKey": "Cam5Name",
        "label": "Camera 6 name",
        "attributes": {
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam5Stream",
        "label": "Camera 6 stream",
        "attributes": {
          "limit": 96
        }
      }
    ]
  },
  {
    "type": "submit",
    "defaultValue": "Save"
  }
];
