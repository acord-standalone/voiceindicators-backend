const redis = require("../redis/index.js");
const aaq = require("async-and-quick");
const onVoiceLeave = require("./onVoiceLeave.js");
const rawToParsed = require("./rawToParsed.js");

/**
 * 
 * @param {string} userId 
 * @param {{socketIp: string, getUserSocket(id: string): import("socket.io").Socket, awaitResponse(eventName: string, data: any, timeout?: number): Promise<any>, io: import("socket.io").Server, socket: import("socket.io").Socket }} arg1
 * @returns 
 */
module.exports = async function getUserChannels(userId, { getUserSocket, io }) {
  let itx = 0;
  async function t() {
    itx++;
    try {
      let channels = await redis.ft.search("VIChannels", `@userIds:{${userId}}`);
      if (channels.documents.length === 0) return [];

      let guildIdsSeen = [];
      let latestGuildChannels = [...channels.documents]
        .filter((i) => {
          if (i.value.guildId && !guildIdsSeen.includes(i.value.guildId)) {
            guildIdsSeen.push(i.value.guildId);
            return true;
          }
        }).sort(
          (a, b) => b.value.users.find(i => i.userId === userId).at
            - a.value.users.find(i => i.userId === userId).at
        ).map(v => v.value);
      guildIdsSeen = null;
      let latestDMChannels = [...channels.documents]
        .filter(
          i => !i.value.guildId
        ).sort(
          (a, b) => b.value.users.find(i => i.userId === userId).at
            - a.value.users.find(i => i.userId === userId).at
        ).map(v => v.value);
      let importantChannels = [...latestGuildChannels, ...latestDMChannels].filter(i => i);
      let importantChannelIds = importantChannels.map(i => i.channelId).filter(i => i);
      await aaq.quickForEach(channels.documents, async ({ value: channel }) => {
        if (!importantChannelIds.includes(channel.channelId)) {
          await onVoiceLeave({
            userId,
            channelId: channel.channelId,
            guildId: channel.guildId,
          });
        }
      });
      await aaq.quickForEach(importantChannels, async (channel) => {
        if (!((Date.now() - channel._lastValidatedAt) > (1000 * 60 * 60))) return;
        channel._lastValidatedAt = Date.now();
        await redis.json.set(`VI:Channels:${channel.channelId}`, "$", channel);
        if (!channel.guildId) {
          let results = [];
          await aaq.quickForEach(
            channel._usersJoinedBefore.length ? channel._usersJoinedBefore : channel.userIds,
            async (oldUserId) => {
              let oldUserSocket = getUserSocket(oldUserId);
              if (!oldUserSocket) return;
              let res = await oldUserSocket.data.awaitResponse("channelStates", { id: channel.channelId }, 5000);
              if (!res.ok) return;
              results.push({ states: (res?.data || res).map(rawToParsed), userId: oldUserId });
            }
          );
          if (!results.length) {
            await redis.json.del(`VI:Channels:${channel.channelId}`, "$");
          }
        } else {
          let results = [];
          await aaq.quickForEach(
            [...io.sockets.sockets.values()],
            async (userSocket) => {
              if (!userSocket.data.id) return;
              let res = await userSocket.data.awaitResponse("channelStates", { id: channel.channelId }, 5000);
              if (!res.ok) return;
              results.push({ states: (res?.data || res).map(rawToParsed), userId: userSocket.data.id });
            },
            100
          );
          if (!results.length) {
            await redis.json.del(`VI:Channels:${channel.channelId}`, "$");
          } else {
            let bestResult = results.filter(i => i.states.length).sort((a, b) => a.states.length - b.states.length)?.[0];
            if (!bestResult) {
              await redis.json.del(`VI:Channels:${channel.channelId}`, "$");
              return;
            }
            channel.userIds = bestResult.states.map(i => i.userId);
            channel.users = bestResult.states.map(i => ({
              userId: i.userId,
              userTag: i.userTag,
              userAvatar: i.userAvatar,
              state: i.state,
              at: Date.now()
            }));
            if (!channel.senders.includes(bestResult.userId)) channel.senders.push(bestResult.userId);
            await redis.json.set(`VI:Channels:${channel.channelId}`, "$", channel);
            redis.expire(`VI:Channels:${channel.channelId}`, 60 * 60 * 12);
          }
        }
      });

      return importantChannels.filter(i => i).map(i => ([
        i.channelId,
        i.channelName,
        i.channelIcon,
        i.guildId,
        i.guildName,
        i.guildIcon,
        i.guildVanity,
        i.users.find(i => i.userId === userId)?.state || "normal",
      ]));
    } catch (e) {
      log(`${e}\n${e.stack} ${itx}`);
      if (itx > 100) return [];
      return t();
    }
  }
  return await t();
}