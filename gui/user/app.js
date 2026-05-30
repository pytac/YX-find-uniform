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

    // 自动生成默认UID（设备唯一标识）
    let savedUid = wx.getStorageSync('uid');
    if (!savedUid) {
      savedUid = 'UID-' + Date.now().toString().slice(-8);
      wx.setStorageSync('uid', savedUid);
    }
    this.globalData.uid = savedUid;

    const savedMessages = wx.getStorageSync('messages');
    if (savedMessages) {
      this.globalData.messages = savedMessages;
    }
  },

  saveServerUrl(url) {
    let cleanUrl = url;
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    this.globalData.serverUrl = cleanUrl;
    wx.setStorageSync('serverUrl', cleanUrl);
  },

  saveUid(uid) {
    this.globalData.uid = uid;
    wx.setStorageSync('uid', uid);
  },

  addMessage(msg) {
    const timeId = msg.time_id || Date.now().toString();
    this.globalData.messages[timeId] = {
      type: msg.type,
      time: msg.time,
      auto_delete: msg.auto_delete || false,
      detail: msg.detail || {}
    };
    wx.setStorageSync('messages', this.globalData.messages);
  },

  getMessages() {
    return this.globalData.messages;
  }
});
