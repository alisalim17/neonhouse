import { config } from "./config";

export class Room {
  room_id: any;
  id: any;
  router: any;
  peers: any;
  users: any;
  worker: any;
  io: any;
  user_master: any;

  constructor(room_id: any, worker: any, io: any, user_master: any) {
    this.id = room_id;
    const mediaCodecs = config.mediasoup.router.mediaCodecs;

    this.worker = worker;
    this.worker
      .createRouter({
        mediaCodecs,
      })
      .then((router: any) => {
        this.router = router;
      });

    this.peers = new Map();
    this.io = io;
    this.users = new Map();
    this.user_master = user_master;
  }

  addPeer(peer: any) {
    this.peers.set(peer.id, peer);
  }

  async addUser(user: any) {
    this.users.set(user._id, user);
  }

  getUserOfRoom(id: any) {
    console.log(this.users);
    return this.users.get(id);
  }

  getUsersOfRoom() {
    let userList: any[] = [];
    this.users.forEach((user: any) => {
      userList.push(user);
    });
    return userList;
  }

  getProducerListForPeer(socket_id: any) {
    let producerList: any[] = [];
    this.peers.forEach((peer: any) => {
      peer.producers.forEach((producer: any) => {
        producerList.push({
          producer_id: producer.id,
        });
      });
    });
    return producerList;
  }

  getRtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  async createWebRtcTransport(socket_id: any) {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } =
      config.mediasoup.webRtcTransport;

    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    });
    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (error) {}
    }

    transport.on(
      "dtlsstatechange",
      function (dtlsState: any) {
        if (dtlsState === "closed") {
          console.log(
            "---transport close--- " +
              this.peers.get(socket_id).name +
              " closed"
          );
          transport.close();
        }
      }.bind(this)
    );

    transport.on("close", () => {
      console.log(
        "---transport close--- " + this.peers.get(socket_id).name + " closed"
      );
    });
    console.log("---adding transport---", transport.id);
    this.peers.get(socket_id).addTransport(transport);
    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async connectPeerTransport(
    socket_id: any,
    transport_id: any,
    dtlsParameters: any
  ) {
    if (!this.peers.has(socket_id)) return;
    await this.peers
      .get(socket_id)
      .connectTransport(transport_id, dtlsParameters);
  }

  async produce(
    socket_id: any,
    producerTransportId: any,
    rtpParameters: any,
    kind: any
  ) {
    // handle undefined errors
    return new Promise(
      async function (resolve: any, reject: any) {
        let producer = await this.peers
          .get(socket_id)
          .createProducer(producerTransportId, rtpParameters, kind);
        resolve(producer.id);
        this.broadCast(socket_id, "newProducers", [
          {
            producer_id: producer.id,
            producer_socket_id: socket_id,
          },
        ]);
      }.bind(this)
    );
  }

  async consume(
    socket_id: any,
    consumer_transport_id: any,
    producer_id: any,
    rtpCapabilities: any
  ) {
    // handle nulls
    if (
      !this.router.canConsume({
        producerId: producer_id,
        rtpCapabilities,
      })
    ) {
      console.error("can not consume");
      return;
    }

    let { consumer, params } = await this.peers
      .get(socket_id)
      .createConsumer(consumer_transport_id, producer_id, rtpCapabilities);

    consumer.on(
      "producerclose",
      function () {
        console.log(
          `---consumer closed--- due to producerclose event  name:${
            this.peers.get(socket_id).name
          } consumer_id: ${consumer.id}`
        );
        this.peers.get(socket_id).removeConsumer(consumer.id);
        // tell client consumer is dead
        this.io.to(socket_id).emit("consumerClosed", {
          consumer_id: consumer.id,
        });
      }.bind(this)
    );

    return params;
  }

  async removePeer(socket_id: any) {
    this.peers.get(socket_id).close();
    this.peers.delete(socket_id);
  }

  async removeUser(id: any) {
    this.users.delete(id);
  }

  closeProducer(socket_id: any, producer_id: any) {
    this.peers.get(socket_id).closeProducer(producer_id);
  }

  broadCast(socket_id, name, data) {
    for (let otherID of Array.from(this.peers.keys()).filter(
      (id) => id !== socket_id
    )) {
      this.send(otherID, name, data);
    }
  }

  send(socket_id: any, name: any, data: any) {
    this.io.to(socket_id).emit(name, data);
  }

  getPeers() {
    return this.peers;
  }

  toJson() {
    return {
      id: this.id,
      peers: JSON.stringify([...this.peers]),
    };
  }
}
