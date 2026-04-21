const { Client, GatewayIntentBits, Partials, ChannelType, Events } = require("discord.js");
const axios = require("axios");

const TOKEN = process.env.DISCORD_TOKEN;
const API = (process.env.CONFIG_API_URL || "").replace(/\/$/, "");

if (!TOKEN) { console.error("Missing DISCORD_TOKEN"); process.exit(1); }
if (!API) console.warn("WARN: CONFIG_API_URL not set — dashboard sync disabled");

const FULL_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,
];
const SAFE_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];

let client = new Client({ intents: FULL_INTENTS, partials: [Partials.Channel] });
let MESSAGE_CONTENT_OK = true;

function parseList(v) {
  if (!v) return [];
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

const ENV_NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID || null;
const ENV_VOICE_CHANNEL_IDS = parseList(process.env.VOICE_CHANNEL_IDS);
const ENV_TRANSLATION_CHANNEL_IDS = parseList(process.env.TRANSLATION_CHANNEL_IDS);
const ENV_TRANSLATION_MODE = process.env.TRANSLATION_MODE || (ENV_TRANSLATION_CHANNEL_IDS.length ? "selected" : "all");

let CONFIG = {
  translationEnabled: true,
  translationMode: ENV_TRANSLATION_MODE,
  translationChannelIds: ENV_TRANSLATION_CHANNEL_IDS,
  voiceChannelIds: ENV_VOICE_CHANNEL_IDS,
  notificationChannelId: ENV_NOTIFICATION_CHANNEL_ID,
};

function applyEnvOverrides() {
  if (ENV_NOTIFICATION_CHANNEL_ID) CONFIG.notificationChannelId = ENV_NOTIFICATION_CHANNEL_ID;
  if (ENV_VOICE_CHANNEL_IDS.length) CONFIG.voiceChannelIds = ENV_VOICE_CHANNEL_IDS;
  if (ENV_TRANSLATION_CHANNEL_IDS.length) {
    CONFIG.translationChannelIds = ENV_TRANSLATION_CHANNEL_IDS;
    CONFIG.translationMode = "selected";
  }
}

async function refreshConfig() {
  if (!API) { applyEnvOverrides(); return; }
  try {
    const { data } = await axios.get(`${API}/api/config`, { timeout: 8000 });
    CONFIG = { ...CONFIG, ...data };
    applyEnvOverrides();
  } catch (e) {
    console.error("refreshConfig:", e.message);
    applyEnvOverrides();
  }
}

async function syncChannels() {
  if (!API) return;
  try {
    const channels = [];
    for (const [, guild] of client.guilds.cache) {
      for (const [, ch] of guild.channels.cache) {
        let type = null;
        if (ch.type === ChannelType.GuildText) type = "text";
        else if (ch.type === ChannelType.GuildVoice) type = "voice";
        if (!type) continue;
        channels.push({ id: ch.id, guildId: guild.id, guildName: guild.name, name: ch.name, type });
      }
    }
    await axios.post(`${API}/api/channels/sync`, { channels }, { timeout: 15000 });
    console.log(`synced ${channels.length} channels`);
  } catch (e) { console.error("syncChannels:", e.message); }
}

async function heartbeat() {
  if (!API) return;
  try {
    await axios.post(`${API}/api/bot/heartbeat`, {
      tag: client.user?.tag ?? null,
      uptime: client.uptime ?? 0,
    }, { timeout: 8000 });
  } catch (e) { /* heartbeat endpoint optional */ }
}

async function translate(text, source, target) {
  const { data } = await axios.get("https://translate.googleapis.com/translate_a/single", {
    params: { client: "gtx", sl: source, tl: target, dt: "t", q: text },
    timeout: 10000,
  });
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  return data[0].map((s) => s[0]).join("");
}

const VIETNAMESE_RE = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;
const THAI_RE = /[\u0E00-\u0E7F]/;

function shouldTranslateChannel(id) {
  if (CONFIG.translationMode === "selected") {
    return Array.isArray(CONFIG.translationChannelIds) && CONFIG.translationChannelIds.includes(id);
  }
  return true;
}

async function onMessage(msg) {
  if (msg.author.bot || !msg.guild) return;
  const content = msg.content?.trim();
  if (!content) {
    if (!MESSAGE_CONTENT_OK) {
      console.warn("got message but content is empty (MessageContent intent likely disabled)");
    }
    return;
  }

  if (content.toLowerCase().startsWith("!th")) {
    if (!CONFIG.translationEnabled) return;
    const text = content.slice(3).trim();
    if (!text) { await msg.reply("ใช้: `!th <ข้อความภาษาไทย>` เพื่อแปลเป็นภาษาเวียดนาม").catch(() => {}); return; }
    try {
      const out = await translate(text, "th", "vi");
      if (out) await msg.reply(`🇻🇳 ${out}`);
    } catch (e) { console.error("!th:", e.message); }
    return;
  }

  if (content.toLowerCase().startsWith("!vi")) {
    if (!CONFIG.translationEnabled) return;
    const text = content.slice(3).trim();
    if (!text) { await msg.reply("ใช้: `!vi <ข้อความภาษาเวียดนาม>` เพื่อแปลเป็นภาษาไทย").catch(() => {}); return; }
    try {
      const out = await translate(text, "vi", "th");
      if (out) await msg.reply(`🇹🇭 ${out}`);
    } catch (e) { console.error("!vi:", e.message); }
    return;
  }

  if (content.toLowerCase() === "!ping") {
    await msg.reply(`pong! translationEnabled=${CONFIG.translationEnabled} mode=${CONFIG.translationMode} notif=${CONFIG.notificationChannelId || "(none)"}`).catch(() => {});
    return;
  }

  if (!CONFIG.translationEnabled) return;
  if (!shouldTranslateChannel(msg.channel.id)) return;

  if (VIETNAMESE_RE.test(content) && !THAI_RE.test(content)) {
    try {
      const out = await translate(content, "vi", "th");
      if (out && out.trim() && out.trim().toLowerCase() !== content.trim().toLowerCase()) {
        await msg.reply(`🇹🇭 ${out}`);
      }
    } catch (e) { console.error("auto vi->th:", e.message); }
    return;
  }

  if (THAI_RE.test(content) && !VIETNAMESE_RE.test(content)) {
    try {
      const out = await translate(content, "th", "vi");
      if (out && out.trim() && out.trim().toLowerCase() !== content.trim().toLowerCase()) {
        await msg.reply(`🇻🇳 ${out}`);
      }
    } catch (e) { console.error("auto th->vi:", e.message); }
  }
}

async function onVoice(oldState, newState) {
  try {
    const notifId = CONFIG.notificationChannelId;
    if (!notifId) {
      console.warn("voice event ignored: notificationChannelId is not set (set NOTIFICATION_CHANNEL_ID secret or configure dashboard)");
      return;
    }
    const watchList = Array.isArray(CONFIG.voiceChannelIds) ? CONFIG.voiceChannelIds : [];
    const allChannels = watchList.length === 0;

    const member = newState.member || oldState.member;
    const userTag = member?.displayName || member?.user?.username || "Someone";

    let event = null, channel = null;
    if (!oldState.channelId && newState.channelId) { event = "join"; channel = newState.channel; }
    else if (oldState.channelId && !newState.channelId) { event = "leave"; channel = oldState.channel; }
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) { event = "move"; channel = newState.channel; }
    if (!event || !channel) return;

    if (!allChannels) {
      const inWatch = watchList.includes(channel.id) || (oldState.channelId && watchList.includes(oldState.channelId));
      if (!inWatch) return;
    }

    const guild = newState.guild || oldState.guild;
    const target = await guild.channels.fetch(notifId).catch((e) => {
      console.error("fetch notif channel failed:", e.message);
      return null;
    });
    if (!target) {
      console.error(`notification channel ${notifId} not found in guild ${guild?.id}`);
      return;
    }
    if (!target.isTextBased()) {
      console.error(`notification channel ${notifId} is not text-based`);
      return;
    }

    let text;
    if (event === "join") text = `🟢 **${userTag}** เข้าห้อง 🔊 **${channel.name}**`;
    else if (event === "leave") text = `🔴 **${userTag}** ออกจากห้อง 🔊 **${channel.name}**`;
    else text = `🔄 **${userTag}** ย้ายจาก 🔊 **${oldState.channel?.name ?? "?"}** → 🔊 **${newState.channel?.name ?? "?"}**`;
    await target.send(text).catch((e) => console.error("send notif failed:", e.message));
  } catch (e) { console.error("voice:", e.message); }
}

function attachHandlers(c) {
  c.once(Events.ClientReady, async (ready) => {
    console.log(`Logged in as ${ready.user.tag} (messageContent=${MESSAGE_CONTENT_OK})`);
    console.log(`guilds: ${c.guilds.cache.size}`);
    await refreshConfig();
    console.log("CONFIG:", JSON.stringify({
      translationEnabled: CONFIG.translationEnabled,
      translationMode: CONFIG.translationMode,
      translationChannels: CONFIG.translationChannelIds?.length || 0,
      notificationChannelId: CONFIG.notificationChannelId,
      voiceChannels: CONFIG.voiceChannelIds?.length || 0,
    }));
    if (!CONFIG.notificationChannelId) {
      console.warn("⚠️  notificationChannelId is empty — voice notifications will NOT be sent. Set the NOTIFICATION_CHANNEL_ID GitHub secret to a Discord text channel ID.");
    }
    if (!MESSAGE_CONTENT_OK) {
      console.warn("⚠️  Translation will NOT work — enable 'MESSAGE CONTENT INTENT' at https://discord.com/developers/applications");
    }
    await syncChannels();
    await heartbeat();
    setInterval(refreshConfig, 60_000);
    setInterval(syncChannels, 5 * 60_000);
    setInterval(heartbeat, 30_000);
  });
  c.on(Events.GuildCreate, () => syncChannels());
  c.on(Events.ChannelCreate, () => syncChannels());
  c.on(Events.ChannelDelete, () => syncChannels());
  c.on(Events.ChannelUpdate, () => syncChannels());
  c.on(Events.MessageCreate, onMessage);
  c.on(Events.VoiceStateUpdate, onVoice);
  c.on("error", (e) => console.error("client error:", e.message));
  c.on("warn", (m) => console.warn("client warn:", m));
}

async function start() {
  attachHandlers(client);
  try {
    await client.login(TOKEN);
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("disallowed intents")) {
      console.warn("⚠️  MessageContent intent disabled in Discord Developer Portal — running voice-only mode. Translation will not work until you enable 'MESSAGE CONTENT INTENT' at https://discord.com/developers/applications");
      MESSAGE_CONTENT_OK = false;
      try { client.destroy(); } catch {}
      client = new Client({ intents: SAFE_INTENTS, partials: [Partials.Channel] });
      attachHandlers(client);
      await client.login(TOKEN);
    } else { throw e; }
  }
}

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e?.message || e));
start().catch((e) => { console.error("fatal:", e?.message || e); process.exit(1); });
