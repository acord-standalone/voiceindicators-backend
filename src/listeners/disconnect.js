const onSenderDisconnect = require("../methods/onSenderDisconnect.js");
const SocketListener = require("../SocketListener.js");

module.exports = new SocketListener({
  name: "disconnect",
  async execute(socket) {
    let senderId = socket.data.id;
    if (!senderId) return;

    onSenderDisconnect(senderId);
  }
})