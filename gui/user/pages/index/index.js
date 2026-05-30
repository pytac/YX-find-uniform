const app = getApp();

Page({
  data: {
    messageList: [],
    showAddModal: false,
    addYid: '',
    addStudent: '',
    showReportModal: false,
    reportYid: ''
  },

  onShow() {
    this.loadMessages();
  },

  loadMessages() {
    this.fetchMessagesFromServer();
  },

  // 获取已激活校服中保存的学校服务器地址
  getSchoolServiceUrl() {
    const uniforms = wx.getStorageSync('uniforms') || [];
    for (const u of uniforms) {
      if (u.schoolService) {
        return u.schoolService;
      }
    }
    return '';
  },

  fetchMessagesFromServer() {
    const uid = app.globalData.uid;
    if (!uid) {
      this.setData({ messageList: [] });
      return;
    }

    // 优先使用学校服务器地址获取消息
    let msgUrl = app.globalData.serverUrl;
    const schoolUrl = this.getSchoolServiceUrl();
    if (schoolUrl) {
      msgUrl = schoolUrl;
    }

    wx.request({
      url: msgUrl + '/user/get_msg',
      method: 'POST',
      data: { uid },
      success: (res) => {
        if (res.data && res.data.Status) {
          const serverMsgs = res.data.Detail.msg || {};
          app.globalData.messages = {};
          wx.setStorageSync('messages', {});

          Object.keys(serverMsgs).forEach(timeId => {
            const msg = serverMsgs[timeId];
            const timeStr = this.timestampToStr(msg.time);
            app.addMessage({
              time_id: timeId,
              type: msg.type,
              time: timeStr,
              auto_delete: msg.auto_delete || false,
              detail: msg.detail || {}
            });
          });
          const messages = app.getMessages();
          const list = Object.keys(messages).map(timeId => ({
            timeId,
            ...messages[timeId]
          }));
          list.sort((a, b) => {
            if (a.time < b.time) return 1;
            if (a.time > b.time) return -1;
            return 0;
          });
          this.setData({ messageList: list });
        } else {
          app.globalData.messages = {};
          wx.setStorageSync('messages', {});
          this.setData({ messageList: [] });
        }
      },
      fail: () => {
        console.log('获取消息失败，显示空列表');
        wx.showToast({
          title: '未连接到服务器',
          icon: 'none'
        });
        app.globalData.messages = {};
        wx.setStorageSync('messages', {});
        this.setData({ messageList: [] });
      }
    });
  },

  onRefresh() {
    wx.showToast({
      title: '刷新中...',
      icon: 'loading',
      duration: 1000
    });
    this.fetchMessagesFromServer();
  },

  timestampToStr(ts) {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  goToMyUniform() {
    wx.navigateTo({
      url: '/pages/myuniform/myuniform'
    });
  },

  // 添加校服 → 跳转到独立的添加校服页面
  goToScanAdd() {
    const uid = app.globalData.uid;
    if (!uid) {
      wx.showToast({
        title: '请先在设置中填写UID',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/adduniform/adduniform'
    });
  },

  // 报告丢失 → 跳转到独立的报告丢失页面
  goToScanReport() {
    const uid = app.globalData.uid;
    if (!uid) {
      wx.showToast({
        title: '请先在设置中填写UID',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/reportloss/reportloss'
    });
  },

  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  }
});
