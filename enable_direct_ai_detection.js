#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function enableDirectAIDetection() {
    console.log('🔧 配置AI检测使用直连模式...');
    
    try {
        // 读取代理配置
        const configPath = path.join(__dirname, 'proxy_config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
        
        // 修改配置：禁用智能管理，使用直连模式
        config.smartConfig = config.smartConfig || {};
        config.smartConfig.enableSmartManagement = false;
        
        // 确保直连模式在第一位
        const directProxy = config.proxies.find(p => p.type === 'direct');
        if (directProxy) {
            config.proxies = [
                directProxy,
                ...config.proxies.filter(p => p.type !== 'direct')
            ];
        }
        
        // 保存配置
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log('✅ 已配置为直连模式');
        console.log('📝 智能管理已禁用');
        
        // 创建简单的代理配置文件
        const simpleConfig = {
            proxies: [
                {
                    type: "direct",
                    name: "直连模式（默认）",
                    description: "不使用代理，直接连接"
                }
            ]
        };
        
        await fs.writeFile(
            path.join(__dirname, 'proxy_config_simple.json'), 
            JSON.stringify(simpleConfig, null, 2)
        );
        
        console.log('✅ 简单配置已更新');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

// 运行配置
enableDirectAIDetection();