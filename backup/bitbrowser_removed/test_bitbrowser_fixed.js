#!/usr/bin/env node

/**
 * 测试BitBrowser连接（修复代理问题）
 */

const axios = require('axios');
const fs = require('fs');

// 对于本地连接，不使用代理
process.env.NO_PROXY = 'localhost,127.0.0.1';

async function testBitBrowser() {
    console.log('🧪 测试BitBrowser连接（已修复代理问题）\n');
    
    const config = JSON.parse(fs.readFileSync('bitbrowser_config.json', 'utf-8'));
    
    try {
        // 1. 测试浏览器列表API
        console.log('1️⃣ 测试浏览器列表API...');
        const response = await axios.post(
            `${config.apiHost}:${config.apiPort}/browser/list`,
            { page: 0, pageSize: 10 },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey
                },
                timeout: 5000,
                // 明确指定不使用代理
                proxy: false
            }
        );
        
        console.log('✅ API连接成功！');
        console.log(`配置文件数量: ${response.data?.data?.totalNum || 0}`);
        
        // 2. 列出所有配置文件
        if (response.data?.data?.list) {
            console.log('\n📋 配置文件列表:');
            response.data.data.list.forEach((profile, index) => {
                console.log(`${index + 1}. ID: ${profile.id}`);
                console.log(`   代理类型: ${profile.proxyType}`);
                if (profile.proxyType !== 'noproxy') {
                    console.log(`   代理地址: ${profile.host}:${profile.port}`);
                }
                console.log(`   创建时间: ${profile.createdTime}`);
                console.log('');
            });
        }
        
        // 3. 找到有代理的配置文件
        const proxyProfile = response.data.data.list.find(p => p.proxyType !== 'noproxy');
        if (proxyProfile) {
            console.log('✅ 找到配置了代理的浏览器配置文件:');
            console.log(`   ID: ${proxyProfile.id}`);
            console.log(`   代理: ${proxyProfile.proxyType}://${proxyProfile.host}:${proxyProfile.port}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.code === 'ECONNRESET') {
            console.log('\n💡 提示: 请检查BitBrowser客户端是否正常运行');
        }
        return false;
    }
}

// 运行测试
if (require.main === module) {
    testBitBrowser()
        .then(success => {
            if (success) {
                console.log('\n🎉 BitBrowser API测试通过！');
                console.log('您可以开始使用AI检测功能了。');
            }
        })
        .catch(console.error);
}

module.exports = testBitBrowser;