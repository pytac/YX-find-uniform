const app = getApp();

Page({
  data: {
    showModal: false,
    scanResult: '',
    yidValue: ''
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '添加校服' });
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

  // 添加校服 → 需要填写学号 → 调 /user/enable
  onConfirm() {
    const { scanResult } = this.data;
    wx.navigateTo({
      url: '/pages/bindstudent/bindstudent?yid=' + encodeURIComponent(scanResult)
    });
    this.setData({ showModal: false, scanResult: '', yidValue: '' });
  }
});