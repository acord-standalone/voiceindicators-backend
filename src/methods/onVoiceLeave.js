const redis = require("../redis/index.js");
const deleteUserGuildStates = require("./deleteUserGuildStates.js");

/**
 * @param {import("./rawToParsed.js").VoiceStateParsed} data
 */
module.exports = async function onVoiceLeave(data, senderId) {
  let channel = await redis.json.get(`VI:Channels:${data.channelId}`, "$");
  if (!channel) return;

  await deleteUserGuildStates(data.guildId, data.userId);

  {
    let index = channel.users.findIndex(i => i.userId === data.userId);
    if (index !== -1) channel.users.splice(index, 1);
  }

  {
    let index = channel.userIds.indexOf(data.userId);
    if (index !== -1) channel.userIds.splice(index, 1);
  }

  if (channel.users.length === 0) {
    await redis.json.del(`VI:Channels:${data.channelId}`, "$");
  } else {
    await redis.json.set(`VI:Channels:${data.channelId}`, "$", channel);
    await redis.expire(`VI:Channels:${data.channelId}`, 60 * 60 * 12);
  }

  // log("VoiceIndicators", "onVoiceLeave", data.userId, data.channelId);
};
