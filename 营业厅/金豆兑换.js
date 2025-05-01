// 金豆兑换脚本 - 优化版

// ============= 配置区域 =============
// 抢兑个数设置：1(只抢最高面值)或2(抢所有可兑换面值)
let qdgs = 2;
// 每个兑换请求的重复次数(提高成功率)
let runNumber = 2;
// 兑换场次时间设置(格式: HH:MM:SS:SSS)
const targetTimes = ['09:59:57:900', '13:59:57:900']; // 提前3秒开始兑换

// WxPusher配置(消息推送服务)
const wxPusherConfig = {
  appToken: 'AT_xxxxxxxxxx', // 替换为你的WxPusher AppToken
  uid: 'UID_xxxxxxxx',      // 替换为你的用户UID
  apiUrl: 'http://wxpusher.zjiecode.com/api/send/message'
};

// ============= 依赖引入 =============
const tool = require('./tools/tool.js');
const moment = require('moment');
const axios = require('axios').default;
const fs = require('fs');
const CryptoJS = require('crypto-js');
const JSEncrypt = require('node-jsencrypt');

// ============= 全局变量 =============
let userPhone = []; // 存储用户账号信息
let Cache = {}; // 用户登录缓存
let CacheRunJs = 'CacheRunJs.js'; // 缓存文件名
let ruisuConetnt; // 加密内容
let runUser = []; // 待兑换用户列表
let initialCookie = {}; // 初始Cookie
let runAxiosList = []; // 兑换请求列表
let executed = new Set(); // 已执行标记

// RSA公钥
let pubKey = `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDBkLT15ThVgz6/NOl6s8GNPofdWzWbCkWnkaAm7O2LjkM1H7dMvzkiqdxU02jamGRHLX/ZNMCXHnPcW/sDhiFCBN18qFvy8g6VYb9QtroI09e176s+ZCtiv7hbin2cCTj99iUpnEloZm19lwHyo69u5UMiPMpq0/XKBO8lYhN/gwIDAQAB`;
const decrypt = new JSEncrypt();
decrypt.setPrivateKey(pubKey);

// ============= 初始化部分 =============

// 从环境变量加载用户账号
if (process?.env?.dx) {
  process?.env?.dx.split('\n').map(item => {
    if (item) {
      let phone = item.split('#')[0];
      let password = item.split('#')[1];
      userPhone.push({ phone, password });
    }
  });
} else {
  console.log('未找到环境变量，请设置环境变量dx');
  process.exit();
}

// 读取加密文件
try {
  ruisuConetnt = fs.readFileSync('ruisu.js', 'utf8');
} catch (error) {
  console.error('读取加密文件错误:', error);
  process.exit();
}

// ============= 工具函数 =============

/**
 * 初始化Cookie
 * @param {string} url 请求URL
 * @returns {Promise} 包含cookie和刷新函数的对象
 */
function initCookie(url = 'https://wapact.189.cn:9001/gateway/standExchange/detailNew/exchange') {
  return new Promise((resolve, reject) => {
    axios.post(url).then(res => {
      reject(new Error('Unexpected response'));
    }).catch(async (err) => {
      try {
        let htmls = String(err.response.data);
        let cookie = err.response.headers['set-cookie'][0].split(';')[0] + ';';
        let cfarr = htmls.split(' content="')[2] ? 
          htmls.split(' content="')[2].split('" r=') : 
          htmls.split(' content="')[1].split('" r=');
        
        let content = 'content="' + cfarr[0] + '"';
        let newContent = ruisuConetnt.replace('content="content_code"', content);
        let code1 = htmls.split('$_ts=window')[1].split('</script><script type="text/javascript"')[0];
        let code1Content = '$_ts=window' + code1;
        let Url = htmls.split('$_ts.lcd();</script><script type="text/javascript" charset="utf-8" src="')[1].split('" r=')[0];
        
        const parsedUrl = new URL(url);
        let downloadUrl = parsedUrl.origin + Url;

        fs.access(CacheRunJs, fs.constants.F_OK, async (err) => {
          let CacheRunData = '';
          if (err) {
            console.log('缓存文件不存在，从远程下载');
            CacheRunData = await downloadFile(downloadUrl, CacheRunJs);
          } else {
            CacheRunData = fs.readFileSync(CacheRunJs, 'utf8');
          }
          
          newContent = newContent + code1Content + CacheRunData + " return document.cookie.split(';')[0]";
          const RefreshCookie = new Function(newContent);
          resolve({ cookie, RefreshCookie });
        });
      } catch (err) {
        console.error('初始化Cookie失败:', err);
        initCookie().then(resolve).catch(reject);
      }
    });
  });
}

/**
 * 下载文件
 * @param {string} url 文件URL
 * @param {string} filePath 保存路径
 * @returns {Promise} 文件内容
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    axios({
      method: 'GET',
      url,
    }).then(response => {
      try {
        fs.writeFileSync(filePath, response.data, 'utf8');
        resolve(response.data);
      } catch (error) {
        console.error('写入文件错误:', error);
        reject(error);
      }
    }).catch(error => {
      console.error('下载文件错误:', error);
      reject(error);
    });
  });
}

/**
 * AES ECB加密
 * @param {string} plaintext 明文
 * @param {string} key 密钥
 * @returns {string} 加密结果
 */
function aesEcbEncrypt(plaintext, key) {
  if (![16, 24, 32].includes(key.length)) {
    throw new Error("密钥长度必须为16/24/32字节");
  }

  const keyBytes = CryptoJS.enc.Utf8.parse(key);
  const encrypted = CryptoJS.AES.encrypt(plaintext, keyBytes, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
}

/**
 * 发送WxPusher通知
 * @param {string} content 通知内容
 * @returns {Promise} 发送结果
 */
function sendWxPusher(content) {
  const data = {
    appToken: wxPusherConfig.appToken,
    content,
    contentType: 1,
    uids: [wxPusherConfig.uid]
  };

  return axios.post(wxPusherConfig.apiUrl, data)
    .then(res => console.log('推送发送成功:', res.data))
    .catch(err => console.error('推送发送失败:', err));
}

// ============= 核心功能函数 =============

/**
 * 手机号登录
 * @param {string} phone 手机号
 * @param {string} password 密码
 * @returns {Promise} 用户信息
 */
async function loginPhone(phone, password) {
  try {
    let timestamp = tool.TIMEstamp();
    let rdmstr = tool.randomString(16);
    let encrypttext = decrypt.encrypt(`iPhone 14 15.4.${rdmstr.substring(0, 12)}${phone}${timestamp}${password}0$$$0.`);
    
    // 处理手机号格式
    let strphone = '';
    for (let a of phone) {
      if (a <= 7) {
        strphone += String(Number(a) + 2);
      } else {
        strphone += a == 8 ? ':' : ';';
      }
    }

    // 构造登录数据
    let data = {
      "headerInfos": {
        "code": "userLoginNormal",
        "timestamp": timestamp,
        "broadAccount": "",
        "broadToken": "",
        "clientType": "#9.6.1#channel50#iPhone 14 Pro Max#",
        "shopId": "20002",
        "source": "110003",
        "sourcePassword": "Sid98s",
        "token": "",
        "userLoginName": phone
      },
      "content": {
        "attach": "test",
        "fieldData": {
          "loginType": "4",
          "accountType": "",
          "loginAuthCipherAsymmertric": encrypttext,
          "deviceUid": rdmstr,
          "phoneNum": strphone,
          "isChinatelecom": "0",
          "systemVersion": "15.4.0",
          "authentication": password
        }
      }
    };

    // 检查缓存或发起登录请求
    if (!Cache[phone]) {
      let options = {
        url: 'https://appgologin.189.cn:9031/login/client/userLoginNormal',
        method: 'POST',
        data: data
      };
      let res = await axios(options);
      Cache[phone] = { ...res.data.responseData.data.loginSuccessResult };
      fs.writeFileSync('./Cache.json', JSON.stringify(Cache), 'utf8');
    }

    let userInfo = { ...Cache[phone] };
    let userToken = Cache[phone].token;
    let userId = Cache[phone].userId;
    timestamp = tool.TIMEstamp();

    // 获取ticket
    let ticketData = `<Request>
      <HeaderInfos>
        <Code>getSingle</Code>
        <Timestamp>${timestamp}</Timestamp>
        <BroadAccount></BroadAccount>
        <BroadToken></BroadToken>
        <ClientType>#9.6.1#channel50#iPhone 14 Pro Max#</ClientType>
        <ShopId>20002</ShopId>
        <Source>110003</Source>
        <SourcePassword>Sid98s</SourcePassword>
        <Token>${userToken}</Token>
        <UserLoginName>${phone}</UserLoginName>
      </HeaderInfos>
      <Content>
        <Attach>test</Attach>
        <FieldData>
          <TargetId>${tool.encrypt_req('1234567`90koiuyhgtfrdewsaqaqsqde', '', userId)}</TargetId>
          <Url>4a6862274835b451</Url>
        </FieldData>
      </Content>
    </Request>`;

    let options = {
      url: `https://appgologin.189.cn:9031/map/clientXML`,
      method: 'post',
      data: ticketData,
      headers: { 'Content-Type': 'application/xml;charset=utf-8' }
    };

    let titckRes = await axios(options);
    
    // 处理token过期情况
    if (String(titckRes.data).includes('过期') || String(titckRes.data).includes('校验错误')) {
      console.log('Token过期，重新登录...');
      delete Cache[phone];
      return await loginPhone(phone, password);
    }

    let tickettext = titckRes.data.split('<Ticket>')[1].split('</Ticket>')[0];
    let uid = tool.decrypt_req('1234567`90koiuyhgtfrdewsaqaqsqde', '', tickettext);
    
    userInfo.uid = uid;
    userInfo.password = password;
    userInfo.phoneNbr = phone;
    return userInfo;
  } catch (e) {
    console.error('登录失败:', e);
    return false;
  }
}

/**
 * 用户登录金豆系统
 * @param {object} userInfo 用户信息
 * @param {object} instance axios实例
 */
async function userLogin(userInfo, instance) {
  try {
    let loginData = {
      "ticket": userInfo.uid,
      "backUrl": "https%3A%2F%2Fwapact.189.cn%3A9001",
      "platformCode": "P201010301",
      "loginType": 2
    };

    const encryptedData = aesEcbEncrypt(JSON.stringify(loginData), 'telecom_wap_2018');

    let options = {
      url: 'https://wapact.189.cn:9001/unified/user/login',
      method: 'POST',
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        Cookie: initialCookie.cookie + initialCookie.RefreshCookie(),
      },
      transformRequest: function(data, headers) {
        const hasJSONContentType = () => {
          const contentType = (headers && headers['Content-Type']) || '';
          return contentType.indexOf('application/json') > -1;
        };
        if (typeof data === 'string' && hasJSONContentType()) {
          return data;
        }
      },
      data: encryptedData
    };

    instance(options).then(res => {
      instance.defaults.headers.Authorization = "Bearer " + res.data.biz.token;
      userInfo.Authorization = "Bearer " + res.data.biz.token;
      queryInfo(userInfo, instance);
    }).catch((err) => {
      console.error('登录金豆系统失败:', err);
    });
  } catch (e) {
    console.error('用户登录异常:', e);
  }
}

/**
 * 查询用户金豆信息
 * @param {object} userInfo 用户信息
 * @param {object} instance axios实例
 */
function queryInfo(userInfo, instance) {
  try {
    let options = {
      url: 'https://wapact.189.cn:9001/gateway/golden/api/queryInfo',
      method: 'get',
      headers: {
        Cookie: initialCookie.cookie + initialCookie.RefreshCookie(),
      }
    };
    
    instance(options).then(res => {
      console.log(`${maskPhone(userInfo.phoneNbr)} 金豆余额: ${res.data.biz.amountTotal}`, tool.TIMEstamp1());
      userInfo.amountTotal = res.data.biz.amountTotal;
      queryBigDataAppGetOrInfo(userInfo, instance);
    }).catch((err) => {
      console.error('查询金豆信息失败:', err);
    });
  } catch (e) {
    console.error('查询信息异常:', e);
    queryInfo(userInfo, instance);
  }
}

/**
 * 查询可兑换商品信息
 * @param {object} userInfo 用户信息
 * @param {object} instance axios实例
 */
async function queryBigDataAppGetOrInfo(userInfo, instance) {
  try {
    let options = {
      url: 'https://wapact.189.cn:9001/gateway/golden/goldGoods/getGoodsList?userType=1&page=1&order=3&tabOrder=1',
      method: 'get',
      headers: {
        Cookie: initialCookie.cookie + initialCookie.RefreshCookie(),
      }
    };
    
    let signData = await ssoHomLogin(userInfo.uid);
    let RecordsInfo = await getCoinMallExchangetRecords(signData, userInfo);
    let dhlb = [];
    
    // 获取当月已兑换话费券
    const currentMonth = new Date().getMonth();
    RecordsInfo.data.map(item => {
      if (item.createdDate && String(item.title).includes('话费')) {
        const createdMonth = new Date(item.createdDate).getMonth();
        if (createdMonth === currentMonth) {
          dhlb.push(item.title);
        }
      }
    });
    
    console.log(`${maskPhone(userInfo.phoneNbr)} 当月已兑换: ${dhlb.join(',')}`, tool.TIMEstamp1());
    
    instance(options).then(res => {
      let runArr = [];
      const now = new Date();
      const currentHour = now.getHours();
      
      // 筛选可兑换商品
      res.data.biz.ExchangeGoodslist.forEach((item) => {
        const isRedeemed = dhlb.includes(item.title);
        if (!isRedeemed) {
          const amount = Number(item.amount.match(/\d+/)[0]);
          if (amount <= userInfo.amountTotal) {
            if (currentHour < 13) {
              if (String(item.title).includes('0.5元') || String(item.title).includes('5元')) {
                runArr.push(item);
              }
            } else {
              if (String(item.title).includes('1元') || String(item.title).includes('10元')) {
                runArr.push(item);
              }
            }
          }
        }
      });
      
      console.log(`${maskPhone(userInfo.phoneNbr)} 可兑换: ${runArr.map(item => item.title)}`, tool.TIMEstamp1());
      
      // 根据配置添加兑换任务
      runArr.forEach((item, index) => {
        if (qdgs == 1 && index == runArr.length - 1) {
          runUser.push({ userInfo, item });
        } else if (qdgs == 2) {
          runUser.push({ userInfo, item });
        }
      });
    }).catch((err) => {
      console.error('查询商品列表失败:', err);
    });
  } catch (e) {
    console.error('查询商品信息异常:', e);
    queryBigDataAppGetOrInfo(userInfo, instance);
  }
}

/**
 * SSO登录
 * @param {string} ticket 票据
 * @returns {Promise} 登录结果
 */
async function ssoHomLogin(ticket) {
  try {
    let options = {
      url: 'https://wappark.189.cn/jt-sign/ssoHomLogin?ticket=' + ticket,
      method: 'GET',
      headers: {
        Cookie: initialCookie.cookie + initialCookie.RefreshCookie(),
      }
    };
    let res = await axios(options);
    return res.data;
  } catch (e) {
    console.error('SSO登录失败:', e);
    return await ssoHomLogin(ticket);
  }
}

/**
 * 获取兑换记录
 * @param {object} signData 签名数据
 * @param {object} userInfo 用户信息
 * @returns {Promise} 兑换记录
 */
async function getCoinMallExchangetRecords(signData, userInfo) {
  try {
    let data = {
      accId: signData.accId,
      page: 0,
      size: 100
    };
    
    let options = {
      url: 'https://wappark.189.cn/jt-sign/paradise/getCoinMallExchangetRecords',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        sign: signData.sign,
        Cookie: initialCookie.cookie + initialCookie.RefreshCookie(),
      },
      data: {
        para: tool.encrypt_rsa_hex(data)
      }
    };
    
    let res = await axios(options);
    return res.data;
  } catch (e) {
    console.error('获取兑换记录失败:', e);
    return await getCoinMallExchangetRecords(signData, userInfo);
  }
}

/**
 * 主函数 - 处理单个用户
 * @param {string} phone 手机号
 * @param {string} password 密码
 */
async function main(phone, password) {
  let instance = axios.create({
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
      "Referer": "https://wapact.189.cn:9001/JinDouMall/JinDouMall_independentDetails.html",
    }
  });

  // 请求拦截器
  instance.interceptors.request.use(config => {
    config.headers.Cookie = initialCookie.cookie + initialCookie.RefreshCookie();
    return config;
  }, error => {
    return Promise.reject(error);
  });

  // 登录并处理用户
  let res = await loginPhone(phone, password);
  if (!res) return;
  userLogin(res, instance);
}

/**
 * 获取所有用户并初始化
 */
async function getUser() {
  try {
    Cache = JSON.parse(fs.readFileSync('./Cache.json', 'utf8'));
  } catch (error) {
    fs.writeFileSync('./Cache.json', JSON.stringify({}), 'utf8');
    Cache = JSON.parse(fs.readFileSync('./Cache.json', 'utf8'));
  }
  
  initialCookie = await initCookie();
  console.log('获取账号成功', userPhone.length, tool.TIMEstamp1());
  userPhone.forEach(item => {
    main(item.phone, item.password);
  });
}

/**
 * 手机号脱敏处理
 * @param {string} phone 手机号
 * @returns {string} 脱敏后的手机号
 */
function maskPhone(phone) {
  return String(phone).replace(/^(.{3})(.*)(.{4})$/, "$1****$3");
}

/**
 * 等待特定时间执行兑换
 * @param {function} callback 回调函数
 */
function waitForSpecificTime(callback) {
  const now = new Date();
  let targetHour, targetMinute, targetSecond, targetMillisecond;
  
  // 根据当前时间选择上午场或下午场
  if (now.getHours() <= 12) {
    [targetHour, targetMinute, targetSecond, targetMillisecond] = targetTimes[0].split(':').map(Number);
  } else {
    [targetHour, targetMinute, targetSecond, targetMillisecond] = targetTimes[1].split(':').map(Number);
  }
  
  let targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                          targetHour, targetMinute, targetSecond, targetMillisecond);
  
  // 如果已经过了目标时间，设置为明天的同一时间
  if (now >= targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const timeDifference = targetTime - now;
  console.log(`等待 ${timeDifference} 毫秒直到 ${targetHour}:${targetMinute}:${targetSecond}.${targetMillisecond}`);
  
  setTimeout(callback, timeDifference);
}

/**
 * 执行兑换请求
 */
async function runExchange() {
  console.time('exchangeTime');
  
  // 准备所有兑换请求
  runUser.forEach(userItem => {
    console.log(`${maskPhone(userItem.userInfo.phoneNbr)} 加入抢兑 ${userItem.item.title}`);
    for (let i = 0; i < runNumber; i++) {
      runAxiosList.push(() => axios({
        url: 'https://wapact.189.cn:9001/gateway/standExchange/detailNew/exchange',
        method: 'POST',
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
          "Referer": "https://wapact.189.cn:9001/JinDouMall/JinDouMall_independentDetails.html",
          Cookie: initialCookie.cookie + initialCookie.RefreshCookie(),
          Authorization: userItem.userInfo.Authorization
        },
        data: {
          "activityId": userItem.item.id
        }
      }));
    }
  });
  
  console.log('抢兑列表个数:', runUser.length);
  console.log('抢兑请求个数:', runAxiosList.length);
  console.log('开始执行兑换...', tool.TIMEstamp1());
  
  try {
    const results = await Promise.allSettled(runAxiosList.map(fn => fn()));
    let successCount = 0;
    let errorCount = 0;
    let exchangeSuccess = 0;
    let successDetails = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        if (result.value.data?.biz?.resultCode == '0') {
          exchangeSuccess++;
          successDetails.push({
            phone: maskPhone(runUser[Math.floor(index/runNumber)].userInfo.phoneNbr),
            item: runUser[Math.floor(index/runNumber)].item.title
          });
        }
      } else {
        errorCount++;
      }
    });
    
    console.log('请求统计:');
    console.log('成功请求:', successCount);
    console.log('失败请求:', errorCount);
    console.log('兑换成功:', exchangeSuccess);
    console.timeEnd('exchangeTime');
    
    // 发送微信通知
    if (exchangeSuccess > 0) {
      let message = `金豆兑换成功 ${exchangeSuccess} 次\n`;
      successDetails.forEach(detail => {
        message += `${detail.phone} 成功兑换 ${detail.item}\n`;
      });
      await sendWxPusher(message);
    } else {
      await sendWxPusher('本次金豆兑换未成功，请检查日志');
    }
  } catch (error) {
    console.error('兑换执行出错:', error);
    await sendWxPusher('金豆兑换执行过程中出错，请检查日志');
  } finally {
    process.exit();
  }
}

// ============= 脚本执行 =============

// 初始化并获取用户
getUser();

// 设置定时器准备兑换
setTimeout(() => {
  console.log('兑换列表加载完成，等待兑换时间...');
  waitForSpecificTime(runExchange);
}, 55000);