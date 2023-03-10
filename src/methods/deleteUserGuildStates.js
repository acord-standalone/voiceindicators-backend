const aaq = require("async-and-quick");
const redis = require("../redis/index.js");

module.exports = async function deleteUserGuildStates(guildId, userId) {
  let idx = 0;
  async function t() {
    idx++;
    try {
      let channels = await redis.ft.search("VIChannels", `@guildId:{${guildId || "DM"}}`);
      await aaq.quickForEach(channels.documents, async ({ value: channel }) => {
        {
          let index = channel.users.findIndex(i => i.userId === userId);
          if (index !== -1) channel.users.splice(index, 1);
        }
        {
          let index = channel.userIds.indexOf(userId);
          if (index !== -1) channel.userIds.splice(index, 1);
        }
        await redis.json.set(`VI:Channels:${channel.channelId}`, "$", channel);
      });
    } catch {
      if (idx > 1000) return;
      return t();
    }
  }
  await t();
}