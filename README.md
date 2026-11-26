# Economy Discord Bot (JavaScript)

Full economy bot built from the planned spec. Uses **discord.js v14**, **dotenv**, and **SQLite** (`better-sqlite3`).

> Nothing is running yet. You must install Node.js and fill in `.env` before starting.

---

## 1. Install Node.js
Install **Node.js 20 LTS or newer** from <https://nodejs.org> (Node 24 works with the bundled better-sqlite3 13 binaries). Verify:

```bash
node -v
npm -v
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure

Copy `.env.example` to `.env` and fill in:

```
DISCORD_TOKEN=your_bot_token
PREFIX=.
GENERAL_CHANNEL_ID=channel_where_drops_appear
ADMIN_ROLE_ID=your_admin_role_id
OPENAI_API_KEY=            # optional, for .ask
DB_FILE=./data/economy.db
```

In the Discord Developer Portal:
- Enable **Message Content Intent** (required for drop codes).
- Invite the bot with: Send Messages, Embed Links, Read Message History,
  Add Reactions, Manage Roles, Manage Nicknames.
- Put the bot's role **above** any role it gives out.

## 4. Run

```bash
npm start
```

SQLite database is created automatically at `./data/economy.db`.

---

## Command list

**Core:** `.help` `.balance` `.daily` `.work` `.donate @user amt` `.leaderboard` `.leaderboard weekly` `.stats` `.history` `.wallet`

**Earn:** `.beg` `.fish` `.mine` `.crime` `.rob @user` `.quest` `.streak flag|box` `.voice`

**Gamble:** `.coinflip amt` `.gamble amt` `.duel @user amt` / `.duel` (accept) `.lottery buy` `.lottery draw` (admin)

**Bank:** `.deposit amt|all` `.withdraw amt` `.tax %` (admin)

**Shop:** `.shop` `.buy name` `.sell material amt` `.sellall` `.inventory` `.buyrole @role` `.open`

**Gear:** `.equip axe|rod|sword #` `.repair #` `.combine # #` `.upgrade axe|rod|sword #` `.enchant axe|rod|sword # #`

**Passive:** `.collect` `.title text` `.nickname text` `.gift @user amt`

**Dungeon:** `.dungeon` (solo) `.dungeon team`

**Other:** `.ask question` `.notify`

---

## Notes

- Drops run automatically every **1–2 minutes** in `GENERAL_CHANNEL_ID`, alternating pirate box / flag.
- Only one drop is live at a time; each lasts **60s**. Unclaimed drop messages are deleted.
- Pirate codes are **4 characters** (uppercase, lowercase, digits). First to type the code wins.
- Flag names work in **English or Arabic** (e.g. `.france` / `.فرنسا`).
- Flag and box streaks are separate; `.streak flag` / `.streak box` pays **1.3% of those 5 wins' total** at 5.
- Banked money is safe from `.rob`.
- Voice rewards: **$300 at 30 min**, **+$1,000 at 1 hour** per session.
- Phase 6 (Discord Activity 2D game) is intentionally **not included** — parked for later.

See `ECONOMY_BOT_GUIDE.md` for the permission checklist and teaching notes for your friend.
