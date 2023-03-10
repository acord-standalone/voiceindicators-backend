const Lru = require("lru-cache");

const stateExecuteQueue = new Lru({
  max: 1024 * 8
});

const userLastEventCache = new Lru({
  max: 1024 * 8
});

setInterval(() => {
  const now = Date.now();
  for (let [userId, lastEvent] of userLastEventCache.entries()) {
    if ((now - lastEvent.at) > 30000) {
      userLastEventCache.delete(userId);
    }
  }
}, 30000);

const executingChannels = new Set();

async function startExecutingChannelQueue(channelId) {
  if (executingChannels.has(channelId)) return;
  executingChannels.add(channelId);

  while (true) {
    let cached = stateExecuteQueue.get(channelId).shift();
    if (!cached) {
      stateExecuteQueue.delete(channelId);
      break;
    }
    await cached();
  }

  executingChannels.delete(channelId);
}

module.exports = {
  userLastEventCache,
  startExecutingChannelQueue,
  stateExecuteQueue
}