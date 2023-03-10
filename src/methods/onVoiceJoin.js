const redis = require("../redis/index.js");
const deleteUserGuildStates = require("./deleteUserGuildStates.js");

// FT.CREATE VIChannels ON JSON PREFIX 1 VI:Channels: SCHEMA $.userIds.* AS userIds TAG $.senders.* AS senders TAG $._guildId AS guildId TAG

/**
 * @param {import("./rawToParsed.js").VoiceStateParsed} data
 */
module.exports = async function onVoiceJoin(data, senderId) {

  await deleteUserGuildStates(data.guildId, data.userId);

  let channel = await redis.json.get(`VI:Channels:${data.channelId}`, "$");
  if (!channel) {
    channel = {
      users: [],
      userIds: [],
      senders: [],
      _usersJoinedBefore: [],
      _lastValidatedAt: 0
    };
  }
  channel = {
    ...channel,
    channelId: data.channelId,
    channelName: data.channelName,
    channelIcon: data.channelIcon,
    guildId: data.guildId,
    _guildId: data.guildId || "DM",
    guildName: data.guildName,
    guildIcon: data.guildIcon,
    guildVanity: data.guildVanity
  }
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

  // for dm channels
  if (!data.guildId && !channel._usersJoinedBefore.includes(data.userId))
    channel._usersJoinedBefore.push(data.userId);

  await redis.json.set(`VI:Channels:${data.channelId}`, "$", channel);
  await redis.expire(`VI:Channels:${data.channelId}`, 60 * 60 * 12);

  // log("VoiceIndicators", "onVoiceJoin", data.userId, data.channelId);
};