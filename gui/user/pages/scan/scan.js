const app = getApp();

Page({
  data: {
    mode: 'add',
    showModal: false,
    scanResult: '',
    yidValue: '',
    // 领取丢失模式专用
    claimTimeId: '',
    claimYid: ''
  },

  onLoad(options) {
    const mode = options.mode || 'add';
    const claimTimeId = options.timeId || '';
    const claimYid = options.yid || '';
    this.setData({ mode, claimTimeId, claimYid });

    let title = mode === 'add' ? '添加校服' : '报告丢失';
    if (mode === 'claimLoss') {
      title = '领取丢失校服';
    }
    wx.setNavigationBarTitle({ title });
  },

  onYidInput(e) {
    this.setData({ yidValue: e.detail.value });
  },

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
        wx.showToast({
          title: '扫码失败，请手动输入YID',
          icon: 'none'
        });
      }
    });
  },

  onChooseFromAlbum() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '识别中...' });
        wx.scanCode({
          onlyFromCamera: false,
          scanType: ['qrCode'],
          success: (scanRes) => {
            wx.hideLoading();
            const result = scanRes.result || '';
            wx.showToast({
              title: '识别成功',
              icon: 'success'
            });
            this.setData({
              scanResult: result,
              showModal: true
            });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: '未识别到二维码，请手动输入YID',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 手动输入按钮 - 直接聚焦到输入框
  onManualInput() {
    this.setData({ yidValue: '' });
    // 滚动到输入区域
    wx.pageScrollTo({
      selector: '.input-area',
      duration: 300
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
    const { mode, scanResult, claimTimeId } = this.data;

    if (mode === 'add') {
      wx.navigateTo({
        url: '/pages/bindstudent/bindstudent?yid=' + encodeURIComponent(scanResult)
      });
      this.setData({ showModal: false, scanResult: '', yidValue: '' });
    } else if (mode === 'claimLoss') {
      // 领取丢失衣物模式
      const uid = app.globalData.uid;
      if (!uid) {
        wx.showToast({ title: '请先在设置中填写UID', icon: 'none' });
        return;
      }

      // 获取学校服务器地址
      let msgUrl = app.globalData.serverUrl;
      const uniforms = wx.getStorageSync('uniforms') || [];
      for (const u of uniforms) {
        if (u.schoolService) {
          msgUrl = u.schoolService;
          break;
        }
      }

      wx.showLoading({ title: '提交中...' });
      wx.request({
        url: msgUrl + '/user/get_loss',
        method: 'POST',
        data: { uid, yid: scanResult, key: claimTimeId },
        success: (res) => {
          wx.hideLoading();
          if (res.data && res.data.Status) {
            wx.showToast({ title: '领取成功', icon: 'success' });
            this.setData({ showModal: false, scanResult: '', yidValue: '' });
            // 返回首页并刷新消息
            wx.navigateBack();
          } else {
            wx.showToast({ title: res.data.Phrase || '领取失败', icon: 'none' });
          }
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '网络错误，请检查服务器', icon: 'none' });
        }
      });
    } else {
      // 报告丢失模式
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
