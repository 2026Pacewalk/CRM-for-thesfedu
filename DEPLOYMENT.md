# Deploying theSFedu CRM to a VPS (PostgreSQL)

Two paths. **Docker Compose is recommended** — it runs the app and PostgreSQL
together with one command and is the easiest to reproduce. The bare-metal path
is there if you prefer not to use Docker.

---

## Option A — Docker Compose (recommended)

### 1. One-time server prep (Ubuntu/Debian VPS)

```bash
# Install Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in afterwards
```

### 2. Get the code and configure

```bash
git clone <your-repo-url> thesfedu-crm   # or upload the project folder
cd thesfedu-crm
cp .env.production.example .env
nano .env                                # set POSTGRES_PASSWORD and AUTH_SECRET
```

Generate a strong `AUTH_SECRET`:
```bash
openssl rand -base64 48
```

### 3. Build and start

```bash
docker compose up -d --build
```

This starts PostgreSQL, builds the app against Postgres, syncs the schema, and
serves on `127.0.0.1:3000`.

### 4. Seed the initial users (one time only)

```bash
docker compose exec app npx tsx prisma/seed.ts
```

> ⚠️ The seed creates demo accounts with the password `Password123!`.
> **Change these passwords (or delete the demo users) before going live.**
> Real user management is part of the upcoming Admin module.

### 5. Put Nginx + HTTPS in front

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/crm
```

```nginx
server {
    server_name crm.thesfedu.com;   # your domain/subdomain

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.thesfedu.com     # free TLS certificate
```

Point your DNS A record (e.g. `crm.thesfedu.com`) at the VPS IP first.

### Updating after code changes

```bash
git pull
docker compose up -d --build
```

### Backups

```bash
docker compose exec db pg_dump -U sfedu thesfedu_crm > backup-$(date +%F).sql
```

### Scheduled report digests (Section 6.7)

Set `CRON_SECRET` in `.env`, then add a daily server cron to trigger delivery of
any due digests (configure recipients in Admin → Report Schedules):

```bash
crontab -e
# Run every morning at 8am — sends DAILY digests, and WEEKLY ones when due:
0 8 * * * curl -s "https://crm.thesfedu.com/api/cron/digests?secret=YOUR_CRON_SECRET" >/dev/null
```

Email digests require live SMTP (see the integration env vars); otherwise they are
logged in simulation mode. Use the **Run now** button on a schedule to test.

---

## Option B — Bare metal (no Docker)

```bash
# 1. Install Node 20, PostgreSQL, PM2, Nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx
sudo npm i -g pm2

# 2. Create the database
sudo -u postgres psql -c "CREATE USER sfedu WITH PASSWORD 'strong-pass';"
sudo -u postgres psql -c "CREATE DATABASE thesfedu_crm OWNER sfedu;"

# 3. App setup
cd thesfedu-crm
npm ci
npm run db:postgres            # switch Prisma provider to PostgreSQL
# create .env with DATABASE_URL + AUTH_SECRET (see .env.production.example)
echo 'DATABASE_URL=postgresql://sfedu:strong-pass@localhost:5432/thesfedu_crm?schema=public' >> .env
echo 'AUTH_SECRET=...' >> .env
npx prisma db push
npx tsx prisma/seed.ts         # one-time demo seed (change passwords!)
npm run build

# 4. Run with PM2
pm2 start "npx next start -p 3000" --name thesfedu-crm
pm2 save && pm2 startup
```

Then add the same Nginx + Certbot reverse proxy as in Option A, step 5.

---

## Notes

- **Provider toggle:** local dev uses SQLite; production uses PostgreSQL. The
  Docker build switches automatically. For bare metal run `npm run db:postgres`
  (and `npm run db:sqlite` to switch back for local work).
- **Schema changes:** this build uses `prisma db push`. When the data model
  stabilizes we should switch to versioned migrations (`prisma migrate`) for
  safer production schema changes.
- **Secrets:** never commit `.env`. Rotate `AUTH_SECRET` only during a planned
  window — it invalidates all active sessions.
