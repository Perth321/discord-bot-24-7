const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CONFIG_API_URL = (process.env.CONFIG_API_URL || "").replace(/\/$/, "");

if (!DISCORD_TOKEN) {
  console.error("[Bot] ERROR: DISCORD_TOKEN is not set");
  process.exit(1);
}

// ---- Config cache ----
let cachedConfig = {
  translationEnabled: true,
  voiceChannelIds: [],
  notificationChannelId: null,
};

async function fetchConfig() {
  if (!CONFIG_API_URL) return;
  try {
    const res = await axios.get(`${CONFIG_API_URL}/api/config`, {
      timeout: 8000,
    });
    cachedConfig = res.data;
    console.log("[Config] Loaded:", JSON.stringify(cachedConfig));
  } catch (err) {
    console.warn("[Config] Failed to fetch, using cached:", err.message);
  }
}

// Refresh config every 5 minutes
setInterval(fetchConfig, 5 * 60 * 1000);

// ---- Heartbeat — reports bot status to Replit dashboard API ----
async function sendHeartbeat(client) {
  if (!CONFIG_API_URL) return;
  try {
    await axios.post(
      `${CONFIG_API_URL}/api/bot/heartbeat`,
      {
        tag: client?.user?.tag || null,
        uptime: client?.uptime || null,
      },
      { timeout: 8000 }
    );
  } catch (err) {
    console.warn("[Heartbeat] Failed:", err.message);
  }
}

// ---- Translation (Google Translate unofficial — unlimited, no key) ----
async function translate(text, from, to) {
  try {
    const url = "https://translate.googleapis.com/translate_a/single";
    const res = await axios.get(url, {
      params: {
        client: "gtx",
        sl: from,
        tl: to,
        dt: "t",
        q: text,
      },
      timeout: 10000,
    });
    const data = res.data;
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map((part) => part[0]).join("") || null;
    }
    return null;
  } catch (err) {
    console.warn("[Translate] Error:", err.message);
    // Fallback to MyMemory
    try {
      const fb = await axios.get("https://api.mymemory.translated.net/get", {
        params: { q: text, langpair: `${from}|${to}` },
        timeout: 8000,
      });
      if (fb.data?.responseStatus === 200) {
        return fb.data.responseData.translatedText || null;
      }
    } catch (_) {}
    return null;
  }
}

// ---- Vietnamese detection ----
function isVietnamese(text) {
  return /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(
    text
  );
}

// ---- Discord client ----
const allIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,
];

const voiceOnlyIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
];

let messageContentEnabled = false;

function createClient(intents) {
  const client = new Client({ intents });

  client.once("clientReady", async () => {
    console.log(`[Bot] Online as ${client.user.tag}`);
    console.log(`[Bot] Message content: ${messageContentEnabled}`);
    if (!messageContentEnabled) {
      console.warn(
        "[Bot] Translation disabled — enable Message Content Intent at: " +
          "https://discord.com/developers/applications → Bot → Privileged Gateway Intents"
      );
    }
    await fetchConfig();
    await sendHeartbeat(client);
    // Send heartbeat every 60 seconds
    setInterval(() => sendHeartbeat(client), 60 * 1000);
  });

  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;
      if (!messageContentEnabled) return;

      const content = message.content.trim();

      // !th <text> — แปลไทย→เวียดนาม
      if (content.toLowerCase().startsWith("!th ")) {
        const text = content.slice(4).trim();
        if (!text) return;
        const translated = await translate(text, "th", "vi");
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("แปลภาษา: ไทย → เวียดนาม")
          .addFields(
            { name: "ต้นฉบับ (ไทย)", value: text },
            { name: "แปลแล้ว (เวียดนาม)", value: translated || "แปลไม่ได้ในขณะนี้" }
          )
          .setFooter({ text: "Powered by Google Translate" })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      // !vi <text> — แปลเวียดนาม→ไทย
      if (content.toLowerCase().startsWith("!vi ")) {
        const text = content.slice(4).trim();
        if (!text) return;
        const translated = await translate(text, "vi", "th");
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("แปลภาษา: เวียดนาม → ไทย")
          .addFields(
            { name: "ต้นฉบับ (เวียดนาม)", value: text },
            { name: "แปลแล้ว (ไทย)", value: translated || "แปลไม่ได้ในขณะนี้" }
          )
          .setFooter({ text: "Powered by Google Translate" })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      // !help
      if (content.toLowerCase() === "!help") {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("คำสั่งบอท")
          .addFields(
            { name: "!th <ข้อความ>", value: "แปลภาษาไทยเป็นเวียดนาม" },
            { name: "!vi <ข้อความ>", value: "แปลภาษาเวียดนามเป็นไทย" },
            { name: "แปลอัตโนมัติ", value: "บอทตรวจจับภาษาเวียดนามและแปลเป็นไทยอัตโนมัติ" }
          );
        await message.reply({ embeds: [embed] });
        return;
      }

      // Auto-detect Vietnamese → translate to Thai
      if (content.startsWith("!")) return;
      if (!cachedConfig.translationEnabled) return;
      if (content.length < 3) return;

      if (isVietnamese(content)) {
        const translated = await translate(content, "vi", "th");
        if (!translated) return;
        const embed = new EmbedBuilder()
          .setColor(0x00b894)
          .setTitle("ตรวจพบภาษาเวียดนาม")
          .addFields(
            { name: "ต้นฉบับ (เวียดนาม)", value: content },
            { name: "แปลแล้ว (ไทย)", value: translated }
          )
          .setAuthor({
            name: message.author.displayName || message.author.username,
            iconURL: message.author.displayAvatarURL(),
          })
          .setFooter({ text: "Powered by Google Translate" })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error("[Bot] messageCreate error:", err.message);
    }
  });

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      const notifChannelId = cachedConfig.notificationChannelId;
      if (!notifChannelId) return;

      const notifChannel = client.channels.cache.get(notifChannelId);
      if (!notifChannel || !notifChannel.isTextBased()) return;

      const member = newState.member || oldState.member;
      const memberName = member?.displayName || member?.user.username || "Unknown";
      const memberAvatar = member?.user.displayAvatarURL() || null;
      const monitored = cachedConfig.voiceChannelIds || [];

      if (!oldState.channelId && newState.channelId) {
        const ch = newState.channel;
        if (!ch) return;
        if (monitored.length > 0 && !monitored.includes(newState.channelId)) return;

        const embed = new EmbedBuilder()
          .setColor(0x00b894)
          .setTitle("เข้าร่วม Voice Channel")
          .setDescription(`**${memberName}** เข้าร่วม **${ch.name}**`)
          .addFields(
            { name: "สมาชิก", value: memberName, inline: true },
            { name: "ห้อง", value: ch.name, inline: true },
            { name: "เวลา", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setTimestamp();
        if (memberAvatar) embed.setThumbnail(memberAvatar);
        await notifChannel.send({ embeds: [embed] });
      } else if (oldState.channelId && !newState.channelId) {
        const ch = oldState.channel;
        if (!ch) return;
        if (monitored.length > 0 && !monitored.includes(oldState.channelId)) return;

        const embed = new EmbedBuilder()
          .setColor(0xff7675)
          .setTitle("ออกจาก Voice Channel")
          .setDescription(`**${memberName}** ออกจาก **${ch.name}**`)
          .addFields(
            { name: "สมาชิก", value: memberName, inline: true },
            { name: "ห้อง", value: ch.name, inline: true },
            { name: "เวลา", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setTimestamp();
        if (memberAvatar) embed.setThumbnail(memberAvatar);
        await notifChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("[Bot] voiceStateUpdate error:", err.message);
    }
  });

  client.on("error", (err) => {
    console.error("[Bot] Client error:", err.message);
  });

  client.on("disconnect", () => {
    console.warn("[Bot] Disconnected, will reconnect...");
  });

  return client;
}

async function login() {
  // Try with MessageContent first
  try {
    messageContentEnabled = true;
    const client = createClient(allIntents);
    await client.login(DISCORD_TOKEN);
  } catch (err) {
    if (err.message && err.message.includes("disallowed intents")) {
      console.warn("[Bot] MessageContent intent not enabled, retrying without...");
      messageContentEnabled = false;
      const client = createClient(voiceOnlyIntents);
      await client.login(DISCORD_TOKEN);
    } else {
      throw err;
    }
  }
}

login().catch((err) => {
  console.error("[Bot] Fatal login error:", err.message);
  process.exit(1);
});
