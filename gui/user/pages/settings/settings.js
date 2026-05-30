const app = getApp();

Page({
  data: {
    serverUrl: 'http://127.0.0.1:5000',
    uid: ''
  },

  onLoad() {
    this.setData({
      serverUrl: app.globalData.serverUrl,
      uid: app.globalData.uid
    });
  },

  onUrlInput(e) {
    this.setData({
      serverUrl: e.detail.value
    });
  },

  onUidInput(e) {
    this.setData({
      uid: e.detail.value
    });
  },

  saveSettings() {
    let url = this.data.serverUrl.trim();
    if (!url) {
      wx.showToast({
        title: '请输入服务器地址',
        icon: 'none'
      });
      return;
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    app.saveServerUrl(url);
    app.saveUid(this.data.uid.trim());
    this.setData({ serverUrl: url });
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  }
});
