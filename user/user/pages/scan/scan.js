const app = getApp();

Page({
  data: {
    mode: 'add',
    showModal: false,
    scanResult: '',
    yidValue: '',
    keyboardUp: false,
    cameraOn: true,
    cameraError: '',
    // 领取丢失模式专用
    claimTimeId: '',
    claimYid: '',
    claimSource: '',
    claimKey: ''
  },

  onLoad(options) {
    const mode = options.mode || 'add';
    const claimTimeId = options.timeId || '';
    const claimYid = options.yid || '';
    const claimSource = decodeURIComponent(options.source || '');
    const claimKey = decodeURIComponent(options.key || options.timeId || '');
    this.setData({ mode, claimTimeId, claimYid, claimSource, claimKey });

    let title = mode === 'add' ? '添加校服' : '报告丢失';
    if (mode === 'claimLoss') {
      title = '领取丢失校服';
    }
    wx.setNavigationBarTitle({ title });
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
        wx.showToast({
          title: '已取消扫码，可手动输入YID',
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
            const result = (scanRes.result || '').trim();
            if (!result) {
              wx.showToast({ title: '未识别到二维码，请手动输入YID', icon: 'none' });
              return;
            }
            this.acceptResult(result);
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
    const { mode, claimTimeId } = this.data;
    const scanResult = (this.data.scanResult || '').trim();

    if (!scanResult) {
      wx.showToast({ title: '请输入YID', icon: 'none' });
      return;
    }

    if (mode === 'add') {
      wx.navigateTo({
        url: '/pages/bindstudent/bindstudent?yid=' + encodeURIComponent(scanResult)
      });
      this.setData({ showModal: false, scanResult: '', yidValue: '', keyboardUp: false });
    } else if (mode === 'claimLoss') {
      // 领取丢失衣物模式
      const uid = app.globalData.uid;
      if (!uid) {
        wx.showToast({ title: '用户标识异常，请重启小程序', icon: 'none' });
        return;
      }

      // 多套校服可能分属不同学校，必须按 YID 归到它自己的学校；
      // 拿不准时把所有学校的地址排成候选依次尝试，不能盲取第一个。
      const targets = [];
      const push = (url) => {
        const clean = app.resolveUrl(url || '').replace(/\/+$/, '');
        if (clean && targets.indexOf(clean) === -1) {
          targets.push(clean);
        }
      };
      push(this.data.claimSource);
      if (scanResult !== this.data.claimYid) {
        // 用户手动改过 YID：原消息那所学校未必对得上，把新 YID 真正的学校提到最前，
        // 省掉一次必然失败的请求；原来源仍留作兜底。
        const byNewYid = app.resolveUrl(app.findSchoolByYid(scanResult) || '').replace(/\/+$/, '');
        if (byNewYid) {
          const at = targets.indexOf(byNewYid);
          if (at > 0) {
            targets.splice(at, 1);
          }
          if (at !== 0) {
            targets.unshift(byNewYid);
          }
        }
      } else {
        push(app.findSchoolByYid(this.data.claimYid));
      }
      app.collectSchoolUrls().forEach(push);
      if (targets.length === 0) {
        push(app.globalData.serverUrl);
      }

      const keys = [];
      const pushKey = (k) => {
        const clean = String(k || '').trim();
        if (clean && keys.indexOf(clean) === -1) {
          keys.push(clean);
        }
      };
      pushKey(this.data.claimKey);
      // 老数据/本地缓存里的 key 可能是带来源前缀的 timeId，剥掉前缀再试一次
      const rawTimeId = String(this.data.claimTimeId || '').split('#').pop();
      pushKey(rawTimeId);

      this._claimTargets = targets;
      this._claimKeys = keys;
      this._claimUid = uid;
      this._claimYid = scanResult;
      this._claimError = '';
      wx.showLoading({ title: '提交中...' });
      this.postClaim(0, 0);
    } else {
      // 报告丢失模式
      const uid = app.globalData.uid;
      const serverUrl = app.globalData.serverUrl;
      if (!uid) {
        wx.showToast({ title: '用户标识异常，请重启小程序', icon: 'none' });
        return;
      }
      wx.showLoading({ title: '提交中...' });
      wx.request({
        url: app.resolveUrl(serverUrl) + '/user/loss',
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
            this.setData({ showModal: false, scanResult: '', yidValue: '', keyboardUp: false });
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
  },

  // 依次尝试候选学校地址 × 候选 key，任一成功即结束。
  // 一个账号有多套校服时，靠这个兜底保证一定问到真正持有该 YID 的学校。
  postClaim(ti, ki) {
    const targets = this._claimTargets || [];
    const keys = this._claimKeys || [];

    if (ti >= targets.length) {
      wx.hideLoading();
      wx.showToast({ title: this._claimError || '领取失败', icon: 'none' });
      return;
    }

    if (ki >= keys.length) {
      // 这家学校的候选 key 都不认，换下一家学校
      this.postClaim(ti + 1, 0);
      return;
    }

    wx.request({
      url: targets[ti] + '/user/get_loss',
      method: 'POST',
      data: {
        uid: this._claimUid,
        yid: this._claimYid,
        key: keys[ki]
      },
      success: (res) => {
        if (res.data && res.data.Status) {
          wx.hideLoading();
          wx.showToast({ title: '领取成功', icon: 'success' });
          this.setData({ showModal: false, scanResult: '', yidValue: '', keyboardUp: false });
          // 返回首页并刷新消息
          wx.navigateBack();
        } else {
          this._claimError = (res.data && res.data.Phrase) || '领取失败';
          this.postClaim(ti, ki + 1);
        }
      },
      fail: () => {
        // 这家学校联系不上，换下一家
        this.postClaim(ti + 1, 0);
      }
    });
  }
});
