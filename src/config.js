require('dotenv').config();

const minute = 60 * 1000;

module.exports = {
  token: process.env.DISCORD_TOKEN,
  prefix: process.env.PREFIX || '.',
  generalChannelId: process.env.GENERAL_CHANNEL_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  openaiKey: process.env.OPENAI_API_KEY || null,
  dbFile: process.env.DB_FILE || './data/economy.db',

  // Economy values (all agreed in the plan)
  startCash: 1000,
  dailyMin: 3500, dailyMax: 4000, dailyCooldown: 24 * minute * 60,
  workMin: 800, workMax: 2500, workCooldown: 60 * minute,
  begCooldown: 60 * minute,
  fishCooldown: 60 * minute,
  crimeCooldown: 60 * minute,
  robCooldown: 60 * minute,
  begMin: 50, begMax: 250,
  crimeMin: 400, crimeMax: 1200,
  crimeFailMin: 100, crimeFailMax: 300,
  robMinPct: 20, robMaxPct: 77,
  robFailChance: 0.45,
  jailMs: 5 * minute,

  // Drops
  dropMinDelay: 1 * minute,
  dropMaxDelay: 10 * minute,
  dropClaimMs: 90 * 1000,
  pirateMin: 800, pirateMax: 3500,
  flagMin: 500, flagMax: 2200,
  streakRequired: 5,
  streakBonusPct: 1.3,

  // Voice
  voice30: 300, voice60: 1000,

  // Gambling
  gambleMinBet: 100, gambleMaxBet: 2000,
  lotteryTicketPrice: 250,
  duelMinBet: 100, duelMaxBet: 5000,

  // Mining
  axeRentMines: 10,
  axePowerMax: 16,
  axeDurability: { copper: 40, iron: 80, diamond: 140, netherite: 220 },
  repairCost: { copper: 3, iron: 4, diamond: 5, netherite: 6 },
  materialValue: {
    stone: 15, dirt: 8, sand: 10, gravel: 12,
    copper: 45, iron: 90, diamond: 220, netherite: 600,
    special: 550, fish: 35, rarefish: 140
  }
};
