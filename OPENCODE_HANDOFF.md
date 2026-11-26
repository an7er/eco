# OpenCode Handoff — Economy Discord Bot

Read this file first, then `README.md` and `ECONOMY_BOT_GUIDE.md`. Continue building/testing from here.

## Current state
- A **complete JavaScript bot** has been written in this folder using **discord.js v14**, **dotenv**, and **SQLite** (`better-sqlite3` 13).
- Verified on this machine with **Node 24.19.0**: all `src/*.js` files pass `node --check`, `npm install` and `npm start` work, and temp-database smoke tests pass for daily cooldowns, admin add/remove/set, shop purchases, weekly leaderboard, notifications, and drop claiming.
- `.env` now exists with blank values — the user must fill `DISCORD_TOKEN`, `GENERAL_CHANNEL_ID`, and `ADMIN_ROLE_ID` before `npm start`.
- The user ran it on another machine successfully: it logged in as `Otherhood Economy#3190`.
- The user's local project layout puts the `.js` files at the **root**; this handoff folder uses `src\`. Both work as long as `index.js` and its `require()` paths match.
- The bot token has been exposed in screenshots multiple times. **It must be reset** before continuing.

## Fixed here (2026-11-26)
- Admin add no longer credits twice; admin set cannot go negative.
- Daily / work / beg no longer erase their payout with a stale user object.
- Shop purchases no longer refund themselves through a stale user object.
- Cooldown reply typo fixed; `.leaderboard weekly` now ranks last 7 days of earnings.
- `.notify` now actually DMs users when a drop appears (bot needs DMs enabled).
- Fishing checks for an equipped rod before consuming the cooldown.
- Team dungeon leader now pays the entry fee; dungeon sessions expire after 30 min.

## Files
```
package.json          dependencies
.env.example          config template
README.md             setup + command list
ECONOMY_BOT_GUIDE.md  permission checklist / teaching guide
src/index.js          bot entry, command handler, voice tracking
src/config.js         all agreed values
src/db.js             SQLite schema + seeded shop
src/economy.js        cash/bank/transfer/tax/cooldowns/transactions
src/gear.js           axes, rods, swords, durability, repair, combine, upgrades, enchants, loot boxes
src/drops.js          pirate box + flag events, .CODE and .<country> claims, debug logs
src/minigames.js      sweet-spot timing buttons for .fish/.mine
src/dungeons.js       solo + team boss fights with role abilities
src/commands.js       all commands
src/utils.js          helpers
dungeon-hud-preview.html  static visual mockup (not bot code)
```

## Environment variables (in `.env`)
```
DISCORD_TOKEN=         required, reset this
PREFIX=.
GENERAL_CHANNEL_ID=    required for drops
ADMIN_ROLE_ID=         required for admin commands
OPENAI_API_KEY=        optional, only for .ask
DB_FILE=./data/economy.db
```
The app must have **Message Content Intent** enabled or drop claims will not work. Bot role must be above roles it assigns.

## All decisions made by the user

### Command style
Dot prefix commands, e.g. `.daily`. Added to the user's existing bot. Database choice deferred; SQLite used as default.

### Core economy
- `.balance`, `.donate @user amount`, `.leaderboard`, `.leaderboard weekly`, `.admin add|remove|set @user amount`
- `.daily` — 24h cooldown, random **$3,500–$4,000**
- `.work` — 1h cooldown, random **$800–$2,500**

### Chat events
- One shared timer, random **1–2 minutes**, **one event at a time**, alternating.
- **Pirate box:** animated GIF (user's Pinterest GIF URL in `drops.js`), **4-char mixed-case + digit code**. Claim with **`.CODE`** or plain `CODE`. Prize random **$800–$3,500**.
- **Both drop types on claim:** a "Claimed!" message appears for 5s, then the popup, claimer's message and drop message are deleted.
- **Flag:** real country flag image (flagcdn), **no code**. Claim with **`.<country name>`** in English **or Arabic** (or `.flag <name>`), e.g. `.france` / `.فرنسا`, `.united states` / `.أمريكا`. Prize random **$500–$2,200**.
- **60s** to claim, then the unclaimed drop message is deleted. Bot mints the money.
- **Separate flag and box streaks**: 5 consecutive wins of the same type; `.streak flag` / `.streak box` pays **1.3% of those 5 wins' total**, then resets. Winning the other type resets both; an expired drop resets all. Plain `.streak` shows both.

### Earners
- `.beg`, `.fish` — 1h cooldown. Fishing uses sweet-spot timing buttons; rods improve catches.
- `.mine` — sweet-spot timing; no fixed cooldown.
- `.crime` — risky payout, failure fine + 5 min jail.
- `.rob @user` — success roll, steals random **20%–77% of unbanked cash**; banked money is safe; failure fine + jail.
- `.quest` — daily "mine 5 times" quest, reward $800.
- `.voice` — **$300 at 30 min**, **+$1,000 at 1 hour** per voice session.

### Mining
- Axe tiers: copper → iron → diamond → netherite.
- **Rented:** 10 mines then breaks, cannot be repaired.
- **Bought:** permanent, slow durability loss, power **+1 → +16**.
- Repair with **own material** (iron axe = 4 iron). Combine two same-tier axes → one full-durability axe, keep higher power.
- Materials: stone, dirt, sand, gravel, ores, special blocks; sellable via `.sell` / `.sellall`.
- Power improves luck, rarity, and yield. Rented axes cannot be repaired/combined.

### Gambling & bank
- `.coinflip amount`, `.gamble amount`, `.duel @user amount` / `.duel` to accept, `.lottery buy|draw` (draw is admin).
- `.deposit amount`, `.withdraw amount`, `.tax percent` (admin only).

### Shop & spending
- `.shop`, `.buy name`, `.sell material amount`, `.sellall`, `.inventory`, `.buyrole @role`, `.open` (loot box).
- Loot boxes drop axes, rods, enchant books, swords, or cash.
- Enchant books: **Luck, Durability, Power, Critical**; random level roll; usable on axes/rods/swords.
- Sword roles (all iron tier, original fantasy names): **mage (magic burst), burn, poison, healer (party heal), assassin (critical)**. More later. Equip one sword at a time; it defines dungeon role.
- `.business`, `.pet`, `.house`, `.farm`, `.title`, `.nickname`, `.insurance`, `.bail`, `.gift @user amount`, `.collect` for passive income.

### Dungeons
- Both **solo floors** and **team boss runs**. Each player controls only their own character.
- HUD: embed with HP/MP/XP bars, enemy HP, status chips, inventory, combat log, buttons Attack/Magic/Heal/Item/Flee.
- Button/timing miss = smaller reward only. **Losing the whole fight** = durability loss + entry fee.
- Rewards: money, materials, loot boxes.

### Extras
- ChatGPT `.ask` (optional key), embeds everywhere, `.stats`, `.history`, `.wallet`, `.notify`, `.help`.

### PARKED — do not build yet
**Phase 6: Discord Activity 2D top-down arena game.** Small 2D sprite sheets, WASD/touch controls, boss fights, role skills, needs Discord app with Activities, HTTPS hosting, Activity SDK, and an API to the economy. User will come back to this later.

## Known issues to check/fix next
1. ~~Verify syntax by running `npm install` then `npm start`.~~ Done — see Current state.
2. `drops.js` uses a Pinterest GIF URL; if it stops loading, download it locally.
3. Flag images come from `flagcdn.com` — needs internet.
4. Ensure `GENERAL_CHANNEL_ID` and `ADMIN_ROLE_ID` are set correctly; otherwise drops/admin commands silently fail.
5. The user's earlier VS Code project was edited by Copilot and used a root-level layout; reconcile paths if helping them there.
6. Balance/tune prices and sinks — many money sources exist, inflation is likely.

## How to continue with the user
Ask what they want next: fix/test a specific command, tune prices, add a missing feature, or start the parked Phase 6. Keep changes consistent with this spec.
