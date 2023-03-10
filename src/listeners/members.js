const getChannelUsers = require("../methods/getChannelUsers.js");
const SocketListener = require("../SocketListener.js");

module.exports = new SocketListener({
  name: "members",
  async execute(socket, data) {
    if (typeof data.id != "string") return;

    return await getChannelUsers(data.id);
  }
})