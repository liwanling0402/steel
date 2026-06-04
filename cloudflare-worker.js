/**
 * Cloudflare Worker - 聚合数据快递查询 API 代理
 * 
 * 接口: https://v.juhe.cn/exp/index
 * 前端发送: { com: "快递公司编码", no: "快递单号" }
 * Worker 自动拼接 key 并转发，解决 CORS 跨域问题
 */

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Only POST allowed', { 
        status: 405,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    try {
      // 读取前端发来的 JSON 参数
      const params = await request.json();
      const com = params.com || '';
      const no = params.no || '';

      // 聚合数据 AppKey（去 https://www.juhe.cn/docs/api/id/43 申请）
      const JUHE_APP_KEY = 'YOUR_JUHE_APP_KEY_HERE';

      // 构建 URL
      const url = `https://v.juhe.cn/exp/index?key=${encodeURIComponent(JUHE_APP_KEY)}&com=${encodeURIComponent(com)}&no=${encodeURIComponent(no)}&dtype=json`;

      // 转发到聚合数据 API
      const juheResponse = await fetch(url, {
        method: 'GET',
      });

      const responseData = await juheResponse.text();
      
      return new Response(responseData, {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ resultcode: '500', reason: '代理错误: ' + err.message }),
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
