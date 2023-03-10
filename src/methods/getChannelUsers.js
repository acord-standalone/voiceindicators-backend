const redis = require("../redis/index.js");

module.exports = async function getChannelUsers(channelId) {
  let channel = await redis.json.get(`VI:Channels:${channelId}`);
  if (!channel) return [];
  return Object.values(channel.users).map(i => ([i.userId, i.userTag, i.userAvatar, i.state]));
}