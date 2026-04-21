const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CONFIG_API_URL = process.env.CONFIG_API_URL || 'http://localhost:3001';

// ===== ฟังก์ชันตรวจจับภาษาเวียดนาม =====
function isVietnamese(text) {
  // ตรวจจับอักขระพิเศษภาษาเวียดนาม
  const vietnamesePattern = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/;
  return vietnamesePattern.test(text);
}

// ===== ฟังก์ชันแปลภาษาด้วย MyMemory API =====
async function translateText(text, fromLang, toLang) {
  try {
    const response = await axios.get('https://api.mymemory.translated.net/get', {
      params: {
        q: text,
        langpair: `${fromLang}|${toLang}`,
      },
      timeout: 10000,
    });

    const data = response.data;
    if (
      data &&
      data.responseStatus === 200 &&
      data.responseData &&
      data.responseData.translatedText
    ) {
      return data.responseData.translatedText;
    }
    throw new Error('Translation API returned invalid data');
  } catch (error) {
    console.error('[Translation Error]', error.message);
    return null;
  }
}

// ===== ดึง config จาก backend =====
async function getConfig() {
  try {
    const response = await axios.get(`${CONFIG_API_URL}/api/config`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    console.error('[Config Error] Cannot fetch config:', error.message);
    // fallback default config
    return {
      translationEnabled: true,
      voiceChannelIds: [],
      notificationChannelId: null,
    };
  }
}

// ===== EVENT: Bot พร้อมใช้งาน =====
client.once('ready', () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Running at ${new Date().toISOString()}`);
});

// ===== EVENT: ข้อความใหม่ =====
client.on('messageCreate', async (message) => {
  try {
    // ไม่ตอบสนองต่อบอทอื่น
    if (message.author.bot) return;

    const content = message.content.trim();

    // ===== คำสั่ง !th <ข้อความ> =====
    if (content.toLowerCase().startsWith('!th ')) {
      const textToTranslate = content.slice(4).trim();

      if (!textToTranslate) {
        await message.reply('กรุณาใส่ข้อความที่ต้องการแปล เช่น: `!th สวัสดี`');
        return;
      }

      const translated = await translateText(textToTranslate, 'th', 'vi');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🌐 แปลภาษา: ไทย → เวียดนาม')
        .addFields(
          { name: '🇹🇭 ต้นฉบับ (ไทย)', value: textToTranslate, inline: false },
          {
            name: '🇻🇳 แปลแล้ว (เวียดนาม)',
            value: translated || '❌ ไม่สามารถแปลได้ในขณะนี้',
            inline: false,
          },
        )
        .setFooter({ text: 'Powered by Translation API' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // ===== ตรวจจับภาษาเวียดนาม (อัตโนมัติ) =====
    const config = await getConfig();
    if (!config.translationEnabled) return;

    // ไม่แปลถ้าเป็นคำสั่ง
    if (content.startsWith('!')) return;

    // ตรวจจับว่าเป็นภาษาเวียดนามหรือไม่
    if (isVietnamese(content) && content.length >= 3) {
      const translated = await translateText(content, 'vi', 'th');

      if (!translated) {
        console.warn('[Translation] Failed to translate Vietnamese message');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00b894)
        .setTitle('🌐 ตรวจพบภาษาเวียดนาม')
        .addFields(
          { name: '🇻🇳 ต้นฉบับ (เวียดนาม)', value: content, inline: false },
          { name: '🇹🇭 แปลแล้ว (ไทย)', value: translated, inline: false },
        )
        .setAuthor({
          name: message.author.displayName || message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setFooter({ text: 'Powered by Translation API' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('[MessageCreate Error]', error.message);
  }
});

// ===== EVENT: Voice Channel เข้า/ออก =====
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const config = await getConfig();

    // ดึง notification channel
    const notifChannelId = config.notificationChannelId;
    if (!notifChannelId) return;

    const notifChannel = client.channels.cache.get(notifChannelId);
    if (!notifChannel) return;

    const member = newState.member || oldState.member;
    const memberName = member ? member.displayName || member.user.username : 'Unknown';
    const memberAvatar = member ? member.user.displayAvatarURL() : null;

    const monitoredChannels = config.voiceChannelIds || [];

    // ===== เข้า Voice Channel =====
    if (!oldState.channelId && newState.channelId) {
      const voiceChannel = newState.channel;
      if (!voiceChannel) return;

      // ถ้ากำหนด channels ไว้ ให้ตรวจเฉพาะ channel ที่กำหนด
      if (monitoredChannels.length > 0 && !monitoredChannels.includes(newState.channelId)) return;

      const embed = new EmbedBuilder()
        .setColor(0x00b894)
        .setTitle('🟢 เข้าร่วม Voice Channel')
        .setDescription(`**${memberName}** เข้าร่วม **${voiceChannel.name}**`)
        .addFields(
          { name: '👤 สมาชิก', value: memberName, inline: true },
          { name: '🔊 ห้อง', value: voiceChannel.name, inline: true },
          {
            name: '⏰ เวลา',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          },
        )
        .setTimestamp();

      if (memberAvatar) embed.setThumbnail(memberAvatar);

      await notifChannel.send({ embeds: [embed] });
    }

    // ===== ออก Voice Channel =====
    else if (oldState.channelId && !newState.channelId) {
      const voiceChannel = oldState.channel;
      if (!voiceChannel) return;

      if (monitoredChannels.length > 0 && !monitoredChannels.includes(oldState.channelId)) return;

      const embed = new EmbedBuilder()
        .setColor(0xff7675)
        .setTitle('🔴 ออกจาก Voice Channel')
        .setDescription(`**${memberName}** ออกจาก **${voiceChannel.name}**`)
        .addFields(
          { name: '👤 สมาชิก', value: memberName, inline: true },
          { name: '🔊 ห้อง', value: voiceChannel.name, inline: true },
          {
            name: '⏰ เวลา',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          },
        )
        .setTimestamp();

      if (memberAvatar) embed.setThumbnail(memberAvatar);

      await notifChannel.send({ embeds: [embed] });
    }

    // ===== ย้าย Voice Channel =====
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const oldChannel = oldState.channel;
      const newChannel = newState.channel;
      if (!oldChannel || !newChannel) return;

      const oldMonitored =
        monitoredChannels.length === 0 || monitoredChannels.includes(oldState.channelId);
      const newMonitored =
        monitoredChannels.length === 0 || monitoredChannels.includes(newState.channelId);

      if (!oldMonitored && !newMonitored) return;

      const embed = new EmbedBuilder()
        .setColor(0xfdcb6e)
        .setTitle('🟡 ย้าย Voice Channel')
        .setDescription(
          `**${memberName}** ย้ายจาก **${oldChannel.name}** ไป **${newChannel.name}**`,
        )
        .addFields(
          { name: '👤 สมาชิก', value: memberName, inline: true },
          { name: '🔊 จากห้อง', value: oldChannel.name, inline: true },
          { name: '🔊 ไปห้อง', value: newChannel.name, inline: true },
          {
            name: '⏰ เวลา',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          },
        )
        .setTimestamp();

      if (memberAvatar) embed.setThumbnail(memberAvatar);

      await notifChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('[VoiceStateUpdate Error]', error.message);
  }
});

// ===== Error handling =====
client.on('error', (error) => {
  console.error('[Client Error]', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('[Unhandled Rejection]', error.message);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error.message);
  process.exit(1);
});

// ===== Login =====
if (!DISCORD_TOKEN) {
  console.error('[Bot] ERROR: DISCORD_TOKEN is not set!');
  process.exit(1);
}

client.login(DISCORD_TOKEN).catch((error) => {
  console.error('[Bot] Login failed:', error.message);
  process.exit(1);
});
