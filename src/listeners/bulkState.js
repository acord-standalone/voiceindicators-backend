const SocketListener = require("../SocketListener.js");
const aaq = require("async-and-quick");
const getUserChannels = require("../methods/getUserChannels.js");


module.exports = new SocketListener({
  name: "bulkState",
  async execute(socket, data, other) {
    if (!Array.isArray(data)) throw "Invalid shape!";
    data = [...new Set(data)];

    return await aaq.quickMap(data, async (id) => {
      let channels = await getUserChannels(id, Object.assign(other, { socket }));
      return [
        id,
        channels
      ];
    }, 100);
  }
})