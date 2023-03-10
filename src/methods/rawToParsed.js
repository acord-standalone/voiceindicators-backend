/**
 * @typedef {["guildDeaf"|"deaf"|"guildMute"|"mute"|"video"|"stream"|"normal", string, string, string?, string?, string?, string?, string?, string?, string?, string?, string?]} VoiceStateRawArray
 * @typedef {string} VoiceStateRawString
 * @typedef {{state: string, userId: string, userTag: string, userAvatar?: string, channelId?: string, channelName?: string, channelIcon?: string, channelRedacted?: string, guildId?: string, guildName?: string, guildVanity?: string, guildIcon?: string, raw: VoiceStateRawArray }} VoiceStateParsed
 */

/**
 * @param {VoiceStateRawArray} raw 
 * @returns 
 */
function rawToParsed(raw) {
  if (typeof raw == "string") raw = raw.split(";");
  return {
    state: raw[0],
    userId: raw[1],
    userTag: raw[2],
    userAvatar: raw[3],
    channelId: raw[4],
    channelName: raw[5],
    channelIcon: raw[6],
    channelRedacted: raw[7] == "true",
    guildId: raw[8],
    guildName: raw[9],
    guildVanity: raw[10],
    guildIcon: raw[11],
    raw
  }
}



module.exports = rawToParsed;