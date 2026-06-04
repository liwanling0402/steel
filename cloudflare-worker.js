/**
 * Cloudflare Worker - 快递鸟 API 代理
 * 
 * 部署方法：
 * 1. 打开 https://dash.cloudflare.com/ 
 * 2. 左侧菜单 Workers & Pages → Create application → Create Worker
 * 3. 点击 "Edit code"，把这段代码粘贴进去
 * 4. 点击右上角 "Deploy" 
 * 5. 记住你的 Worker URL（如 https://kdn-proxy.你的用户名.workers.dev）
 * 6. 把 URL 填入 logistics.html 的 KDN_PROXY_URL 变量
 */

export default {
  async fetch(request) {
    // 只允许 POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // 读取前端发来的请求体
      const body = await request.text();

      // 转发到快递鸟 API
      const kdnResponse = await fetch(
        'https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: body,
        }
      );

      const data = await kdnResponse.text();

      // 返回给前端
      return new Response(data, {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ Success: false, Reason: '代理请求失败: ' + err.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
