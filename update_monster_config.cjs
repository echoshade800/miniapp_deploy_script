const fs = require('fs');
const path = require('path');
const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// 从命令行获取参数
const args = process.argv.slice(2);
console.log('接收到的参数:', args);

if (args.length < 1) {
    console.error('请提供 JSON 配置对象，格式：');
    console.error('node update_monster_config.cjs \'{"name":"...","moduleName":"...","releaseUrl":"...","environment":"..."}\'');
    process.exit(1);
}

// 解析 JSON 对象
let config;
try {
    config = JSON.parse(args[0]);
} catch (error) {
    console.error('解析 JSON 配置失败:', error.message);
    console.error('请确保传递的是有效的 JSON 字符串');
    process.exit(1);
}

const { name, moduleName, releaseUrl, environment = 'dev' } = config;

// 验证必需字段
if (!name || !moduleName || !releaseUrl) {
    console.error('配置对象缺少必需字段: name, moduleName, releaseUrl');
    console.error('当前配置:', JSON.stringify(config, null, 2));
    process.exit(1);
}

// 验证环境参数
if (environment !== 'dev' && environment !== 'prod') {
    console.error(`错误：环境参数必须是 'dev' 或 'prod'，当前值: ${environment}`);
    process.exit(1);
}

// 为了向后兼容，将 releaseUrl 赋值给 host
const host = releaseUrl;

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
function updateJsonData(data, config) {
    const { 
        name: targetName, 
        moduleName: targetModuleName, 
        releaseUrl: newHost, 
        icon, 
        color, 
        miniAppType, 
        category, 
        image,
        hot,
        tag,
        score
    } = config;
    console.log("开始更新 JSON 数据");
    const index = data.findIndex(item => item.name === targetName && item.module_name === targetModuleName);
    
    if (index !== -1) {
        // 找到匹配项，更新 releaseUrl 和其他字段（如果提供了）
        console.log("找到匹配项，更新配置");
        data[index].releaseUrl = newHost;
        if (icon !== undefined) data[index].icon = icon;
        if (color !== undefined) data[index].color = color;
        if (miniAppType !== undefined) data[index].miniAppType = miniAppType;
        if (category !== undefined) data[index].category = category;
        if (image !== undefined) data[index].image = image;
        if (hot !== undefined) data[index].hot = hot;
        if (tag !== undefined) data[index].tag = tag;
        if (score !== undefined) data[index].score = score;
        console.log(`已更新 "${targetName}" 的配置`);
    } else {
        console.log("未找到匹配项，添加新项");
        // 未找到匹配项，添加新项
        // 生成新的ID（最大ID+1）
        const maxId = data.reduce((max, item) => Math.max(max, parseInt(item.id, 10) || 0), 0);
        const newItem = {
            id: (maxId + 1).toString(),
            name: targetName,
            icon: icon || "📌", // 使用配置中的图标，或默认图标
            color: color || "#000000", // 使用配置中的颜色，或默认颜色
            miniAppType: miniAppType || "RN", // 使用配置中的类型，或默认类型
            host: newHost,
            module_name: targetModuleName.replace(/\s+/g, ''), // 简单处理为去掉空格的name
            category: category || "gaming", // 使用配置中的分类，或默认分类
            image: image || "", // 使用配置中的图片，或空图片
            releaseUrl: newHost, // 发布地址
            hot: hot !== undefined ? hot : false, // 使用配置中的 hot，或默认 false
            tag: tag || [], // 使用配置中的 tag，或默认空数组
            score: score || "" // 使用配置中的 score，或默认空字符串
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
        console.log(`接收参数 - name: ${name}, moduleName: ${moduleName}, releaseUrl: ${releaseUrl}, environment: ${environment}`);
        if (config.icon !== undefined) console.log(`  icon: ${config.icon}`);
        if (config.color !== undefined) console.log(`  color: ${config.color}`);
        if (config.miniAppType !== undefined) console.log(`  miniAppType: ${config.miniAppType}`);
        if (config.category !== undefined) console.log(`  category: ${config.category}`);
        if (config.image !== undefined) console.log(`  image: ${config.image}`);
        if (config.hot !== undefined) console.log(`  hot: ${config.hot}`);
        if (config.tag !== undefined) console.log(`  tag: ${JSON.stringify(config.tag)}`);
        if (config.score !== undefined) console.log(`  score: ${config.score}`);
        
        // 获取现有数据
        const jsonData = await fetchJsonData(jsonUrl);
        console.log('成功获取现有JSON数据');
        
        // 更新数据（传递完整的 config 对象）
        const updatedData = updateJsonData(jsonData, config);
        
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

