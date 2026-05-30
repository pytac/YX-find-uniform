const app = getApp();

Page({
  data: {
    showModal: false,
    scanResult: '',
    yidValue: ''
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '报告丢失' });
  },

  onYidInput(e) {
    this.setData({ yidValue: e.detail.value });
  },

  onCameraError(e) {
    console.error('摄像头错误:', e);
  },

  onScan() {
    const ctx = wx.createCameraContext();
    ctx.takePhoto({
      quality: 'low',
      success: (res) => {
        wx.showToast({ title: '扫码成功', icon: 'success' });
        this.setData({
          scanResult: 'YID-' + Date.now().toString().slice(-6),
          showModal: true
        });
      },
      fail: (err) => {
        wx.showToast({ title: '扫码失败，请手动输入YID', icon: 'none' });
      }
    });
  },

  onSubmit() {
    const { yidValue } = this.data;
    if (!yidValue || !yidValue.trim()) {
      wx.showToast({ title: '请输入YID', icon: 'none' });
      return;
    }
    this.setData({
      scanResult: yidValue.trim(),
      showModal: true
    });
  },

  onCancel() {
    this.setData({ showModal: false });
  },

  // 获取该YID对应的学校服务器地址
  getSchoolServiceByYid(yid) {
    const uniforms = wx.getStorageSync('uniforms') || [];
    for (const u of uniforms) {
      if (u.yid === yid && u.schoolService) {
        return u.schoolService;
      }
    }
    return '';
  },

  // 报告丢失 → 不需要学号 → 优先调学校服务器的 /service/loss
  onConfirm() {
    const { scanResult } = this.data;
    const uid = app.globalData.uid;

    if (!uid) {
      wx.showToast({ title: '请先在设置中填写UID', icon: 'none' });
      return;
    }

    // 优先使用学校服务器地址
    let targetUrl = this.getSchoolServiceByYid(scanResult);
    if (!targetUrl) {
      targetUrl = app.globalData.serverUrl;
    }

    wx.showLoading({ title: '提交中...' });
    wx.request({
      url: targetUrl + '/service/loss',
      method: 'POST',
      data: { yid: scanResult },
      success: (res) => {
        wx.hideLoading();
        if (res.data && res.data.Status) {
          const now = new Date();
          const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
          app.addMessage({
            time_id: Date.now().toString(),
            type: 1,
            time: timeStr,
            auto_delete: true,
            detail: { yid: scanResult, name: '校服' }
          });
          wx.showToast({ title: '报告成功', icon: 'success' });
          this.setData({ showModal: false, scanResult: '', yidValue: '' });
          wx.navigateBack();
        } else {
          wx.showToast({ title: res.data.Phrase || '报告失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误，请检查服务器', icon: 'none' });
      }
    });
  }
});
