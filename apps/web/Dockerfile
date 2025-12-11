FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Remove local dependency and lockfile to avoid build issues
RUN sed -i '/invo-chain-root/d' package.json && rm -f package-lock.json

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
