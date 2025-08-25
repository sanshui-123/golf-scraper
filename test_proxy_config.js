#!/usr/bin/env node

const axios = require('axios');

async function testProxy() {
    // 这里填入你的实际代理配置
    const proxyConfigs = [
        {
            name: "无代理（直连）",
            type: "noproxy",
            config: null
        },
        {
            name: "SOCKS5代理示例",
            type: "socks5",
            config: {
                host: "你的代理IP",  // 替换为实际IP
                port: 1080,          // 替换为实际端口
                auth: {
                    username: "",    // 如需认证
                    password: ""     // 如需认证
                }
            }
        }
    ];
    
    console.log('测试代理配置...\n');
    
    for (const proxy of proxyConfigs) {
        console.log(`测试: ${proxy.name}`);
        console.log(`类型: ${proxy.type}`);
        
        if (proxy.config) {
            console.log(`地址: ${proxy.config.host}:${proxy.config.port}`);
            
            // 这里可以添加实际的代理测试逻辑
            // 比如通过代理访问 httpbin.org/ip 来验证
        }
        
        console.log('---\n');
    }
    
    console.log('💡 提示：');
    console.log('1. 确保代理服务器正在运行');
    console.log('2. 检查防火墙是否允许连接');
    console.log('3. 验证用户名密码是否正确');
    console.log('4. 某些代理可能需要特定的加密方式');
}

testProxy().catch(console.error);