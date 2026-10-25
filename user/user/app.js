App({
  globalData: {
    serverUrl: 'http://127.0.0.1:5000',
    uid: '',
    messages: {}
  },

  onLaunch() {
    const savedUrl = wx.getStorageSync('serverUrl');
    if (savedUrl) {
      this.globalData.serverUrl = savedUrl;
    }

    // 用户唯一编码：首次启动生成 UUID v4 并永久保存，之后不再变化。
    // 必须同步完成，否则页面 onLoad 会读到空 uid。
    this.globalData.uid = this.ensureUid();

    const savedMessages = wx.getStorageSync('messages');
    if (savedMessages) {
      this.globalData.messages = savedMessages;
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
    let cleanUrl = url
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1)
    }
    this.globalData.serverUrl = cleanUrl
    wx.setStorageSync('serverUrl', cleanUrl)
  },

  addMessage(msg) {
    const timeId = msg.time_id || Date.now().toString()
    this.globalData.messages[timeId] = {
      type: msg.type,
      time: msg.time,
      timestamp: msg.timestamp || 0,
      auto_delete: msg.auto_delete || false,
      detail: msg.detail || {}
    }
    wx.setStorageSync('messages', this.globalData.messages)
  },

  getMessages() {
    return this.globalData.messages
  }
})
