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

    // 先尝试从本地读取已保存的UID
    let savedUid = wx.getStorageSync('uid')
    if (savedUid) {
      this.globalData.uid = savedUid
    }

    // 使用云数据库获取微信用户的_openid作为唯一UID
    if (wx.cloud) {
      wx.cloud.init()
    }
    const db = wx.cloud.database()
    db.collection('users').where({
      _openid: '{openid}'  // 云开发自动匹配当前用户
    }).get().then(res => {
      if (res.data.length > 0) {
        // 已有记录，用_openid作为UID
        this.globalData.uid = res.data[0]._openid
        wx.setStorageSync('uid', this.globalData.uid)
      } else {
        // 新用户，创建记录
        db.collection('users').add({
          data: {
            uid: '',
            createdAt: db.serverDate()
          }
        }).then(addRes => {
          // 再查一次获取_openid
          db.collection('users').doc(addRes._id).get().then(docRes => {
            this.globalData.uid = docRes.data._openid
            wx.setStorageSync('uid', this.globalData.uid)
          })
        })
      }
    }).catch(() => {
      // 云数据库不可用时，如果本地已有UID则保留，否则生成一个固定的
      if (!wx.getStorageSync('uid')) {
        const fixedUid = 'UID-' + Date.now().toString().slice(-8)
        wx.setStorageSync('uid', fixedUid)
        this.globalData.uid = fixedUid
      }
    })

    const savedMessages = wx.getStorageSync('messages')
    if (savedMessages) {
      this.globalData.messages = savedMessages
    }
  },

  saveServerUrl(url) {
    let cleanUrl = url
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1)
    }
    this.globalData.serverUrl = cleanUrl
    wx.setStorageSync('serverUrl', cleanUrl)
  },

  saveUid(uid) {
    this.globalData.uid = uid
    wx.setStorageSync('uid', uid)
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
