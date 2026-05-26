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
        "description": "go2rtc URL reachable from your paired phone. Example: http://192.168.1.10:1984",
        "attributes": {
          "type": "url",
          "placeholder": "http://host:1984",
          "limit": 128
        }
      },
      {
        "type": "select",
        "messageKey": "CacheSeconds",
        "label": "Cache seconds",
        "description": "Optional go2rtc frame cache. Use 0 for live refreshes.",
        "defaultValue": "0",
        "options": [
          { "label": "0 seconds", "value": "0" },
          { "label": "5 seconds", "value": "5" },
          { "label": "10 seconds", "value": "10" },
          { "label": "15 seconds", "value": "15" },
          { "label": "30 seconds", "value": "30" },
          { "label": "60 seconds", "value": "60" }
        ]
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
        "defaultValue": "Add up to six go2rtc streams. Leave unused camera sections blank. If loading fails, test /api/frame.jpeg from the paired phone browser."
      }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Camera 1"
      },
      {
        "type": "input",
        "messageKey": "Cam0Name",
        "label": "Name",
        "attributes": {
          "placeholder": "Front Door",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam0Stream",
        "label": "go2rtc stream",
        "description": "Stream alias from go2rtc, such as front, garage, or driveway.",
        "attributes": {
          "placeholder": "front",
          "limit": 96
        }
      }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Camera 2"
      },
      {
        "type": "input",
        "messageKey": "Cam1Name",
        "label": "Name",
        "attributes": {
          "placeholder": "Garage",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam1Stream",
        "label": "go2rtc stream",
        "description": "Must match the stream name configured in go2rtc.",
        "attributes": {
          "placeholder": "garage",
          "limit": 96
        }
      }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Camera 3"
      },
      {
        "type": "input",
        "messageKey": "Cam2Name",
        "label": "Name",
        "attributes": {
          "placeholder": "Driveway",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam2Stream",
        "label": "go2rtc stream",
        "description": "Leave name and stream blank if unused.",
        "attributes": {
          "placeholder": "driveway",
          "limit": 96
        }
      }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Camera 4"
      },
      {
        "type": "input",
        "messageKey": "Cam3Name",
        "label": "Name",
        "attributes": {
          "placeholder": "Back Yard",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam3Stream",
        "label": "go2rtc stream",
        "description": "Use only the alias, not the full /api/frame.jpeg URL.",
        "attributes": {
          "placeholder": "backyard",
          "limit": 96
        }
      }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Camera 5"
      },
      {
        "type": "input",
        "messageKey": "Cam4Name",
        "label": "Name",
        "attributes": {
          "placeholder": "Side Gate",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam4Stream",
        "label": "go2rtc stream",
        "description": "Must match the stream name configured in go2rtc.",
        "attributes": {
          "placeholder": "side_gate",
          "limit": 96
        }
      }
    ]
  },
  {
    "type": "section",
    "items": [
      {
        "type": "heading",
        "defaultValue": "Camera 6"
      },
      {
        "type": "input",
        "messageKey": "Cam5Name",
        "label": "Name",
        "attributes": {
          "placeholder": "Porch",
          "limit": 40
        }
      },
      {
        "type": "input",
        "messageKey": "Cam5Stream",
        "label": "go2rtc stream",
        "description": "Leave name and stream blank if unused.",
        "attributes": {
          "placeholder": "porch",
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
