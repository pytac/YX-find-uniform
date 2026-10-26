// 默认总服务器地址必须是局域网 IP：
// 1) 开发者工具会直接拒绝发往 localhost 的请求（Cannot send network request to localhost）
// 2) 手机上 127.0.0.1 指向手机自己，永远连不到电脑
const DEFAULT_SERVER_URL = 'http://192.168.2.128:5000';
const DEFAULT_HOST = '192.168.2.128';

// 回环 / 通配地址：这些主机名在任何客户端设备上都没有意义
const LOOPBACK_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0)$/i;

App({
  globalData: {
    serverUrl: DEFAULT_SERVER_URL,
    uid: '',
    messages: {}
  },

  onLaunch() {
    const savedUrl = wx.getStorageSync('serverUrl');
    const normalized = this.normalizeServerUrl(savedUrl);
    this.globalData.serverUrl = normalized;
    // 旧版本存过 127.0.0.1，迁到局域网地址后写回，避免设置页显示错的值
    if (savedUrl && savedUrl !== normalized) {
      try {
        wx.setStorageSync('serverUrl', normalized);
      } catch (e) {
        // 存储不可用时忽略
      }
    }

    // 用户唯一编码：首次启动生成 UUID v4 并永久保存，之后不再变化。
    // 必须同步完成，否则页面 onLoad 会读到空 uid。
    this.globalData.uid = this.ensureUid();

    // 已绑定校服里存的学校地址可能还是旧的 127.0.0.1，顺手纠正并写回
    this.migrateUniformUrls();

    const savedMessages = wx.getStorageSync('messages');
    if (savedMessages) {
      this.globalData.messages = savedMessages;
    }
  },

  // 把已绑定校服里保存的学校地址从回环地址纠正为局域网地址。
  // 早期服务端初始化模板写的是 http://127.0.0.1:8888，绑定时被原样存进本地，
  // 导致首页拉消息永远发往 localhost。
  migrateUniformUrls() {
    try {
      const uniforms = wx.getStorageSync('uniforms');
      if (!Array.isArray(uniforms) || uniforms.length === 0) {
        return;
      }
      let changed = false;
      uniforms.forEach((u) => {
        if (u && u.schoolService) {
          const fixed = this.resolveUrl(u.schoolService);
          if (fixed !== u.schoolService) {
            u.schoolService = fixed;
            changed = true;
          }
        }
      });
      if (changed) {
        wx.setStorageSync('uniforms', uniforms);
      }
    } catch (e) {
      // 存储异常不影响启动
    }
  },

  // 读取本机已保存的用户编码，没有则生成一个
  ensureUid() {
    let uid = '';
    try {
      uid = wx.getStorageSync('uid') || '';
    } catch (e) {
      uid = '';
    }

    // 历史版本可能存过 openid 或 "UID-时间戳"，只要长度合理就沿用，
    // 避免改动编码后与服务端已绑定的数据（校服、消息）对不上
    if (typeof uid === 'string' && uid.length >= 8 && uid.length <= 64) {
      return uid;
    }

    const newUid = this.createUuid();
    try {
      wx.setStorageSync('uid', newUid);
    } catch (e) {
      // 存储不可用时至少保证本次运行有编码可用
    }
    return newUid;
  },

  // 生成小写 UUID v4
  createUuid() {
    const hex = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < 36; i += 1) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        out += '-';
      } else if (i === 14) {
        out += '4';
      } else if (i === 19) {
        out += hex[Math.floor(Math.random() * 4) | 8];
      } else {
        out += hex[Math.floor(Math.random() * 16)];
      }
    }
    return out;
  },

  saveServerUrl(url) {
    const cleanUrl = this.normalizeServerUrl(url)
    this.globalData.serverUrl = cleanUrl
    wx.setStorageSync('serverUrl', cleanUrl)
  },

  // 取当前配置里的服务器主机名（局域网 IP）
  lanHost() {
    const m = String(this.globalData.serverUrl || DEFAULT_SERVER_URL)
      .match(/^https?:\/\/([^\/:?#]+)/i)
    const host = m ? m[1] : ''
    if (!host || LOOPBACK_HOST.test(host)) {
      return DEFAULT_HOST
    }
    return host
  },

  // 给没写协议的地址补 http://
  // 用户经常只填 "192.168.2.128:5000"，不带协议前缀时 wx.request 会当成相对路径，
  // 请求根本发不出去（控制台只会看到一句 network error），所以统一在这里补齐。
  ensureScheme(url) {
    const text = String(url || '').trim().replace(/\s+/g, '')
    if (!text) {
      return ''
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
      return text
    }
    return 'http://' + text.replace(/^\/+/, '')
  },

  // 把 anyurl 里的回环主机名换成局域网 IP，端口和路径保持不变。
  // 历史数据里存过 http://127.0.0.1:8888 这类学校地址，这里统一纠正，
  // 否则开发者工具会拒绝发请求、手机上也永远连不上。
  resolveUrl(url) {
    if (!url || typeof url !== 'string') {
      return ''
    }
    const withScheme = this.ensureScheme(url)
    if (!withScheme) {
      return ''
    }
    return withScheme.replace(/^(https?:\/\/)([^\/:?#]+)/i, (whole, scheme, host) => {
      if (!LOOPBACK_HOST.test(host)) {
        return whole
      }
      return scheme + this.lanHost()
    })
  },

  // 规整服务器地址：空值回退默认值，缺协议补 http://，回环地址换成局域网 IP，去掉结尾斜杠
  normalizeServerUrl(url) {
    if (!url || typeof url !== 'string') {
      return DEFAULT_SERVER_URL
    }
    let fixed = this.resolveUrl(url)
    while (fixed.length > 1 && fixed.endsWith('/')) {
      fixed = fixed.slice(0, -1)
    }
    return fixed || DEFAULT_SERVER_URL
  },

  // 一个用户可能有多套校服，而且可能分属不同学校（不同 school_service）。
  // 返回本机已绑定校服涉及的全部学校地址（去重、已纠正回环地址）。
  collectSchoolUrls() {
    let uniforms = []
    try {
      uniforms = wx.getStorageSync('uniforms') || []
    } catch (e) {
      uniforms = []
    }
    const out = []
    uniforms.forEach((u) => {
      if (!u || !u.schoolService) {
        return
      }
      const url = this.resolveUrl(u.schoolService).replace(/\/+$/, '')
      if (url && out.indexOf(url) === -1) {
        out.push(url)
      }
    })
    return out
  },

  // 按 YID 精确找出它所属学校的服务地址。
  // 多套校服时绝不能笼统地"取第一个学校"，否则会把请求发错学校。
  findSchoolByYid(yid) {
    let uniforms = []
    try {
      uniforms = wx.getStorageSync('uniforms') || []
    } catch (e) {
      uniforms = []
    }
    for (const u of uniforms) {
      if (u && u.yid === yid && u.schoolService) {
        return this.resolveUrl(u.schoolService).replace(/\/+$/, '')
      }
    }
    return ''
  },

  addMessage(msg) {
    const timeId = msg.time_id || Date.now().toString()
    this.globalData.messages[timeId] = {
      type: msg.type,
      time: msg.time,
      timestamp: msg.timestamp || 0,
      auto_delete: msg.auto_delete || false,
      detail: msg.detail || {},
      // 消息来自哪个学校服务、以及它在那个服务上的原始 key。
      // 多校服场景下不同学校的 key 可能撞车，删除时必须带上来源。
      source: msg.source || '',
      rawKey: msg.rawKey || ''
    }
    wx.setStorageSync('messages', this.globalData.messages)
  },

  getMessages() {
    return this.globalData.messages
  }
})
