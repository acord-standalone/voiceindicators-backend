const onVoiceJoin = require("./onVoiceJoin.js");
const onVoiceLeave = require("./onVoiceLeave.js");

/**
 * @param {Object} userData
 */
module.exports = async function onVoiceChange(oldData, newData, senderId) {
  if (oldData) await onVoiceLeave(oldData, senderId);
  if (newData) await onVoiceJoin(newData, senderId);
};
