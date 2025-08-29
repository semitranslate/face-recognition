# Dockerfile

# 1. 选择一个包含 Node.js 的官方基础镜像
FROM node:18-alpine

# 2. 在容器内创建一个工作目录
WORKDIR /app

# 3. 复制后端 package.json 文件并安装依赖
# 这样做可以利用 Docker 的缓存机制，如果依赖没变，就不用每次都重新安装
COPY backend/package*.json ./
RUN npm install

# 4. 复制后端和前端的全部代码到工作目录
# 后端代码复制到 /app
COPY backend/ ./
# 前端代码复制到 /app/frontend (这样 express.static 就能找到它)
COPY frontend/ ./frontend/

# 5. 暴露 Node.js 服务运行的端口
EXPOSE 3000

# 6. 设置容器启动时要执行的命令
CMD [ "node", "server.js" ]