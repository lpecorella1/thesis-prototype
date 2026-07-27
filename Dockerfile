FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NUTRITRACK_BASE_PATH=/nutritrack \
    NUTRITRACK_DATA_DIR=/app/prototipo_backend/data

WORKDIR /app/prototipo_backend

COPY --chown=node:node prototipo_backend/package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node prototipo_backend ./
COPY --chown=node:node frontend ../frontend

RUN mkdir -p /app/prototipo_backend/data && chown -R node:node /app/prototipo_backend/data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||3000;let basePath=String(process.env.NUTRITRACK_BASE_PATH||'/nutritrack');if(basePath.endsWith('/'))basePath=basePath.slice(0,-1);fetch('http://127.0.0.1:'+port+basePath+'/api/database/status').then((response)=>{if(!response.ok)process.exit(1);}).catch(()=>process.exit(1));"]

CMD ["node", "server.js"]
