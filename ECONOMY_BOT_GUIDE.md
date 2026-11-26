# Economy Bot — Build & Setup Guide

**Status:** planning only. No bot code has been written yet. This is the shared checklist for you and your friend.

---

## STEP 0 — Get what you need from the server owner

You are head admin, not the owner, so confirm these first:

- [ ] **Discord app ownership:** the owner either creates the bot application in the Discord Developer Portal and gives you Admin access to it, or agrees to let you create it.
- [ ] **Manage Server permission:** needed to invite bots. If you don't have it, the owner must invite the bot.
- [ ] **Bot role position:** the bot's role must be **higher than any role it will give out** (`.buyrole`, titles). Otherwise role purchases fail.
- [ ] **Message Content Intent:** the app owner must enable this in the Developer Portal. Without it, the bot **cannot read the drop codes** typed in chat.
- [ ] **Bot permissions** when invited:
  - Send Messages
  - Embed Links
  - Read Message History
  - Add Reactions
  - Manage Roles
  - Manage Nicknames (only if `.nickname` is included)
  - Manage Messages (optional, for cleaning up drop claims)
- [ ] **General chat channel ID** — right-click the channel → Copy ID (Developer Mode must be on).
- [ ] Decide whether the bot may DM users (for `.notify`, optional).
- [ ] Agree on a **test server** so you can break things safely before going live.

---

## STEP 1 — Machine and hosting

- [ ] Install **Node.js 20 LTS** and **npm**. (Node is **not currently installed** on this machine — install it first.)
- [ ] Choose where the bot will run 24/7:
  - an always-on PC,
  - a VPS, or
  - a cloud host.
  - **Note:** the random drops only work while the bot is online.
- [ ] Decide the database now or later (you said you'd decide at build time):
  - **MongoDB Atlas** (free tier) — matches the playlist, needs internet.
  - **SQLite** — one local file, simplest, good for one server.

---

## STEP 2 — Create the bot in the Discord Developer Portal

1. Go to <https://discord.com/developers/applications>.
2. Click **New Application** → name it (e.g. `EconomyBot`).
3. Go to the **Bot** tab → **Reset Token** → copy the token and store it safely (never share it).
4. Under **Privileged Gateway Intents**, turn on **Message Content Intent**. (Server Members Intent optional.)
5. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Permissions: the ones listed in Step 0.
6. Open the generated URL and invite the bot to the **test server** first.
7. In Server Settings → Roles, drag the bot's role **above** any role it needs to give out.

---

## STEP 3 — Project setup

```bash
mkdir economy-bot
cd economy-bot
npm init -y
npm install discord.js dotenv mongoose   # or better-sqlite3 if using SQLite
```

Suggested structure:

```
economy-bot/
  .env
  index.js
  config.js
  commands/
    balance.js  daily.js  work.js  donate.js  leaderboard.js
    beg.js  fish.js  mine.js  voice.js  crime.js  rob.js
    quest.js  streak.js  coinflip.js  gamble.js  duel.js  lottery.js
    deposit.js  withdraw.js  tax.js  shop.js  buy.js  sell.js
    inventory.js  buyrole.js  lootbox.js  repair.js  combine.js
    business.js  pet.js  house.js  farm.js  title.js  nickname.js
    insurance.js  bail.js  gift.js
  events/
    messageCreate.js   # drop-code claims + prefix commands
    voiceStateUpdate.js
    ready.js
  modules/
    economy.js  drops.js  mining.js  dungeons.js  embeds.js
  models/
    User.js  Shop.js  Transaction.js
```

`.env` template:

```
DISCORD_TOKEN=your_bot_token
PREFIX=.
GENERAL_CHANNEL_ID=your_channel_id
ADMIN_ROLE_ID=your_admin_role_id
MONGO_URI=your_mongodb_connection_string
OPENAI_API_KEY=optional
```

---

## STEP 4 — Database fields

**User**
- `id` (Discord user ID)
- `cash`, `bank`
- `lastDaily`, `lastWork`, `lastBeg`, `lastFish`, `lastRob`, `lastCrime`
- `inventory` (items, materials, axes, rods, swords, books, loot boxes)
- `equippedAxe`, `equippedRod`, `equippedSword`
- `axePower`, `rodPower`, `swordPower`
- `streak` (consecutive first-to-claim drop wins)
- `voiceSeconds`, `voiceClaimed30`, `voiceClaimed60`
- `stats` (earned, spent, won, lost)

**Transaction** — every earn, spend, transfer, bet, tax, and claim, with timestamp.

**Shop** — item name, price, description, type, role reward.

---

## STEP 5 — What to build, in order (all the values we agreed)

### Phase 1 — Core + drops
- `.balance`, `.donate`, `.leaderboard`, `.admin add/remove/set`
- `.daily` — 24h cooldown, random **$3,500–$4,000**
- `.work` — 1h cooldown, random **$800–$2,500**
- `.shop`, `.buy`, `.inventory`, `.buyrole`, `.sell`
- **Drop system:** one timer, random **1–10 min**, alternating:
  - pirate box GIF + plain code, **$800–$3,500**
  - flag + **8-character mixed case+number code**, **$500–$2,200**
  - **60s** to claim, first correct answer in general chat wins; unclaimed drop messages are deleted
  - bot mints the money

### Phase 2 — Earners & risk
- `.beg`, `.fish` — **1h cooldown**
- `.crime` — risky payout, failure/jail
- `.rob @user` — success roll, steals random **20%–77% of unbanked cash**; banked money safe; failure = fine/jail
- `.quest`, `.streak`
  - `.streak` = **5 consecutive first-to-claim drop wins**, then run `.streak` for **1.3% of total won across those 5 drops**; resets on someone else winning or a drop expiring; after payout resets to 0
- `.coinflip`, `.gamble`, `.duel @user`, `.lottery`
- `.deposit` / `.withdraw`, `.tax`

### Phase 3 — Mining
- Axe tiers: **copper → iron → diamond → netherite**
- Rent = **10 mines** then breaks, **unrepairable**
- Buy = permanent, slow durability loss, power **+1 → +16**
- Repair with **own material** (iron axe = **4 iron**)
- Combine two same-tier axes → one full-durability axe, keep higher power
- Loot: stone, dirt, sand, gravel, ores, special blocks → `.sell`
- Power changes luck, rarity, and yield

### Phase 4 — Voice, shop & progression
- `.voice` — **$300 at 30 min** + **$1,000 at 1 hour** = **$1,300 per person**
- Loot boxes from bot store → axes, rods, **enchant books**, more later
- Enchant books: **Luck, Durability, Power, Critical**, random level roll, usable on axes/rods/swords
- `.business`, `.pet`, `.house`, `.farm`, `.title`, `.nickname`, `.insurance`, `.bail`, `.gift @user`

### Phase 5 — Swords, dungeons & extras
- All swords **iron tier**, each with a unique power:
  - Mage (magic burst), Burn, Poison, Healer (party heal), Assassin
  - Original names; more roles later
- Dungeons: **solo floors + team boss runs**; each player controls their own character
- Losing a dungeon = **durability + entry fee**
- HUD style: embed with HP/MP/XP bars, enemy HP, status chips, inventory, combat log, and buttons (Attack / Magic / Heal / Item / Flee)
- ChatGPT command, embeds everywhere, admin audit tools

### Minigames
- Button-based, sweet-spot timing for `.fish` and `.mine`
- Miss = smaller reward only, no penalty
- Dungeon buttons: Attack / Magic / Heal / Item / Flee

### Phase 6 — PARKED FOR LATER
- Discord **Activity** 2D top-down arena game
- Small 2D sprite sheets, WASD/touch controls, boss fights
- Needs Discord app with Activities, HTTPS hosting, Activity SDK, API to economy

---

## STEP 6 — Test checklist

- [ ] All commands respond with `.` prefix in the test server.
- [ ] Drops appear in the correct channel and codes are claimed by the first correct message.
- [ ] Streak resets correctly when someone else wins or a drop expires.
- [ ] Banked money cannot be robbed.
- [ ] Mining durability, repair, and combine work.
- [ ] Voice rewards only pay once per threshold.
- [ ] Admin commands are restricted to the admin role.
- [ ] Bot survives a restart without losing balances.
- [ ] No one can go negative.

## STEP 7 — Go live

- [ ] Invite the bot to the real server with the same permissions.
- [ ] Place its role above roles it assigns.
- [ ] Run with a process manager so it stays online (`pm2` or similar).
- [ ] Announce the commands and drop rules to the server.

---

## Splitting the work with your friend

- **You (head admin):** owner permissions, role setup, channel IDs, server-side testing, teaching the rules.
- **Friend:** Node setup, coding, database, hosting, debugging.
- **Owner:** Developer Portal access/approval if required, final sign-off.

## Still undecided

- Database choice (MongoDB vs SQLite)
- Exact durability numbers, prices, and upgrade costs
- The five original sword names
- Hosting location
- Your existing bot's language/code structure
- Boss list for dungeons
