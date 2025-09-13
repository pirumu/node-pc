# Node PC Backend Monorepo

## 🏢 Project Overview

This monorepo contains backend applications and libraries built with NestJS and TypeScript, designed for scalable, maintainable, and hardware-integrated enterprise solutions. The architecture is modular, supporting robust inventory management, real-time hardware integration, background processing, and data synchronization.

### Main Applications

- **inventory**: Main business application for inventory and asset management, user authentication, authorization, and system configuration.
- **hardware-bridge**: Microservice for hardware integration (serial, HID, fingerprint, card, smart locks, etc.).
- **process-worker**: Background processing, scheduled jobs, data sync, and monitoring.
- **sync-worker**: Data synchronization between local and cloud.
- **lock-tracker**: Smart lock status tracking, MQTT integration.

### Shared Libraries (libs)

- **common**: Shared DTOs, constants, decorators, types, and interfaces.
- **config**: Core configuration, contracts, cloud, mongo, etc.
- **control-unit-lock**: Smart lock integration.
- **dals**: Data access layer, entities, mongo helpers.
- **fingerprint-scanner**: Fingerprint scanner integration.
- **framework**: Bootstrap, cache, logger, publisher, helpers, exceptions, swagger, etc.
- **hid**: HID device integration.
- **loadcells**: Loadcell sensor integration.
- **serialport**: Serial port integration.
- **services**: Cloud services, DTOs, and supporting services.

## 🚀 Tech Stack

- **NestJS** ^11.x
- **TypeScript** ^5.x
- **Node.js** v22.x
- **MongoDB** ^6.x
- **MikroORM** ^6.x
- **MQTT** ^5.x
- **Socket.IO** ^4.x
- **Pino** ^9.x
- **Swagger** ^11.x
- **Jest** ^29.x
- **ESLint/Prettier/Husky**
- **pnpm** (package manager)
- **Docker** (containerization, MongoDB, EMQX)

## 🛠️ Installation

### System Requirements
- **Node.js**: v22.x (see `.nvmrc`)
- **pnpm**: >=8.x
- **Docker**: For MongoDB, EMQX

### Steps
1. **Clone the repository & install Node.js**
   ```bash
   git clone <repository-url>
   cd server
   nvm install
   nvm use
   ```
2. **Install pnpm**
   ```bash
   npm install -g pnpm
   ```
3. **Install dependencies**
   ```bash
   pnpm install
   ```
4. **Create environment files: Find in env folder**

5. **Start Docker services**
   ```bash
   docker-compose up -d
   # Check: docker-compose ps
   ```

## 🎯 Development & Running

### Development Mode
```bash
pnpm run start:inventory:dev
pnpm run start:hardware-bridge:dev
pnpm run start:process-worker:dev
pnpm run start:sync-worker:dev
pnpm run start:lock-tracker:dev
```

### Production Mode
```bash
pnpm run build
pnpm run start:inventory
pnpm run start:hardware-bridge
pnpm run start:process-worker
pnpm run start:sync-worker
pnpm run start:lock-tracker
```

### PM2 (Production Process Manager)
```bash
pnpm run build
npm i -g pm2
pm2 start ecosystem.config.js
```

## 🏗️ Project Structure

```
server/
├── apps/
│   ├── inventory/         # Main API
│   ├── hardware-bridge/   # Hardware bridge
│   ├── process-worker/    # Background jobs
│   ├── sync-worker/       # Data sync
│   └── lock-tracker/      # Lock tracking
├── libs/
│   ├── common/            # Common utilities
│   ├── config/            # Config contracts/core
│   ├── control-unit-lock/ # Smart lock integration
│   ├── dals/              # Data access layer
│   ├── fingerprint-scanner/
│   ├── framework/         # Core framework
│   ├── hid/               # HID integration
│   ├── loadcells/         # Loadcell integration
│   ├── serialport/        # Serial port
│   └── services/          # Cloud & helpers
├── bin/                   # Binary files
├── cert/                  # SSL certificates
├── docker/                # Docker configs
├── env/                   # Environment files
├── scripts/               # Utility scripts
```

## 🐳 Docker Services

- **MongoDB**: 27017 ( db: ast)
- **EMQX (MQTT Broker)**: 1883 (MQTT), 8083 (WebSocket), 18083 (Dashboard, user: admin, pass: public)

### Docker Commands
```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## 🗄️ Running MongoDB Replica Set with Docker

To run MongoDB in replica set mode for development or testing:

1. **Start MongoDB Replica Set with Docker Compose**
   ```bash
   docker-compose -f docker-compose.mongo.replica_set.yaml up -d
   ```
2. **Initialize the Replica Set**
   After the containers are up, run the replica set initialization script:
   ```bash
   bash scripts/setup-replica-set.sh
   ```
   This script will connect to the primary MongoDB container and initialize the replica set configuration.
---


