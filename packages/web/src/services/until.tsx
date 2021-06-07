import { Socket } from "socket.io-client"
import { RoomClient } from "./RoomClient"

const addListeners = (rc: Socket) => {
    rc.on(RoomClient.EVENTS.startScreen, () => {
    })

    rc.on(RoomClient.EVENTS.stopScreen, () => {
    })

    rc.on(RoomClient.EVENTS.stopAudio, () => {
    })
    rc.on(RoomClient.EVENTS.startAudio, () => {
    })

    rc.on(RoomClient.EVENTS.startVideo, () => {
    })
    rc.on(RoomClient.EVENTS.stopVideo, () => {
    })
    rc.on(RoomClient.EVENTS.exitRoom, () => {
    })
}
export {
    addListeners
}