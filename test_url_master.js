const IntelligentURLMaster = require('./intelligent_url_master.js');

async function test() {
    const master = new IntelligentURLMaster();
    // 只测试前3个网站
    master.websites = master.websites.slice(0, 3);
    await master.run();
}

test();