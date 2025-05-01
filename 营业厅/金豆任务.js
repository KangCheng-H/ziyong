const originalLog = console.log;
console.log = function (...args) {
    const date = new Date();
    const timestamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-') + ' ' + [
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0'),
        String(date.getSeconds()).padStart(2, '0')
    ].join(':');
    originalLog(`[${timestamp}] ${args.map(String).join(' ')}`);
};
const tool = require('./tools/tool.js')
const getCookie = require('./tools/index.js')
const axios = require('axios').default
const CryptoJS = require('crypto-js');
const fs = require('fs')
const JSEncrypt = require('node-jsencrypt');
let pubKey = `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDBkLT15ThVgz6/NOl6s8GNPofdWzWbCkWnkaAm7O2LjkM1H7dMvzkiqdxU02jamGRHLX/ZNMCXHnPcW/sDhiFCBN18qFvy8g6VYb9QtroI09e176s+ZCtiv7hbin2cCTj99iUpnEloZm19lwHyo69u5UMiPMpq0/XKBO8lYhN/gwIDAQAB`
const decrypt = new JSEncrypt(); // 创建加密对象实例
decrypt.setPrivateKey(pubKey)

let userPhone = []
if (process?.env?.dx) {
    process?.env?.dx.split('\n').map(item => {
        if (item) {
            let phone = item.split('#')[0]
            let password = item.split('#')[1]
            userPhone.push({ phone, password })
        }
    })
} else {
    console.log('未找到环境变量，请设置环境变量dx')
    return
}

let initialCookie = {}
let jml_tokenFlag = ''
let CacheRunJs = 'Cache.js'
let Cache = {}
let ChacePath = 'Cache.json'
let chinaTelecomAccount = []
let filePath='./tools/runCookie.js'
let ruishuConetnt
try {
    ruishuConetnt = fs.readFileSync('ruisu.js', 'utf8');
} catch (error) {
    console.error('Error reading the file:', error);
    return
}


// if (process?.env?.dx) {
//     chinaTelecomAccount = process.env.dx.split('\n')
// } else {
//     console.log('请在环境变量中添加----dx')
//     return
// }

function initCookie(url = 'https://wapact.189.cn:9001/gateway/standExchange/detailNew/exchange') {
    return new Promise((resolve, reject) => {
        axios.post(url).then(res => {
        }).catch(async (err) => {
            try {
                let htmls = String(err.response.data)
                let cookie = err.response.headers['set-cookie'][0].split(';')[0] + ';'
                let cfarr = htmls.split(' content="')[2].split('" r=')
                let content = 'content="' + cfarr[0] + '"'
                let newContent = ruishuConetnt.replace('content="content_code"', content)
                let code1 = htmls.split('$_ts=window')[1].split('</script><script type="text/javascript"')[0]
                let code1Content = '$_ts=window' + code1
                let Url = htmls.split('$_ts.lcd();</script><script type="text/javascript" charset="utf-8" src="')[1].split('" r=')[0]
                const parsedUrl = new URL(url);
                let downloadUrl = parsedUrl.origin + Url
                // let fileData=(await axios.get(downloadUrl)).data
                fs.access(CacheRunJs, fs.constants.F_OK, async (err) => {
                    let CacheRunData = ''
                    if (err) {
                        // 文件不存在，从远程下载
                        console.log('文件不存在，从远程下载');

                        CacheRunData = await downloadFile(downloadUrl, CacheRunJs);
                    } else {
                        // 文件存在，读取文件内容
                        CacheRunData = fs.readFileSync(CacheRunJs, 'utf8');

                    }
                    newContent = newContent + code1Content + CacheRunData + " return document.cookie.split(';')[0]"
                    const RefreshCookie = new Function(newContent);
                    // console.log(cookie, RefreshCookie);
                    resolve({
                        cookie,
                        RefreshCookie
                    })
                });
            } catch (err) {
                initCookie()
            }
        })
    })
}

function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        // 下载文件并写入到本地
        axios({
            method: 'GET',
            url,
        }).then(response => {
            // console.log(response.data);
            try {
                // 写入文件
                fs.writeFileSync(filePath, response.data, 'utf8');

            } catch (error) {
                console.error('写入文件时出错：', error);
            }
            resolve(response.data)
        }).catch(error => {
            console.error('下载文件时出错：', error);
        });
    })
}

async function loginPhone(phone, password) {
    try {
        let timestamp = tool.TIMEstamp()
        let rdmstr = tool.randomString(16)
        // console.log(rdmstr, rdmstr.substring(0, 13));

        let encrypttext = decrypt.encrypt(`iPhone 14 15.4.${rdmstr.substring(0, 12)}${phone}${timestamp}${password}0$$$0.`)
        // console.log(encrypttext);
        let strphone = ''
        for (let a of phone) {
            if (a <= 7) {
                strphone += String(Number(a) + 2)
            } else {
                if (a == 8) {
                    strphone += ':'
                } else if (a == 9) {
                    strphone += ';'
                }
            }
        }
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
        }
        // console.log(data);
        if (!Cache[phone]) {
            let options = {
                url: 'https://appgologin.189.cn:9031/login/client/userLoginNormal',
                method: 'POST',
                data: data
            }
            let res = await axios(options)
            // console.log(res.data);
            // console.log(options);
            Cache[phone] = {
                ...res.data.responseData.data.loginSuccessResult
            }
            // console.log('写入缓存成功');
        } else {
            // console.log('读取缓存成功');
        }

        // console.log(res.data.responseData);
        // return
        let userInfo = {
            ...Cache[phone]
        }
        fs.writeFileSync(ChacePath, JSON.stringify(Cache, null, 4), 'utf8')
        let userToken = Cache[phone].token
        let userId = Cache[phone].userId
        timestamp = tool.TIMEstamp()
        data = `<Request>
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
                    </Request>`
        options = {
            url: `https://appgologin.189.cn:9031/map/clientXML`,
            method: 'post',
            data,
            'headers': {
                'Content-Type': 'application/xml;charset=utf-8'
            }
        }
        let titckRes = await axios(options)
        // console.log(titckRes.data);
        if (String(titckRes.data).includes('过期')) {
            timestamp = tool.TIMEstamp()
            rdmstr = tool.randomString(16)
            // console.log(rdmstr, rdmstr.substring(0, 13));

            encrypttext = decrypt.encrypt(`iPhone 14 15.4.${rdmstr.substring(0, 12)}${phone}${timestamp}${password}0$$$0.`)
            // console.log(encrypttext);
            strphone = ''
            for (let a of phone) {
                if (a <= 7) {
                    strphone += String(Number(a) + 2)
                } else {
                    if (a == 8) {
                        strphone += ':'
                    } else if (a == 9) {
                        strphone += ';'
                    }
                }
            }
            data = {
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
            }
            options = {
                url: 'https://appgologin.189.cn:9031/login/client/userLoginNormal',
                method: 'POST',
                data: data
            }
            res = await axios(options)
            // console.log(res.data);
            Cache[phone] = {
                ...res.data.responseData.data.loginSuccessResult
            }
            fs.writeFileSync(ChacePath, JSON.stringify(Cache, null, 4), 'utf8')
            // console.log('更新缓存成功');
            return await loginPhone(phone, password)
        }
        let tickettext = titckRes.data.split('<Ticket>')[1].split('</Ticket>')[0]
        let uid = tool.decrypt_req('1234567`90koiuyhgtfrdewsaqaqsqde', '', tickettext)
        // console.log(uid,'uid');
        userInfo.uid = uid
        userInfo.password = password
        // userInfo.phoneNbr = phone
        return userInfo
    } catch (e) {
        return false
    }
}
function aesEcbEncrypt(plaintext, key) {
    // 确保密钥长度为16/24/32字节
    if (![16, 24, 32].includes(key.length)) {
        throw new Error("密钥长度必须为16/24/32字节");
    }

    // 将密钥转换为WordArray对象
    const keyBytes = CryptoJS.enc.Utf8.parse(key);

    // 对明文进行加密
    const encrypted = CryptoJS.AES.encrypt(plaintext, keyBytes, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    // 返回Base64编码的密文
    return encrypted.toString();
}
async function userLogin(userInfo) {
    let loginData = {
        "ticket": userInfo.uid,
        "backUrl": "https%3A%2F%2Fwapact.189.cn%3A9001",
        "platformCode": "P201010301",
        "loginType": 2
    };

    // 使用AES-ECB加密登录数据
    const encryptedData = aesEcbEncrypt(JSON.stringify(loginData), 'telecom_wap_2018');

    let options = {
        url: 'https://wapact.189.cn:9001/unified/user/login',
        method: 'POST',
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
        },
        transformRequest: function transformRequest(data, headers) {
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
    // console.log(userInfo);
    try {
        const res = await axios(options);
        // console.log(res.data.biz.token);
        userInfo.Authorization = "Bearer " + res.data.biz.token;
        // 继续执行查询信息的函数
        await queryInfo(userInfo);
    } catch (err) {
        // console.log(err);
        initialCookie = await getCookie.initCookie(ruishuurl,filePath)
        userLogin(userInfo)
    }
}

async function queryInfo(userInfo) {
    let options = {
        url: 'https://wapact.189.cn:9001/gateway/golden/api/queryTurnTable?userType=1&_=' + new Date().valueOf(),
        method: 'get',
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
            Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            Authorization: userInfo.Authorization
        },
    };
    try {
        const res = await axios(options);
        await handleLottery(userInfo, res.data.biz.wzTurntable.code);
    } catch (err) {
        console.log(err);
    }
}

async function handleLottery(userInfo, id) {
    try {
        let options = {
            url: `https://wapact.189.cn:9001/gateway/standQuery/detail/check?activityId=${id}&_=${new Date().valueOf()}`,
            method: 'get',
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
                Authorization: userInfo.Authorization
            },
        };
        const res = await axios(options);
        let userCount = res.data.biz.resultInfo['userMaximum'] - res.data.biz.resultInfo['userCount'];
        console.log('金豆转盘可抽奖次数', userCount);

        if (userCount > 0) {
            for (let i = 0; i < userCount; i++) {
                let retryCount = 0;
                while (retryCount < 1) { // 最多重试 1 次
                    try {
                        let lotteryOptions = {
                            url: 'https://wapact.189.cn:9001/gateway/golden/api/lottery',
                            method: 'POST',
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
                                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
                                Authorization: userInfo.Authorization
                            },
                            data: {
                                "activityId": id
                            }
                        };
                        const lotteryRes = await axios(lotteryOptions);
                        console.log('抽奖结果：', lotteryRes.data?.biz?.resultInfo?.title || '抽奖失败');
                        await tool.waitt(3000); // 等待 3 秒
                        break; // 抽奖成功，跳出重试循环
                    } catch (e) {
                        console.log(e.message);
                        retryCount++;
                        if (retryCount >= 1) {
                            console.log('Max retries reached, moving to next lottery attempt.');
                        } else {
                            console.log(`Retrying lottery after ${retryCount} failure(s)...`);
                            await tool.waitt(3000); // 等待 3 秒后重试
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log(e.message);
    }
}

async function ssoHomLogin(ticket) {
    try {
        let options = {
            url: 'https://wappark.189.cn/jt-sign/ssoHomLogin?ticket=' + ticket,
            method: 'GET',
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.97 Mobile Safari/537.36",
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
        }
        let res = await axios(options)
        return res.data
    } catch (e) {

    }
}

// 电信签到
async function webSign(userinfo, signData) {
    try {
        let data = {
            phone: userinfo?.phoneNbr,
            sysType: '',
            date: (new Date).getTime()
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/webSign/sign',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                sign: signData.sign,
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                encode: tool.encrypt_aes(data)
            }
        };
        const res = await axios(options);
        console.log(res.data.data.msg);
    } catch (e) {
        console.log(e.message);
    }
}

//查询连签7天签到状态
async function userStatusInfo(userinfo, signData) {
    try {
        let data = {
            phone: userinfo.phoneNbr,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/api/home/userStatusInfo',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                sign: signData.sign,
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        const res = await axios(options);
        // console.log(res.data)
        console.log('连签7天签到天数:', res.data.data.signDay);
        if (res.data.data.signDay == '7') {
            console.log('开始抽取连签7天签到奖励')
            await exchangePrize(userinfo, signData, '7');
        }
    } catch (e) {
        console.log(e.message);
    }
}

//查询连续签到状态 15/28
async function continueSignDays(userinfo, signData) {
    try {
        let data = {
            phone: userinfo.phoneNbr,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/webSign/continueSignDays',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                sign: signData.sign,
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        const res = await axios(options);
        // console.log(res.data)
        console.log('累签抽好礼签到天数:', res.data.continueSignDays);
        let x = res.data.continueSignDays;
        if (x == '15' || x == '28') {
            console.log(`开始抽累签${x}天签到奖励`)
            await tool.waitt(3000); // 等待 3 秒
            await exchangePrize(userinfo, signData, x);
        }
    } catch (e) {
        console.log(e.message);
    }
}

// 电信连签奖励领取
async function exchangePrize(userinfo, signData, type) {
    try {
        let data = {
            phone: userinfo.phoneNbr,
            type: type
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/webSign/exchangePrize',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                sign: signData.sign,
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        const res = await axios(options);
        console.log((res.data?.prizeDetail?.biz?.winTitle) || res.data.resoultMsg || res.data.msg);
    } catch (e) {
        console.log(e.message);
        exchangePrize(userinfo, signData, type)
    }
}

//获取任务列表
async function getTakList(userinfo, signData) {
    try {
        let data = {
            "phone": userinfo.phoneNbr,
            "shopId": "20001",
            "type": "hg_qd_zrwzjd"
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/webSign/homepage',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                sign: signData.sign,
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        let res = await axios(options);
        // console.log(res.data.data.biz.adItems);
        for (let item of res.data.data.biz.adItems) {
            let a = item.taskState
            let b = item.contentOne
            if (a == '0' || a == '1') {
                if (b == '18') {
                    await polymerize(userinfo, signData, item);
                    await tool.waitt(1500)
                }
            }
        }
    } catch (e) {
        console.log(e.message);
    }
}
async function food(userinfo, signData) {
    let data = {
        phone: userinfo.phoneNbr,
    };
    let options = {
        url: 'https://wappark.189.cn/jt-sign/paradise/food',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            sign: signData.sign,
            Cookie: initialCookie.cookie + await getCookie.RefreshCookie(),
        },
        data: {
            para: tool.encrypt_rsa_hex(data),
        }
    };
    const maxFoodCount = 10;
    for (count = 1; count <= maxFoodCount; count++) {
        try {
            options.headers.Cookie = initialCookie.cookie + await getCookie.RefreshCookie();
            const res = await axios(options);
            console.log(`第 ${count} 次喂食结果:`, res.data.resoultMsg);
            if (res.data.resoultMsg === '今天已达到最大喂食次数') {
                console.log("🔴 今天已达到最大喂食次数，停止喂食。");
                break;
            }
            if (count < maxFoodCount) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 请求间隔 1 秒
            }
        } catch (err) {
            console.error(`第 ${count} 次喂食失败:`, err.response ? err.response.data : err);
            break;
        }
    }
    if (count > maxFoodCount) {
        console.log("喂食完成 10 次");
    }
}
//完成任务
async function polymerize(userinfo, signData, item) {
    try {
        let data = {
            "phone": userinfo.phoneNbr,
            jobId: item.taskId
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/webSign/polymerize',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                sign: signData.sign,
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        const res = await axios(options);
        console.log(item.title, res.data.resoultMsg);
    } catch (e) {
        console.log(e.message);
    }
}

//领取特殊任务奖励
async function receiveReward(userinfo, signData, item) {
    try {
        console.log('rewardId-----------', rewardId);
        let data = {
            "phone": userinfo.phoneNbr,
            rewardId: item.rewardId,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/paradise/receiveReward',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                sign: signData.sign,
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        const res = await axios(options);
        console.log(item.title, res.data.resoultMsg);
    } catch (e) {
        console.log(e.message);
    }
}

//每月见面礼
async function month_jml_preCost(userinfo) {
    try {
        let options = {
            url: 'https://wappark.189.cn/jt-sign/short/message/preCost',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                "phone": tool.encrypt_aes(userinfo.phoneNbr),
                activityCode: "shortMesssge"
            }
        };
        let res = await axios(options);
        // console.log(res.data);
        if (res.data.resoultCode == '0') {
            let resoultMsg = res.data.data.resoultMsg || '领取成功';
            jml_tokenFlag = res.data.resoultMsg
            await month_jml_userCost(userinfo, resoultMsg);
            await month_jml_receive(userinfo);
            await month_jml_getCount(userinfo);
            await month_jml_refresh(userinfo);
        }
    } catch (e) {
        console.log(e.message);
    }
}

async function month_jml_userCost(userinfo, resoultMsg) {
    try {
        let options = {
            url: 'https://wappark.189.cn/jt-sign/short/message/userCost',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                "phone": tool.encrypt_aes(userinfo.phoneNbr),
                activityCode: "shortMesssge",
                flag: jml_tokenFlag
            }
        };
        let res = await axios(options);
        // console.log(res.data);
        if (res.data.resoultCode == '0') {
            console.log(`见面礼${resoultMsg}: [${res.data.data.map(item => item.pizeName)}]`)
        }
    } catch (e) {
        console.log(e.message);
    }
}

async function month_jml_receive(userinfo) {
    try {
        let data = {
            "phone": userinfo.phoneNbr,
            flag: jml_tokenFlag,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/lottery/receive',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        let res = await axios(options);
        // console.log(res.data);
        if (res.data.code == '0') {
            console.log('领取APP抽奖次数成功')
        } else {
            console.log(`领取APP抽奖次数失败: ${res.data.msg}`)
        }
    } catch (e) {
        console.log(e.message);
    }
}
async function month_jml_getCount(userinfo) {
    let yearMonths = [202201, 202202, 202203]
    try {
        let data = {
            "phone": userinfo.phoneNbr,
            flag: jml_tokenFlag,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/lottery/getCount',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        let res = await axios(options);
        // console.log(JSON.stringify(res.data, null, 2));
        if (res.data.code == '0') {
            let videoTypes = res.data.video.map(item => item.videoType) || [],
                remainingVideoTypes = yearMonths.filter(num => !videoTypes.includes(num)),
                isFirstRequest = false;
            for (let videoType of remainingVideoTypes) {
                if (isFirstRequest) {
                    let randomWaitTime = Math.floor(Math.random() * 5000) + 3000;
                    await tool.waitt(randomWaitTime);
                }
                await month_jml_addVideoCount(userinfo, videoType);
                isFirstRequest = true;
            }
        } else {
            console.log(`查询看视频得抽奖机会次数失败: ${res.data.msg}`)
        }
    } catch (err) {
        console.log(`month_jml_getCount: ${err}`);
    }
}

async function month_jml_addVideoCount(userinfo, videoType) {
    try {
        let data = {
            "phone": userinfo.phoneNbr,
            videoType: videoType,
            flag: jml_tokenFlag,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/lottery/addVideoCount',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        let res = await axios(options);
        // console.log(res.data);
        if (res.data.code == '0') {
            console.log(`看视频${videoType}得抽奖机会成功`)
        } else {
            console.log(`看视频${videoType}得抽奖次数失败: ${res.data.msg}`)
        }
    } catch (err) {
        console.log(`month_jml_addVideoCount: ${err}`);
    }
}

async function month_jml_refresh(userinfo) {
    try {
        let data = {
            "phone": userinfo.phoneNbr,
            flag: jml_tokenFlag,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/lottery/refresh',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        let res = await axios(options);
        // console.log(res.data);
        if (res.data.rNumber) {
            let remainingCount = res.data.rNumber || 0;
            console.log("可以抽奖" + remainingCount + "次");
            let isFirstRequest = false;
            while (remainingCount-- > 0) {
                if (isFirstRequest) {
                    let randomWaitTime = Math.floor(Math.random() * 5000) + 5000;
                    await tool.waitt(randomWaitTime);
                }
                await month_jml_lotteryRevice(userinfo);
                isFirstRequest = true;
            }
        } else {
            console.log(`查询抽奖次数失败`)
        }
    } catch (err) {
        console.log(`month_jml_refresh: ${err}`);
    }
}

async function month_jml_lotteryRevice(userinfo) {
    try {
        let data = {
            "phone": userinfo.phoneNbr,
            flag: jml_tokenFlag,
        };
        let options = {
            url: 'https://wappark.189.cn/jt-sign/lottery/lotteryRevice',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Cookie: initialCookie.cookie + await getCookie.RefreshCookie(filePath),
            },
            data: {
                para: tool.encrypt_rsa_hex(data)
            }
        };
        let res = await axios(options);
        // console.log(res.data);
        if (res.data.code == '0') {
            console.log(`每月见面礼抽奖: ${res.data.rname}`)
        } else {
            console.log(`每月见面礼抽奖失败: ${res.data.msg}`)
        }
    } catch (err) {
        console.log(`month_jml_lotteryRevice: ${err}`);
    }
}


let ruishuurl = 'https://wapact.189.cn:9001/gateway/standExchange/detailNew/exchange'

async function main(phone, passwdord) {
    initialCookie = await getCookie.initCookie(ruishuurl,filePath)
    let res = await loginPhone(phone, passwdord)
    if (!res) return
    await userLogin(res)
    let res1 = await ssoHomLogin(res?.uid)
    await webSign(res, res1)
    await userStatusInfo(res, res1)
    await tool.waitt(3000); // 等待 3 秒
    await continueSignDays(res, res1)
    await getTakList(res, res1)
    await food(res, res1)
    await month_jml_preCost(res)
    await tool.waitt(2000)
}

async function begin() {
    try {
        Cache = JSON.parse(fs.readFileSync(ChacePath, 'utf8'));
    } catch (error) {
        fs.writeFileSync(ChacePath, JSON.stringify({}), 'utf8');
        Cache = JSON.parse(fs.readFileSync(ChacePath, 'utf8'));
    }
    
    console.log(`共找到${userPhone.length}个账号,开始执行任务`)
    try {
        for (let index = 0; index < userPhone.length; index++) {
            let user = userPhone[index]
            console.log(`\n====== 账号[${index + 1}] ${tool.maskPhone(user.phone)} ======`)
            // if(user.uid&&user.uid.length>=14){
            //     if(!Msg[user.uid]){
            //         Msg[user.uid]=[]
            //     }
            //     Msg[user.uid].push(`\n====== 账号[${index + 1}] ${tool.maskPhone(user.phone)} ======`)
            // }
            await main(user.phone, user.password);
        }
        process.exit()
    } catch (error) {
        console.log(error);
    } finally {
        process.exit()
        // let inde=0
        // for(let key in Msg){
        //     inde++
        //     setTimeout(()=>{
        //         tool.sendMsg(Msg[key], msgtitle,appToken,key);
        //     },5000 * inde)
        // }
    }

}

begin()