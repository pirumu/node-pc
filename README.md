# Node PC Backend Monorepo

## 🏢 Project Overview

This monorepo contains a suite of backend applications and libraries built with NestJS and TypeScript, designed for scalable, maintainable, and hardware-integrated enterprise solutions. The architecture is modular, supporting robust inventory management, real-time hardware integration, and background processing.

### Main Applications

- **inventory**
  - **Purpose:** The core business application for inventory and asset management, user authentication, authorization, and system configuration.
  - **Key Features:**
    - Modular architecture for inventory, system, and user management.
    - Integrates with MongoDB for data storage.
    - Real-time communication via MQTT and TCP.
    - JWT-based authentication and role-based access control.
    - Extensible with modules for devices, cabinets, bins, areas, transactions, and more.

- **hardware-bridge**
  - **Purpose:** A microservice dedicated to hardware integration, acting as a bridge between the backend and physical devices.
  - **Key Features:**
    - Serial port and HID (Human Interface Device) communication.
    - Integrates with fingerprint scanners, card readers, and smart locks.
    - Modular hardware support (loadcell, culock, fingerprint-scan, card-scan, etc.).
    - Real-time event publishing via MQTT.
    - Robust logging and tracing for hardware events.

- **worker**
  - **Purpose:** A background processing service for asynchronous and scheduled tasks.
  - **Key Features:**
    - Modules for data synchronization, data retention, monitoring and notification.
    - Offloads heavy or periodic jobs from the main API.
    - Designed for scalability and reliability in background operations.

- **cli**
  - **Purpose:** A command-line interface for administrative and maintenance tasks.
  - **Key Features:**
    - Provides commands for seeding, data migration, and system checks.
    - Useful for developers and system administrators.

## 🚀 Tech Stack

### Backend Framework
- **NestJS** ^11.0.1 - Node.js framework
- **TypeScript** ^5.7.3 - Programming language
- **Node.js** v22.17.0 - Runtime environment

### Database & Cache
- **MongoDB** ^8.16.2 - NoSQL database
- **Mongoose** ^8.16.2 - MongoDB object modeling
- **Cache Manager** ^7.0.1 - Caching solution

### Authentication & Security
- **JWT** ^11.0.0 - JSON Web Token
- **Pbkdf2** BuildIn - Password hashing
- **Helmet** ^8.1.0 - Security middleware

### Communication
- **MQTT** ^5.13.2 - Message broker
- **TCP** BuildIn - Message broker
- **Socket.IO** ^11.1.3 - Real-time communication
- **Fetch** BuildIn - HTTP client

### Additional Libraries
- **Class Transformer** ^0.5.1 - Object transformation
- **Class Validator** ^0.14.2 - Validation decorators
- **Swagger** ^11.2.0 - API documentation
- **Pino** ^9.7.0 - High-performance logger
- **Nest Commander** ^3.17.0 - CLI commands

### Tools & Utilities
- **pnpm** - Package manager
- **Docker** - Containerization
- **Husky** ^9.1.7 - Git hooks
- **Jest** ^29.7.0 - Testing framework
- **ESLint** ^9.18.0 - Code linting
- **CommitLint** ^9.18.0 - Code linting
- **Prettier** ^3.4.2 - Code formatting
- **compodoc** ^3.4.2 - Project document overview

## 🛠️ Installation

### System Requirements

- **Node.js**: v22.17.0 (use `.nvmrc` file)
- **pnpm**: Recommended package manager
- **Docker**: For running MongoDB and EMQX

### Step 1: Install Node.js
```bash
# If using nvm
nvm install v22.17.0
nvm use v22.17.0

# Or install Node.js v22.17.0 directly
```

### Step 2: Install pnpm
```bash
npm install -g pnpm
```

### Step 3: Clone repository
```bash
git clone <repository-url>
cd server
```

### Step 4: Install dependencies
```bash
pnpm install
```

### Step 5: Configure environment
```bash
# Create environment files
cp env/cli/.env.example env/cli/.env
cp env/hardware-bridge/.env.example env/hardware-bridge/.env
cp env/inventory/.env.example env/inventory/.env
cp env/worker/.env.example env/worker/.env

# Edit configuration file
```

### Step 6: Start services (MongoDB, EMQX)
```bash
# Run Docker containers
docker-compose up -d

# Check running containers
docker-compose ps
```

## 🎯 How to Start Project

### Development Mode
```bash
# Run Hardware bridge server in development mode
pnpm run start:hardware-bridge:dev

# Run inventory api server in development mode
pnpm run start:inventory:dev

# Run worker in development mode
pnpm run start:worker:dev

```

### Production Mode
```bash
# Build project
pnpm run build

# Run production mode
pnpm run start:prod
```

### Go-live (pm2)
> [Pm2](https://pm2.keymetrics.io/docs/usage/quick-start) is a daemon process manager that will help you manage and keep your application online. Getting started with PM2 is straightforward,
> it is offered as a simple and intuitive CLI, installable via NPM.
```bash
# Build project
pnpm run build

npm i -g pm2

pm2 start ecosystem.config.js

```

### Other Available Commands
```bash
# Generate project document
pnpm run docs
# Now you can see the project document definition in http://127.0.0.1:8080

```

### Code Generation Scripts
```bash
# Generate repository
pnpm run generate:repository

# Generate inventory module
pnpm run generate:module
```

## 🔧 Lint & Format

This project uses **ESLint & Prettier** for linting and formatting code.

### Linting
```bash
# Run linter and auto-fix
pnpm run lint
```

### Formatting
```bash
# Run format 
pnpm run format
```

### Git Hooks
This project uses Husky to run lint and format before commits:
```bash
# Install git hooks
pnpm run prepare
```

## 🏗️ Project Structure

```
server/
├── apps/                   # Applications
│   ├── inventory/          # Inventory application (main api)
│   ├── hardware-bridge/    # Hardware bridge application
│   ├── worker/             # Worker application
│   └── cli/                # CLI application
├── libs/                   # Shared libraries
│   ├── common/             # Common utilities
│   ├── config/             # Common Configuration
│   ├── dals/               # Data access layer
│   ├── entity/             # Entity definitions
│   ├── framework/          # Custom framework
│   ├── mapper/             # Data mappers
│   ├── cache/              # Cache layer
│   ├── control-unit-lock/  # Control unit lock
│   ├── finger-scanner/     # Finger scanner
│   ├── loadcells/          # Load cells
│   ├── serialport/         # Serial port
│   └── services/           # External Services (Cloud,etc.)
├── bin/                    # Binary files
├── cert/                   # SSL certificates
├── docker/                 # Docker configuration
├── env/                    # Environment files
└── scripts/                # Utility scripts
```

## 🐳 Docker Services

### MongoDB
- **Port**: 27017
- **Username**: admin
- **Password**: admin
- **Database**: ast
- **Dashboard**: Use MongoDB Compass

### EMQX (MQTT Broker)
- **MQTT Port**: 1883
- **WebSocket**: 8083
- **Dashboard**: http://localhost:18083
- **Username**: admin
- **Password**: public

### Docker Services Commands
```bash
# Run all services
docker-compose up -d

# Run only MongoDB
docker-compose up -d mongo

# Run only EMQX
docker-compose up -d emqx

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🚀 Deployment

### Build for production
```bash
pnpm run build
```

### Run production server
```bash
pnpm run start:prod
```

## 📚 Development Tools

### Code Quality
- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit checks

### Additional Features
- **Swagger**: Automatic API documentation
- **Pino**: High-performance structured logging
- **Compression**: Response compression middleware
- **Helmet**: Security headers middleware
- **Cookie Parser**: Cookie parsing middleware
