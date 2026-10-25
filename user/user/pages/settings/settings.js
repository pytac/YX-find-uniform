const app = getApp();

Page({
  data: {
    serverUrl: 'http://127.0.0.1:5000',
    uid: ''
  },

  onLoad() {
    // 只读展示；正常情况下 onLaunch 已经生成，这里只是兜底
    const uid = app.globalData.uid || (app.ensureUid ? app.ensureUid() : '');
    if (uid && !app.globalData.uid) {
      app.globalData.uid = uid;
    }
    this.setData({
      serverUrl: app.globalData.serverUrl,
      uid: uid
    });
  },

  onUrlInput(e) {
    this.setData({
      serverUrl: e.detail.value
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
    this.setData({ serverUrl: url });
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  }
});
