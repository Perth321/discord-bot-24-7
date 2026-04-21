const { Client, GatewayIntentBits, Partials, ChannelType, Events } = require("discord.js");
const axios = require("axios");

const TOKEN = process.env.DISCORD_TOKEN;
const API = (process.env.CONFIG_API_URL || "").replace(/\/$/, "");

if (!TOKEN) { console.error("Missing DISCORD_TOKEN"); process.exit(1); }
if (!API) { console.warn("WARN: CONFIG_API_URL not set — dashboard sync disabled"); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

let CONFIG = {
  translationEnabled: true,
  translationMode: "all",
  translationChannelIds: [],
  voiceChannelIds: [],
  notificationChannelId: null,
};

async function refreshConfig() {
  if (!API) return;
  try {
    const { data } = await axios.get(`${API}/api/config`, { timeout: 8000 });
    CONFIG = { ...CONFIG, ...data };
  } catch (e) {
    console.error("refreshConfig failed:", e.message);
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
  } catch (e) {
    console.error("syncChannels failed:", e.message);
  }
}

async function heartbeat() {
  if (!API) return;
  try {
    await axios.post(`${API}/api/bot/heartbeat`, {
      tag: client.user?.tag ?? null,
      uptime: client.uptime ?? 0,
    }, { timeout: 8000 });
  } catch (e) {
    console.error("heartbeat failed:", e.message);
  }
}

// Free Google translate endpoint (no key needed)
async function translate(text, source, target) {
  const url = "https://translate.googleapis.com/translate_a/single";
  const { data } = await axios.get(url, {
    params: { client: "gtx", sl: source, tl: target, dt: "t", q: text },
    timeout: 10000,
  });
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  return data[0].map((seg) => seg[0]).join("");
}

// Detect Vietnamese: contains Vietnamese-specific diacritics
const VIETNAMESE_RE = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;
const THAI_RE = /[\u0E00-\u0E7F]/;

function shouldTranslateChannel(channelId) {
  if (CONFIG.translationMode === "selected") {
    return Array.isArray(CONFIG.translationChannelIds) && CONFIG.translationChannelIds.includes(channelId);
  }
  return true;
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  await refreshConfig();
  await syncChannels();
  await heartbeat();
  setInterval(refreshConfig, 60_000);
  setInterval(syncChannels, 5 * 60_000);
  setInterval(heartbeat, 30_000);
});

client.on(Events.GuildCreate, () => syncChannels());
client.on(Events.ChannelCreate, () => syncChannels());
client.on(Events.ChannelDelete, () => syncChannels());
client.on(Events.ChannelUpdate, () => syncChannels());

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  const content = msg.content?.trim();
  if (!content) return;

  // !th command: TH -> VI
  if (content.toLowerCase().startsWith("!th")) {
    if (!CONFIG.translationEnabled) return;
    const text = content.slice(3).trim();
    if (!text) {
      await msg.reply("ใช้: `!th <ข้อความภาษาไทย>` เพื่อแปลเป็นภาษาเวียดนาม").catch(() => {});
      return;
    }
    try {
      const out = await translate(text, "th", "vi");
      if (out) await msg.reply(`🇻🇳 ${out}`);
    } catch (e) {
      console.error("!th translate error:", e.message);
      await msg.reply("แปลไม่สำเร็จ ลองใหม่อีกครั้ง").catch(() => {});
    }
    return;
  }

  if (!CONFIG.translationEnabled) return;
  if (!shouldTranslateChannel(msg.channel.id)) return;

  // Auto: VI -> TH
  if (VIETNAMESE_RE.test(content) && !THAI_RE.test(content)) {
    try {
      const out = await translate(content, "vi", "th");
      if (out && out.trim() && out.trim().toLowerCase() !== content.trim().toLowerCase()) {
        await msg.reply(`🇹🇭 ${out}`);
      }
    } catch (e) {
      console.error("auto vi->th error:", e.message);
    }
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const notifId = CONFIG.notificationChannelId;
    if (!notifId) return;
    const watchList = Array.isArray(CONFIG.voiceChannelIds) ? CONFIG.voiceChannelIds : [];
    const allChannels = watchList.length === 0;

    const member = newState.member || oldState.member;
    const userTag = member?.displayName || member?.user?.username || "Someone";

    let event = null;
    let channel = null;
    if (!oldState.channelId && newState.channelId) {
      event = "join";
      channel = newState.channel;
    } else if (oldState.channelId && !newState.channelId) {
      event = "leave";
      channel = oldState.channel;
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      event = "move";
      channel = newState.channel;
    }
    if (!event || !channel) return;
    if (!allChannels && !watchList.includes(channel.id)) {
      // Also check old channel for leave/move
      if (event === "leave" || event === "move") {
        if (!watchList.includes(oldState.channelId)) return;
      } else return;
    }

    const guild = newState.guild || oldState.guild;
    const target = await guild.channels.fetch(notifId).catch(() => null);
    if (!target || !target.isTextBased()) return;

    let text;
    if (event === "join") text = `🟢 **${userTag}** เข้าห้อง 🔊 **${channel.name}**`;
    else if (event === "leave") text = `🔴 **${userTag}** ออกจากห้อง 🔊 **${channel.name}**`;
    else text = `🔄 **${userTag}** ย้ายจาก 🔊 **${oldState.channel?.name ?? "?"}** → 🔊 **${newState.channel?.name ?? "?"}**`;

    await target.send(text).catch(() => {});
  } catch (e) {
    console.error("voiceStateUpdate error:", e.message);
  }
});

client.on("error", (e) => console.error("client error:", e.message));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e?.message || e));

client.login(TOKEN);
