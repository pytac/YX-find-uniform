const app = getApp();

Page({
  data: {
    showModal: false,
    scanResult: '',
    yidValue: '',
    keyboardUp: false,
    cameraOn: true,
    cameraError: ''
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '添加校服' });
  },

  onShow() {
    // 从确认/绑定页返回时恢复取景
    if (!this.data.cameraError) {
      this.setData({ cameraOn: true });
    }
  },

  onYidInput(e) {
    this.setData({ yidValue: e.detail.value });
  },

  // 弹窗内直接修正识别结果
  onScanResultInput(e) {
    this.setData({ scanResult: e.detail.value });
  },

  // 键盘弹起时把弹窗顶上去，避免输入框被遮住
  onFieldFocus() {
    this.setData({ keyboardUp: true });
  },

  onFieldBlur() {
    this.setData({ keyboardUp: false });
  },

  // 相机实时识别成功（camera mode="scanCode"），自动进入确认
  onCameraScan(e) {
    if (this._ignoreUntil && Date.now() < this._ignoreUntil) {
      return;
    }
    const result = ((e.detail && e.detail.result) || '').trim();
    if (!result || this.data.showModal) {
      return;
    }
    this.acceptResult(result);
  },

  // 用户拒绝授权或相机启动失败
  onCameraError(e) {
    console.error('camera error', e.detail);
    this.setData({
      cameraOn: false,
      cameraError: '无法打开相机（可能未授权）'
    });
  },

  // 同层渲染失败：相机仍能识别，只是取景框可能被相机盖住
  onRenderError(e) {
    console.warn('camera same-layer render failed', e.detail);
  },

  acceptResult(result) {
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'medium', fail: () => {} });
    }
    this.setData({
      scanResult: result,
      showModal: true,
      keyboardUp: false
    });
  },

  // 备用入口：调起系统扫码（可选相册图片），相机不可用时仍可操作
  onScan() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        const result = (res.result || '').trim();
        if (!result) {
          return;
        }
        this.acceptResult(result);
      },
      fail: () => {
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
      showModal: true,
      keyboardUp: false
    });
  },

  onCancel() {
    // 给相机重新初始化的时间，避免同一张码立刻又弹出确认
    this._ignoreUntil = Date.now() + 1200;
    this.setData({ showModal: false, keyboardUp: false });
  },

  onConfirm() {
    const yid = (this.data.scanResult || '').trim();
    if (!yid) {
      wx.showToast({ title: '请输入YID', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/bindstudent/bindstudent?yid=' + encodeURIComponent(yid)
    });
    this.setData({ showModal: false, scanResult: '', yidValue: '', keyboardUp: false });
  }
});
