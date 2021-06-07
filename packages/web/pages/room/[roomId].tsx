import React, { useState } from "react";
import { RoomClient } from "../../src/services/RoomClient";
import io from "../../src/services/socketio";
import { v4 as uuid } from "uuid";
import { Device } from "mediasoup-client";
import Control from "./../../src/components/control";
import { useEffect } from "react";
import { useRouter } from "next/router";

interface RoomProps {}

const socket = io("http://localhost:3016/", {
  transports: ["websocket", "polling"],
});

const Room: React.FC<RoomProps> = (props) => {
  const router = useRouter();
  const [rc, setRc] = useState<RoomClient>();
  const [login, setLogin] = useState<boolean>(false);

  const loginSuccess = () => {
    setLogin(true);
  };

  const joinRoom = async (name: string, room_id: string) => {
    if (rc && rc.isOpen()) {
      console.log("already connected to a room");
    } else {
      const newRc = new RoomClient(
        null,
        null,
        null,
        Device,
        socket,
        room_id,
        name,
        loginSuccess
      );
      console.log(newRc);

      setRc(newRc);
    }
  };

  useEffect(() => {
    console.log("rooouter", router.query);
    joinRoom(uuid(), "1");
  }, []);

  return login ? <Control rc={rc} /> : <div>loading...</div>;
};

export default Room;
