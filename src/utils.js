const { EmbedBuilder } = require('discord.js');

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const money = n => '$' + Math.round(n).toLocaleString('en-US');

function codeGen(length, mixed) {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const chars = mixed ? lower + upper + digits : upper + digits;
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function isAdmin(message, adminRoleId) {
  if (message.member?.permissions.has('Administrator')) return true;
  if (adminRoleId && message.member?.roles.cache.has(adminRoleId)) return true;
  return false;
}

function mentionedId(content) {
  const m = content.match(/<@!?(\d+)>/);
  return m ? m[1] : null;
}

function bar(value, max, width = 10) {
  const filled = clamp(Math.round((value / max) * width), 0, width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function baseEmbed(title, description, color = 0xf0b232) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || '')
    .setColor(color)
    .setTimestamp();
}

async function safeReply(interaction, options) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options);
    }
    return await interaction.reply(options);
  } catch (e) {
    console.error('Reply failed:', e.message);
  }
}

module.exports = {
  randInt, pick, clamp, money, codeGen, isAdmin,
  mentionedId, bar, fmtDuration, baseEmbed, safeReply
};
