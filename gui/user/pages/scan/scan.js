const app = getApp();

Page({
  data: {
    mode: 'add',
    showModal: false,
    scanResult: '',
    yidValue: ''
  },

  onLoad(options) {
    const mode = options.mode || 'add';
    this.setData({ mode });
    wx.setNavigationBarTitle({
      title: mode === 'add' ? '添加校服' : '报告丢失'
    });
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
        wx.showToast({
          title: '扫码成功',
          icon: 'success'
        });
        this.setData({
          scanResult: 'YID-' + Date.now().toString().slice(-6),
          showModal: true
        });
      },
      fail: (err) => {
        wx.showToast({
          title: '扫码失败，请手动输入YID',
          icon: 'none'
        });
      }
    });
  },

  onSubmit() {
    const { yidValue, mode } = this.data;
    if (!yidValue || !yidValue.trim()) {
      wx.showToast({
        title: '请输入YID',
        icon: 'none'
      });
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

  onConfirm() {
    const { mode, scanResult } = this.data;

    if (mode === 'add') {
      // 添加模式：跳转到输入学号页面
      wx.navigateTo({
        url: '/pages/bindstudent/bindstudent?yid=' + encodeURIComponent(scanResult)
      });
      this.setData({ showModal: false, scanResult: '', yidValue: '' });
    } else {
      // 丢失模式：直接提交
      const uid = app.globalData.uid;
      const serverUrl = app.globalData.serverUrl;
      if (!uid) {
        wx.showToast({ title: '请先在设置中填写UID', icon: 'none' });
        return;
      }
      wx.showLoading({ title: '提交中...' });
      wx.request({
        url: serverUrl + '/user/loss',
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
  }
});