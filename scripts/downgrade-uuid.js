const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, '../services');

function downgradeUuid() {
    if (fs.existsSync(servicesDir)) {
        const services = fs.readdirSync(servicesDir);
        services.forEach(service => {
            const servicePath = path.join(servicesDir, service);
            const packageJsonPath = path.join(servicePath, 'package.json');

            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

                if (packageJson.dependencies && packageJson.dependencies.uuid) {
                    console.log(`Downgrading uuid in ${service}...`);
                    packageJson.dependencies.uuid = "^8.3.2";
                    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
                }
            }
        });
    }
}

downgradeUuid();
