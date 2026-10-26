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
    wx.setNavigationBarTitle({ title: '报告丢失' });
  },

  onShow() {
    // 从后台或其他页面返回时恢复取景
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

  // 获取该YID对应的学校服务器地址（多套校服时必须按 YID 精确匹配）
  getSchoolServiceByYid(yid) {
    return app.findSchoolByYid(yid);
  },

  // 报告丢失 → 先走总服务器 /user/loss（总服务器校验 yid 后会转发给学校，服务端能看到记录），
  //             总服务器不可用或查不到该 yid 时，再退到学校服务器的 /service/loss
  onConfirm() {
    const scanResult = (this.data.scanResult || '').trim();
    const uid = app.globalData.uid;

    if (!scanResult) {
      wx.showToast({ title: '请输入YID', icon: 'none' });
      return;
    }

    if (!uid) {
      wx.showToast({ title: '用户标识异常，请重启小程序', icon: 'none' });
      return;
    }

    const targets = [];
    if (app.globalData.serverUrl) {
      targets.push(app.resolveUrl(app.globalData.serverUrl) + '/user/loss');
    }
    const schoolUrl = this.getSchoolServiceByYid(scanResult);
    if (schoolUrl) {
      targets.push(app.resolveUrl(schoolUrl) + '/service/loss');
    }

    this._lossError = '';
    this.postLoss(targets, 0, scanResult);
  },

  // 依次尝试候选地址，任一成功即结束
  postLoss(targets, index, yid) {
    if (index >= targets.length) {
      wx.hideLoading();
      wx.showToast({ title: this._lossError || '报告失败', icon: 'none' });
      return;
    }

    if (index === 0) {
      wx.showLoading({ title: '提交中...' });
    }

    wx.request({
      url: targets[index],
      method: 'POST',
      data: { yid: yid },
      success: (res) => {
        if (res.data && res.data.Status) {
          this.lossSuccess(yid);
        } else {
          // 当前服务器不认这个 yid，换下一个地址
          this._lossError = (res.data && res.data.Phrase) || '报告失败';
          this.postLoss(targets, index + 1, yid);
        }
      },
      fail: () => {
        this._lossError = '网络错误，请检查服务器';
        this.postLoss(targets, index + 1, yid);
      }
    });
  },

  lossSuccess(yid) {
    wx.hideLoading();
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    app.addMessage({
      time_id: Date.now().toString(),
      type: 1,
      time: timeStr,
      auto_delete: true,
      detail: { yid: yid, name: '校服' }
    });
    wx.showToast({ title: '报告成功', icon: 'success' });
    this.setData({ showModal: false, scanResult: '', yidValue: '', keyboardUp: false });
    wx.navigateBack();
  }
});
