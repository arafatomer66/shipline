# Deploy

A single shell script that deploys Shipline onto a fresh **Amazon Linux 2023** EC2 instance (t3.micro works with the 4 GB swap the script creates).

## Prerequisites

- An EC2 instance you can SSH into as `ec2-user`
- Docker, Node 22, nginx, and git installed (the EC2 user-data bootstrap below does this in one shot)
- Inbound security-group rules: **22 / 80 / 443** from your IP

### EC2 user-data bootstrap (one-time)

Paste this into **Advanced details → User data** when launching the instance:

```bash
#!/bin/bash
set -e
exec > /var/log/user-data.log 2>&1
dnf install -y docker git nginx
systemctl enable --now docker
usermod -aG docker ec2-user
mkdir -p /usr/local/lib/docker/cli-plugins/
curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs
systemctl enable --now nginx
echo "cloud-init done"
```

## Run the deploy

The Basic-Auth password is **never** baked into the script or the repo. You supply it via an environment variable each time you run the script:

```bash
# From your laptop, scp the script up:
scp -i ~/.ssh/your-key.pem deploy/deploy-ec2.sh ec2-user@<public-ip>:/home/ec2-user/deploy.sh

# Then SSH in and run it with the password set:
ssh -i ~/.ssh/your-key.pem ec2-user@<public-ip> \
  "ADMIN_PASSWORD='<your-strong-password>' bash /home/ec2-user/deploy.sh"
```

Default username is `admin`. Override with `ADMIN_USER='you' ADMIN_PASSWORD=...`.

## What the script does

1. **4 GB swap** so the Angular build doesn't OOM on a t3.micro.
2. **Clones / pulls** the repo at `/home/ec2-user/shipline`.
3. **Postgres** via `docker compose up -d postgres` (port 5438).
4. **API**: `npm install`, `prisma migrate deploy`, `nest build`, run as `shipline-api.service` (systemd, `Restart=always`).
5. **Web**: `npm install`, rewrites the dev API base to `/api`, `ng build --configuration production`.
6. **Basic Auth**: installs `httpd-tools`, generates `/etc/nginx/.htpasswd`, sets it to mode 640 owned by `root:nginx`.
7. **nginx**: strips the default server block from `nginx.conf` (otherwise it eats our requests), writes `/etc/nginx/conf.d/shipline.conf` that serves the SPA + reverse-proxies `/api/` + enforces `auth_basic` everywhere **except** `/api/health` (kept open for uptime checks).

## Rotating the Basic-Auth password

SSH in and overwrite the htpasswd file:

```bash
sudo htpasswd -b /etc/nginx/.htpasswd admin '<new-password>'
sudo systemctl reload nginx
```

## Health check

```bash
curl http://<public-ip>/api/health
```

Stays open without credentials so your uptime monitor can hit it.

## Removing the deploy

```bash
# Locally:
INSTANCE_ID=<i-…>
aws ec2 terminate-instances --instance-ids $INSTANCE_ID
aws ec2 delete-security-group --group-id <sg-…>
aws ec2 delete-key-pair --key-name shipline-deploy
```
