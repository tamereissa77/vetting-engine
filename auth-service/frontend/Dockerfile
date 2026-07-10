FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install && npm install -g serve

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "npm run build && serve -s dist -l 5173"]
