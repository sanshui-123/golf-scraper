#!/usr/bin/env node

/**
 * 自动查找比特浏览器API端口
 */

const axios = require('axios');

async function findBitBrowserPort() {
    console.log('🔍 正在扫描比特浏览器API端口...\n');
    
    // 常见的端口范围
    const commonPorts = [
        54345, 54346, 54347, 54348, 54349,  // 默认端口范围
        9222, 9223, 9224, 9225,              // Chrome调试端口
        8080, 8081, 8082,                    // 通用端口
        3000, 3001, 3002,                    // 开发端口
        50000, 50001, 50002,                 // 其他可能端口
    ];
    
    const foundPorts = [];
    
    for (const port of commonPorts) {
        process.stdout.write(`测试端口 ${port}... `);
        
        try {
            const response = await axios.get(`http://127.0.0.1:${port}/browser/list`, {
                timeout: 1000
            });
            
            if (response.data) {
                console.log('✅ 找到API服务！');
                foundPorts.push({
                    port: port,
                    type: 'API',
                    response: response.data
                });
            }
        } catch (error) {
            // 尝试WebSocket端点
            try {
                const wsResponse = await axios.get(`http://127.0.0.1:${port}/json/version`, {
                    timeout: 1000
                });
                
                if (wsResponse.data) {
                    console.log('✅ 找到WebSocket服务！');
                    foundPorts.push({
                        port: port,
                        type: 'WebSocket',
                        response: wsResponse.data
                    });
                } else {
                    console.log('❌');
                }
            } catch (e) {
                console.log('❌');
            }
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('扫描结果：');
    console.log('='.repeat(50));
    
    if (foundPorts.length > 0) {
        console.log(`\n✅ 找到 ${foundPorts.length} 个活跃端口：\n`);
        
        foundPorts.forEach(item => {
            console.log(`端口 ${item.port} - ${item.type} 服务`);
            if (item.type === 'API' && item.response.data) {
                console.log(`  配置文件数: ${item.response.data.list ? item.response.data.list.length : '未知'}`);
            }
        });
        
        console.log('\n请更新 bitbrowser_config.json 中的端口配置：');
        const apiPort = foundPorts.find(p => p.type === 'API');
        if (apiPort) {
            console.log(`  "apiPort": ${apiPort.port}`);
        }
        const wsPort = foundPorts.find(p => p.type === 'WebSocket');
        if (wsPort) {
            console.log(`  "wsPort": ${wsPort.port}`);
        }
    } else {
        console.log('\n❌ 未找到比特浏览器API服务\n');
        console.log('可能的原因：');
        console.log('1. 比特浏览器未启动或API服务未启用');
        console.log('2. 使用了非标准端口');
        console.log('3. 防火墙阻止了连接\n');
        console.log('请在比特浏览器中：');
        console.log('1. 点击"API对接文档"按钮');
        console.log('2. 查看并启用本地API服务');
        console.log('3. 记录正确的端口号');
    }
}

// 运行扫描
findBitBrowserPort().catch(console.error);