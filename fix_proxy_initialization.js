#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function fixProxyInitialization() {
    console.log('🔧 修复代理初始化问题...');
    
    try {
        // 读取代理配置
        const configPath = path.join(__dirname, 'proxy_config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
        
        console.log('📋 代理配置:');
        config.proxies.forEach((proxy, index) => {
            console.log(`  ${index + 1}. ${proxy.name} - ${proxy.type}://${proxy.host}:${proxy.port || ''}`);
        });
        
        // 创建新的代理状态
        const newStatus = {};
        
        config.proxies.forEach(proxy => {
            let key;
            if (proxy.type === 'direct') {
                key = 'direct';
            } else if (proxy.type === 'socks5' && proxy.auth) {
                key = `socks5://${proxy.auth.user}:${proxy.auth.pass}@${proxy.host}:${proxy.port}`;
            } else {
                key = `${proxy.type}://${proxy.host}:${proxy.port}`;
            }
            
            newStatus[key] = {
                usedToday: 0,
                totalUsed: 0,
                lastUsedTime: null,
                lastResetDate: new Date().toDateString(),
                isHealthy: true,
                failureCount: 0
            };
        });
        
        // 保存新的代理状态
        const statusPath = path.join(__dirname, 'proxy_status.json');
        await fs.writeFile(statusPath, JSON.stringify(newStatus, null, 2));
        
        console.log('✅ 代理状态已重置');
        console.log('📊 新的代理状态:');
        console.log(JSON.stringify(newStatus, null, 2));
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

// 运行修复
fixProxyInitialization();