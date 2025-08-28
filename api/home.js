// 强制覆盖主页，确保显示管理系统而不是测试页面
const app = require('./index.js');

module.exports = (req, res) => {
    // 直接调用Express应用处理请求
    app(req, res);
};