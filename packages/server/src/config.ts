import os from "os";

let // Local ip address that we're trying to calculate
  address,
  // Network interfaces
  ifaces = os.networkInterfaces();

// Iterate over interfaces ...
for (let dev in ifaces) {
  // ... and find the one that matches the criteria
  let iface = ifaces[dev]?.filter(function (details) {
    return details.family === "IPv4" && details.internal === false;
  });

  if (iface!.length > 0) address = iface![0].address;
}

address = "127.0.0.1";

export const config = {
  listenIp: "0.0.0.0",
  listenPort: 3016,
  sslCrt: "../ssl/cert.pem",
  sslKey: "../ssl/key.pem",

  mediasoup: {
    // Worker settings
    numWorkers: Object.keys(os.cpus()).length,
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: "warn",
      logTags: [
        "info",
        "ice",
        "dtls",
        "rtp",
        "srtp",
        "rtcp",
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ],
    },
    // Router settings
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/h264",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
        {
          kind: "screen",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
      ],
    },
    // WebRtcTransport settings
    webRtcTransport: {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: address, // replace by public IP address
        },
      ],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    },
  },
};
