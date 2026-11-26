const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} = require('discord.js');

const WIDTH = 20;
const SWEET_START = 8;
const SWEET_END = 12;
const STEP_MS = 160;
const DURATION_MS = 3800;

function renderBar(pos) {
  let out = '';
  for (let i = 0; i < WIDTH; i++) {
    if (i === pos) out += '🔴';
    else if (i >= SWEET_START && i <= SWEET_END) out += '🟩';
    else out += '⬛';
  }
  return out;
}

async function runTiming(interaction, { title, description, color = 0xf0b232, onResult }) {
  let pos = 0;
  let dir = 1;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('timing_hit')
      .setLabel('⏹ HIT!')
      .setStyle(ButtonStyle.Success)
  );

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${description}\n\n${renderBar(pos)}\n\nPress the button when the 🔴 marker is in the 🟩 sweet spot!`)
    .setColor(color);

  const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  const interval = setInterval(() => {
    pos += dir;
    if (pos >= WIDTH - 1) dir = -1;
    if (pos <= 0) dir = 1;
    const e = EmbedBuilder.from(reply.embeds[0]).setDescription(
      `${description}\n\n${renderBar(pos)}\n\nPress the button when the 🔴 marker is in the 🟩 sweet spot!`
    );
    reply.edit({ embeds: [e] }).catch(() => {});
  }, STEP_MS);

  let perfect = false;
  let resultText = 'You did not press in time.';
  try {
    const collected = await reply.awaitMessageComponent({
      filter: i => i.customId === 'timing_hit' && i.user.id === interaction.user.id,
      time: DURATION_MS
    });
    clearInterval(interval);
    perfect = pos >= SWEET_START && pos <= SWEET_END;
    resultText = perfect
      ? '🎯 **PERFECT HIT!** Maximum reward!'
      : 'Close — you get a smaller reward.';
    await collected.update({ embeds: [
      EmbedBuilder.from(reply.embeds[0]).setDescription(`${description}\n\n${renderBar(pos)}\n\n${resultText}`)
    ], components: [] });
  } catch {
    clearInterval(interval);
    await reply.edit({ embeds: [
      EmbedBuilder.from(reply.embeds[0]).setDescription(`${description}\n\n${renderBar(pos)}\n\n⌛ ${resultText}`)
    ], components: [] }).catch(() => {});
  }

  if (onResult) await onResult(perfect);
}

module.exports = { runTiming };
