const { userLastEventCache, startExecutingChannelQueue, stateExecuteQueue } = require("../methods/queue.js");
const onVoiceChange = require("../methods/onVoiceChange.js");
const onVoiceJoin = require("../methods/onVoiceJoin.js");
const onVoiceLeave = require("../methods/onVoiceLeave.js");
const onStayingUpdate = require("../methods/onStayingUpdate.js");
const rawToParsed = require("../methods/rawToParsed.js");
const SocketListener = require("../SocketListener.js");
const redis = require("../redis/index.js");

(async () => {
  for await (const key of redis.scanIterator({ MATCH: "VI:*" })) {
    await redis.del(key);
  }
})();
module.exports = new SocketListener({
  name: "voiceStateUpdate",
  async execute(socket, data) {
    if (data?.length !== 3) throw "Invalid schema.";

    let oldState = data[0] ? rawToParsed(data[0]) : null;
    let newState = data[1] ? rawToParsed(data[1]) : null;
    /** @type {"join"|"move"|"update"|"leave"} */
    let type = data[2];

    if (oldState && !oldState.channelId) return;
    if (newState && !newState.channelId) return;

    if (!oldState && !newState) return;

    let state = (newState || oldState);

    let lastEvent = userLastEventCache.get(state.userId);
    let now = Date.now();
    if (
      lastEvent
      && (now - lastEvent.at) < 100
      && lastEvent.state === `${type}:${state.state}`
    ) {
      lastEvent.at = now;
      return;
    }
    userLastEventCache.set(state.userId, { at: now, type, state: `${type}:${state.state}` });

    if (!stateExecuteQueue.has(state.channelId))
      stateExecuteQueue.set(state.channelId, []);

    stateExecuteQueue.get(state.channelId).push(async () => {
      switch (type) {
        case "join": await onVoiceJoin(newState, socket.data.id); break;
        case "move": await onVoiceChange(oldState, newState, socket.data.id); break;
        case "update": await onStayingUpdate(newState, socket.data.id); break;
        case "leave": await onVoiceLeave(oldState || newState, socket.data.id); break;
      }
    });
    startExecutingChannelQueue(state.channelId);
  }
});
