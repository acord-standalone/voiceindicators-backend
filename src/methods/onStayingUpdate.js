const redis = require("../redis/index.js");
const deleteUserGuildStates = require("./deleteUserGuildStates.js");
const onVoiceJoin = require("./onVoiceJoin.js");

/**
 * @param {import("./rawToParsed.js").VoiceStateParsed} data
 */
module.exports = async function onStayingUpdate(data, senderId) {
  await deleteUserGuildStates(data.guildId, data.userId);
  let channel = await redis.json.get(`VI:Channels:${data.channelId}`, "$");
  if (!channel) {
    await onVoiceJoin(data, senderId);
    channel = await redis.json.get(`VI:Channels:${data.channelId}`, "$");
  }
  if (!channel) return;

  {
    let index = channel.users.findIndex(i => i.userId === data.userId);
    let o = {
      userId: data.userId,
      userTag: data.userTag,
      userAvatar: data.userAvatar,
      state: data.state,
      at: Date.now()
    };
    if (index === -1) {
      channel.users.push(o);
    } else {
      channel.users[index] = o;
    }
  }
  if (!channel.senders.includes(senderId)) channel.senders.push(senderId);
  if (!channel.userIds.includes(data.userId)) channel.userIds.push(data.userId);

  await redis.json.set(`VI:Channels:${data.channelId}`, "$", channel);
  await redis.expire(`VI:Channels:${data.channelId}`, 60 * 60 * 12);

  // log("VoiceIndicators", "onStayingUpdate", data.userId, data.channelId);
};