const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, '../services');
const appsDir = path.join(__dirname, '../apps');

const backendDockerfileContent = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Remove local dependency and lockfile to avoid build issues
RUN sed -i '/invo-chain-root/d' package.json && rm -f package-lock.json

RUN npm install

COPY . .

EXPOSE PORT_PLACEHOLDER

CMD ["npm", "run", "dev"]
`;

const frontendDockerfileContent = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Remove local dependency and lockfile to avoid build issues
RUN sed -i '/invo-chain-root/d' package.json && rm -f package-lock.json

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
`;

// Service Port Mapping based on docker-compose.yml
const servicePorts = {
    'auth-service': 3011,
    'invoice-service': 3002,
    'merchant-registry-service': 3012,
    'inventory-service': 3013,
    'audit-service': 3014,
    'blockchain-service': 3003,
    'notification-service': 3005,
    'payment-service': 3010,
    'buyer-action-service': 3004,
    'gst-return-service': 3008,
    'gst-adapter-service': 3009,
    'reconciliation-service': 3006,
    'credit-debit-note-service': 3007,
    'api-gateway': 3000
};

function createBackendDockerfiles() {
    if (fs.existsSync(servicesDir)) {
        const services = fs.readdirSync(servicesDir);
        services.forEach(service => {
            const servicePath = path.join(servicesDir, service);
            if (fs.statSync(servicePath).isDirectory()) {
                // Skip shared, database, storage
                if (['shared', 'database', 'storage'].includes(service)) return;

                const dockerfilePath = path.join(servicePath, 'Dockerfile');
                const port = servicePorts[service] || 3000;
                const content = backendDockerfileContent.replace('PORT_PLACEHOLDER', port);

                fs.writeFileSync(dockerfilePath, content);
                console.log(`Created Dockerfile for ${service}`);
            }
        });
    } else {
        console.error(`Services directory not found at: ${servicesDir}`);
    }
}

function createFrontendDockerfile() {
    const webPath = path.join(appsDir, 'web');
    if (fs.existsSync(webPath)) {
        const dockerfilePath = path.join(webPath, 'Dockerfile');
        fs.writeFileSync(dockerfilePath, frontendDockerfileContent);
        console.log(`Created Dockerfile for apps/web`);
    } else {
        console.error(`Web app directory not found at: ${webPath}`);
    }
}

createBackendDockerfiles();
createFrontendDockerfile();
