const redis = require("../redis/index.js");
const aaq = require("async-and-quick");

module.exports = async function onSenderDisconnect(senderId) {
  let itx = 0;
  async function t() {
    itx++;
    try {
      let channels = await redis.ft.search("VIChannels", `@senders:{${senderId}}`);
      if (channels.length === 0) return;

      await aaq.quickForEach(
        channels.documents,
        async ({ value: channel }) => {
          {
            let index = channel.users.findIndex(i => i.userId === senderId);
            if (index !== -1) channel.users.splice(index, 1);
          }
          {
            let index = channel.userIds.indexOf(senderId);
            if (index !== -1) channel.userIds.splice(index, 1);
          }
          {
            let index = channel.senders.indexOf(senderId);
            if (index !== -1) channel.senders.splice(index, 1);
          }

          if (channel.users.length === 0 || channel.senders.length === 0) {
            await redis.json.del(`VI:Channels:${channel.channelId}`, "$");
          } else {
            await redis.json.set(`VI:Channels:${channel.channelId}`, "$", channel);
            await redis.expire(`VI:Channels:${channel.channelId}`, 60 * 60 * 12);
          }
        }
      )
    } catch {
      if (itx > 100) return;
      return t();
    }
  }
  await t();
  // log("VoiceIndicators", "onSenderDisconnect", senderId);
}