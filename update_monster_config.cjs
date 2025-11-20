const fs = require('fs');
const path = require('path');
const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// 从命令行获取参数
const args = process.argv.slice(2);
console.log('接收到的参数:', args);

if (args.length < 3) {
    console.error('请提供 name、moduleName 和 host 三个参数，格式：node update_monster_config.cjs <name> <moduleName> <host> [environment]');
    console.error('environment 参数: dev (开发环境) 或 prod (生产环境)，默认为 dev');
    process.exit(1);
}

const [name, moduleName, host, environment = 'dev'] = args;

// 验证环境参数
if (environment !== 'dev' && environment !== 'prod') {
    console.error(`错误：环境参数必须是 'dev' 或 'prod'，当前值: ${environment}`);
    process.exit(1);
}

// 根据环境设置 S3 Key 和 JSON URL
let s3Key;
let jsonUrl;

if (environment === 'prod') {
    s3Key = 'monster/miniapp_list_config_prod.json';
    jsonUrl = 'https://vsa-bucket-public-new.s3.us-east-1.amazonaws.com/monster/miniapp_list_config_prod.json';
} else {
    s3Key = 'monster/miniapp_list_config_debug.json';
    jsonUrl = 'https://vsa-bucket-public-new.s3.us-east-1.amazonaws.com/monster/miniapp_list_config_debug.json';
}

// 请替换为实际的S3存储桶信息
const s3Bucket = 'vsa-bucket-public-new';

console.log(`环境: ${environment}`);
console.log(`S3 Key: ${s3Key}`);
console.log(`JSON URL: ${jsonUrl}`);

// 初始化S3客户端
const s3Client = new S3Client({
    region: 'us-east-1' // 请替换为你的存储桶所在区域
});

// 从URL获取JSON数据
async function fetchJsonData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    // 支持单个对象或对象数组格式
                    const jsonData = JSON.parse(data);
                    // 统一处理为数组格式
                    resolve(Array.isArray(jsonData) ? jsonData : [jsonData]);
                } catch (error) {
                    reject(new Error(`解析JSON失败: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`获取JSON数据失败: ${error.message}`));
        });
    });
}

// 更新JSON数据
function updateJsonData(data, targetName, targetModuleName, newHost) {
    console.log("开始更新 JSON 数据");
    const index = data.findIndex(item => item.name === targetName && item.module_name === targetModuleName);
    
    if (index !== -1) {
        // 找到匹配项，更新host
        console.log("找到匹配项，更新 releaseUrl");
        data[index].releaseUrl = newHost;
        console.log(`已更新 "${targetName}" 的 releaseUrl 为: ${newHost}`);
    } else {
        console.log("未找到匹配项，添加新项");
        // 未找到匹配项，添加新项
        // 生成新的ID（最大ID+1）
        const maxId = data.reduce((max, item) => Math.max(max, parseInt(item.id, 10) || 0), 0);
        const newItem = {
            id: (maxId + 1).toString(),
            name: targetName,
            icon: "📌", // 默认图标
            color: "#000000", // 默认颜色
            miniAppType: "RN", // 默认类型
            host: newHost,
            module_name: targetModuleName.replace(/\s+/g, ''), // 简单处理为去掉空格的name
            category: "gaming", // 默认分类
            image: "", // 空图片
            releaseUrl: newHost // 发布地址
        };
        
        data.push(newItem);
        console.log(`已添加新项: ${JSON.stringify(newItem, null, 2)}`);
    }
    
    return data;
}

// 保存数据到S3
async function saveToS3(data) {
    try {
        const command = new PutObjectCommand({
            Bucket: s3Bucket,
            Key: s3Key,
            Body: JSON.stringify(data, null, 2),
            ContentType: 'application/json'
        });
        
        await s3Client.send(command);
        console.log(`成功将更新后的数据保存到S3: s3://${s3Bucket}/${s3Key}`);
    } catch (error) {
        throw new Error(`保存到S3失败: ${error.message}`);
    }
}

// 主函数
async function main() {
    try {
        console.log(`接收参数 - name: ${name}, moduleName: ${moduleName}, host: ${host}`);
        
        // 获取现有数据
        const jsonData = await fetchJsonData(jsonUrl);
        console.log('成功获取现有JSON数据');
        
        // 更新数据
        const updatedData = updateJsonData(jsonData, name, moduleName, host);
        
        // 保存到S3
        await saveToS3(updatedData);
        
        console.log('操作完成');
    } catch (error) {
        console.error('操作失败:', error.message);
        process.exit(1);
    }
}

// 执行主函数
main();

