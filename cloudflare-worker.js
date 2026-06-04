/**
 * Cloudflare Worker - 快递鸟 API 代理（Worker 端签名版）
 * 
 * 前端只需发送: { ShipperCode, LogisticCode }
 * Worker 自动完成签名并转发到快递鸟
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
      const shipperCode = params.ShipperCode || '';
      const logisticCode = params.LogisticCode || '';

      // 快递鸟配置（在 Worker 环境变量中设置更安全）
      const EBUSINESS_ID = '1923623';
      const API_KEY = '55953650-60be-4564-b242-7cf7f0299706';

      // 构建 RequestData
      const requestDataObj = {
        OrderCode: '',
        ShipperCode: shipperCode,
        LogisticCode: logisticCode
      };
      const requestData = JSON.stringify(requestDataObj);

      // 签名算法
      const cleaned = requestData.replace(/: /g, ':').replace(/, /g, ',');
      const signStr = cleaned + API_KEY;
      
      // MD5
      const encoder = new TextEncoder();
      const data = encoder.encode(signStr);
      const hashBuffer = await crypto.subtle.digest('MD5', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const md5Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Base64
      const bytes = new Uint8Array(md5Hash.split('').map(c => c.charCodeAt(0)));
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      const dataSign = btoa(binary);

      // 构建表单数据
      const formData = new URLSearchParams();
      formData.append('RequestData', requestData);
      formData.append('EBusinessID', EBUSINESS_ID);
      formData.append('RequestType', '1002');
      formData.append('DataSign', dataSign);
      formData.append('DataType', '2');

      // 转发到快递鸟 API
      const kdnResponse = await fetch(
        'https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: formData.toString(),
        }
      );

      const responseData = await kdnResponse.text();
      
      return new Response(responseData, {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ Success: false, Reason: '代理错误: ' + err.message }),
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
