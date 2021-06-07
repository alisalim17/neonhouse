import express from "express";
import { createServer } from "http";
import * as mediasoup from "mediasoup";
import fs from "fs";
import { config } from "./config";
import path, { join } from "path";
import { Room } from "./Room";
import { Peer } from "./Peer";

const app = express();

// const httpsServer = https.createServer(options, app)
const httpsServer = createServer(app);
const io = require("socket.io")(httpsServer);

app.use(express.static(path.join(__dirname, "..", "client/build")));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "../client/build/index.html"));
});

httpsServer.listen(config.listenPort, () => {
  console.log("listening https " + config.listenPort);
});

// all mediasoup workers
let workers: any[] = [];
let nextMediasoupWorkerIdx = 0;

/**
 * roomList
 * {
 *  room_id: Room {
 *      id:
 *      router:
 *      peers: {
 *          id:,
 *          name:,
 *          master: [boolean],
 *          transports: [Map],
 *          producers: [Map],
 *          consumers: [Map],
 *          rtpCapabilities:
 *      }
 *  }
 * }
 */
let roomList = new Map();

(async () => {
  await createWorkers();
})();

async function createWorkers() {
  let { numWorkers } = config.mediasoup;

  for (let i = 0; i < numWorkers; i++) {
    let worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel as any,
      logTags: config.mediasoup.worker.logTags as any,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on("died", () => {
      console.error(
        "mediasoup worker died, exiting in 2 seconds... [pid:%d]",
        worker.pid
      );
      setTimeout(() => process.exit(1), 2000);
    });
    workers.push(worker);

    // log worker resource usage
    /*setInterval(async () => {
            const usage = await worker.getResourceUsage();

            console.info('mediasoup Worker resource usage [pid:%d]: %o', worker.pid, usage);
        }, 120000);*/
  }
}

io.on("connection", (socket: any) => {
  socket.on("createRoom", async ({ room_id }: any, callback: any) => {
    if (roomList.has(room_id)) {
      callback("already exists");
    } else {
      console.log("---created room--- ", room_id);
      let worker = await getMediasoupWorker();
      roomList.set(room_id, new Room(room_id, worker, io, socket.id));
      callback(room_id);
    }
  });

  socket.on("join", async ({ room_id, name }: any, cb: any) => {
    console.log('---user joined--- "' + room_id + '": ' + name);
    if (!roomList.has(room_id)) {
      return cb({
        error: "room does not exist",
      });
    }
    roomList.get(room_id).addPeer(new Peer(socket.id, name));
    socket.room_id = room_id;
    const produceList = roomList.get(room_id).getProducerListForPeer(socket.id);
    console.log(produceList);

    await roomList.get(room_id).addUser({
      _id: socket.id,
      name: name,
    });
    const userOfRoom = roomList.get(room_id).getUsersOfRoom();
    userOfRoom.forEach((user: any) => {
      if (user._id == socket.id) return;
      socket.to(user._id).emit("new-user", {
        users: userOfRoom,
        user: {
          _id: socket.id,
          name,
        },
      });
    });
    cb({
      peers: roomList.get(room_id).toJson(),
      data: {
        user: {
          _id: room_id,
          name,
        },
        users: userOfRoom,
      },
    });
  });

  socket.on("getProducers", () => {
    console.log(
      `---get producers--- name:${
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    // send all the current producer to newly joined member
    if (!roomList.has(socket.room_id)) return;
    let producerList = roomList
      .get(socket.room_id)
      .getProducerListForPeer(socket.id);
    socket.emit("newProducers", producerList);
    console.log(socket.rooms);
  });

  socket.on("getRouterRtpCapabilities", (_: any, callback: any) => {
    console.log(
      `---get RouterRtpCapabilities--- name: ${
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    try {
      callback(roomList.get(socket.room_id).getRtpCapabilities());
    } catch (e) {
      callback({
        error: e.message,
      });
    }
  });

  socket.on("createWebRtcTransport", async (_: any, callback: any) => {
    console.log(
      `---create webrtc transport--- name: ${
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    try {
      const { params } = await roomList
        .get(socket.room_id)
        .createWebRtcTransport(socket.id);

      callback(params);
    } catch (err) {
      console.error(err);
      callback({
        error: err.message,
      });
    }
  });

  socket.on(
    "connectTransport",
    async ({ transport_id, dtlsParameters }: any, callback: any) => {
      console.log(
        `---connect transport--- name: ${
          roomList.get(socket.room_id).getPeers().get(socket.id).name
        }`
      );
      if (!roomList.has(socket.room_id)) return;
      await roomList
        .get(socket.room_id)
        .connectPeerTransport(socket.id, transport_id, dtlsParameters);

      callback("success");
    }
  );

  socket.on(
    "produce",
    async (
      { kind, rtpParameters, producerTransportId }: any,
      callback: any
    ) => {
      if (!roomList.has(socket.room_id)) {
        return callback({ error: "not is a room" });
      }

      let producer_id = await roomList
        .get(socket.room_id)
        .produce(socket.id, producerTransportId, rtpParameters, kind);
      console.log(
        `---produce--- type: ${kind} name: ${
          roomList.get(socket.room_id).getPeers().get(socket.id).name
        } id: ${producer_id}`
      );
      callback({
        producer_id,
      });
    }
  );

  socket.on(
    "consume",
    async (
      { consumerTransportId, producerId, rtpCapabilities }: any,
      callback: any
    ) => {
      //TODO null handling
      let params = await roomList
        .get(socket.room_id)
        .consume(socket.id, consumerTransportId, producerId, rtpCapabilities);

      console.log(
        `---consuming--- name: ${
          roomList.get(socket.room_id) &&
          roomList.get(socket.room_id).getPeers().get(socket.id).name
        } prod_id:${producerId} consumer_id:${params.id}`
      );
      callback(params);
    }
  );

  socket.on("resume", async (data: any, callback: any) => {
    await consumer.resume();
    callback();
  });

  socket.on("getMyRoomInfo", (_: any, cb: any) => {
    cb(roomList.get(socket.room_id).toJson());
  });

  socket.on("disconnect", () => {
    console.log(
      `---disconnect--- name: ${
        roomList.get(socket.room_id) &&
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    if (!socket.room_id) return;
    const room = roomList.get(socket.room_id);
    if (!room) return;
    const userExit = room.getUserOfRoom(socket.id);
    room.removePeer(socket.id);
    room.removeUser(socket.id);
    const userOfRoom = room.getUsersOfRoom();
    console.log(userExit);
    userOfRoom.forEach((user: any) => {
      if (user._id == socket.id) return;
      socket.to(user._id).emit("delete-user", {
        users: userOfRoom,
        user: userExit,
      });
    });
  });

  socket.on("producerClosed", ({ producer_id }: any) => {
    console.log(
      `---producer close--- name: ${
        roomList.get(socket.room_id) &&
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    roomList.get(socket.room_id).closeProducer(socket.id, producer_id);
  });

  socket.on("exitRoom", async (_: any, callback: any) => {
    console.log(
      `---exit room--- name: ${
        roomList.get(socket.room_id) &&
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    if (!roomList.has(socket.room_id)) {
      callback({
        error: "not currently in a room",
      });
      return;
    }
    // close transports
    await roomList.get(socket.room_id).removePeer(socket.id);
    await roomList.get(socket.room_id).removeUser(socket.id);
    if (roomList.get(socket.room_id).getPeers().size === 0) {
      roomList.delete(socket.room_id);
    }

    socket.room_id = null;

    callback("successfully exited room");
  });
});

function room() {
  return Object.values(roomList).map((r) => {
    return {
      router: r.router.id,
      peers: Object.values(r.peers).map((p) => {
        return {
          name: p.name,
        };
      }),
      id: r.id,
    };
  });
}

/**
 * Get next mediasoup Worker.
 */
function getMediasoupWorker() {
  const worker = workers[nextMediasoupWorkerIdx];

  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;

  return worker;
}
