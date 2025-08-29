// server.js
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cosineSimilarity = require('cosine-similarity');

const app = express();
const port = 3000;

// --- 数据库 ---
// 使用一个简单的 JSON 文件模拟数据库
const DB_PATH = path.join(__dirname, 'face_database.json');

// 初始化数据库文件
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
}

// 读取数据库
const readDB = () => JSON.parse(fs.readFileSync(DB_PATH));
// 写入数据库
const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- AI 服务配置 ---
// 将原来的地址
// const AI_API_URL = 'http://127.0.0.1:8066/represent';

// 修改为使用服务名 'ai-service' (这个名字我们将在下一步的 docker-compose.yml 中定义)
const AI_API_URL = 'http://ai-service:8066/represent';
const API_KEY = 'mt_photos_ai_extra';
const SIMILARITY_THRESHOLD = 0.6; // 余弦相似度阈值，高于这个值认为是同一个人，可根据实际情况调整

// --- 中间件 ---
// 用于处理上传的临时文件
const upload = multer({ dest: 'uploads/' });
// 提供前端静态文件
app.use(express.static(path.join(__dirname, '../frontend')));


// --- API 路由 ---

// 1. 注册人脸
app.post('/register', upload.single('photo'), async (req, res) => {
    const { name } = req.body;
    const photoPath = req.file.path;

    try {
        // 将图片文件发送给 AI 服务
        const formData = new FormData();
        formData.append('file', new Blob([fs.readFileSync(photoPath)]), req.file.originalname);

        const response = await axios.post(AI_API_URL, formData, {
            headers: { 'api-key': API_KEY },
        });

        // 确保识别到了人脸并且获取了向量
        if (response.data.result && response.data.result.length > 0) {
            const vector = response.data.result[0].embedding;

            // 将姓名和向量存入数据库
            const db = readDB();
            db.push({ name, vector });
            writeDB(db);

            res.json({ success: true, message: '注册成功！' });
        } else {
            res.status(400).json({ success: false, message: '照片中未能识别到人脸。' });
        }
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ success: false, message: 'AI 服务调用失败或发生内部错误。' });
    } finally {
        // 删除临时上传的文件
        fs.unlinkSync(photoPath);
    }
});

// 2. 识别人脸
app.post('/recognize', upload.single('photo'), async (req, res) => {
    const photoPath = req.file.path;

    try {
        const formData = new FormData();
        formData.append('file', new Blob([fs.readFileSync(photoPath)]), 'capture.jpg');

        const response = await axios.post(AI_API_URL, formData, {
            headers: { 'api-key': API_KEY },
        });

        if (response.data.result && response.data.result.length > 0) {
            const unknownVector = response.data.result[0].embedding;
            const db = readDB();
            let bestMatch = { name: null, score: 0 };

            // 遍历数据库，寻找最匹配的人脸
            for (const user of db) {
                const score = cosineSimilarity(unknownVector, user.vector);
                if (score > bestMatch.score) {
                    bestMatch = { name: user.name, score };
                }
            }

            // 如果最高分超过阈值，则认为是同一个人
            if (bestMatch.score > SIMILARITY_THRESHOLD) {
                res.json({ status: 'pass', name: bestMatch.name });
            } else {
                res.json({ status: 'fail' });
            }
        } else {
            res.json({ status: 'fail', message: '未检测到人脸' });
        }
    } catch (error) {
        console.error('识别失败:', error);
        res.status(500).json({ status: 'fail', message: '服务异常' });
    } finally {
        fs.unlinkSync(photoPath);
    }
});


// --- 启动服务器 ---
app.listen(port, () => {
    console.log(`后端服务已启动，正在监听 http://localhost:${port}`);
    console.log(`请在浏览器中打开前端页面进行操作。`);
});