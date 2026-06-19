const app = getApp();

Page({
  data: {
    showModal: false,
    scanResult: '',
    yidValue: ''
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '添加校服' });
    // 不再自动弹出扫码，让用户手动操作
  },

  onYidInput(e) {
    this.setData({ yidValue: e.detail.value });
  },

  // 点击"开始扫码"才调起系统扫码
  onScan() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        const result = res.result || '';
        wx.showToast({
          title: '扫码成功',
          icon: 'success'
        });
        this.setData({
          scanResult: result,
          showModal: true
        });
      },
      fail: (err) => {
        // 用户点左上角叉叉取消扫码，回到输入页面
        wx.showToast({
          title: '已取消扫码，可手动输入YID',
          icon: 'none'
        });
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

  onConfirm() {
    const { scanResult } = this.data;
    wx.navigateTo({
      url: '/pages/bindstudent/bindstudent?yid=' + encodeURIComponent(scanResult)
    });
    this.setData({ showModal: false, scanResult: '', yidValue: '' });
  }
});
