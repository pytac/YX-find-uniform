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
    // 弹窗里填的 YID 和这条丢失记录不是同一件时置 true，用于提示
    claimMismatch: false,
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
    this.syncClaimMismatch();
  },

  // 领取丢失时，弹窗里的 YID 和这条记录是否对得上
  syncClaimMismatch() {
    if (this.data.mode !== 'claimLoss') {
      return;
    }
    const claimYid = this.data.claimYid || '';
    const cur = (this.data.scanResult || '').trim();
    const mismatch = !!(claimYid && cur && cur !== claimYid);
    if (mismatch !== !!this.data.claimMismatch) {
      this.setData({ claimMismatch: mismatch });
    }
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
    this.syncClaimMismatch();
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
    this.syncClaimMismatch();
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
      // 记录这次填的 YID 与丢失记录是否一致，失败时据此给出不同的说明
      this._claimEdited = scanResult !== (this.data.claimYid || '');
      this._claimPhrases = [];
      this._claimTried = 0;
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
            wx.showToast({
              title: app.phraseText(res.data && res.data.Phrase, '报告失败'),
              icon: 'none'
            });
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
      this.showClaimFailure();
      return;
    }

    if (ki >= keys.length) {
      // 这家学校的候选 key 都不认，换下一家学校
      this.postClaim(ti + 1, 0);
      return;
    }

    this._claimTried = (this._claimTried || 0) + 1;

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
          this.setData({ showModal: false, scanResult: '', yidValue: '', keyboardUp: false, claimMismatch: false });
          // 返回首页并刷新消息
          wx.navigateBack();
        } else {
          const phrase = (res.data && res.data.Phrase) || '';
          if (phrase) {
            this._claimPhrases = this._claimPhrases || [];
            if (this._claimPhrases.indexOf(phrase) === -1) {
              this._claimPhrases.push(phrase);
            }
          } else {
            this._claimBadResponse = true;
          }
          this.postClaim(ti, ki + 1);
        }
      },
      fail: () => {
        // 这家学校联系不上，换下一家
        this._claimUnreachable = true;
        this.postClaim(ti + 1, 0);
      }
    });
  },

  // 领取失败时的说明：必须让用户看懂"是扫错了、还是记录废了、还是网络不通"，
  // 不能把服务端的 "key not found" 原样弹出来。
  showClaimFailure() {
    const phrases = this._claimPhrases || [];
    const claimYid = this.data.claimYid || '';
    const typedYid = this._claimYid || '';
    const has = (p) => phrases.indexOf(p) !== -1;

    // 扫到/输入的 YID 和这条丢失记录不是同一件
    if (has('yid is not belong to key')) {
      const lines = ['扫到的校服和这条丢失记录对不上，无法领取。'];
      if (claimYid) {
        lines.push('');
        lines.push('记录中的 YID：' + claimYid);
      }
      if (typedYid && typedYid !== claimYid) {
        lines.push('你当前填的 YID：' + typedYid);
      }
      lines.push('');
      lines.push('请重新扫描这件校服上的二维码；如果确认记录有误，请联系学校处理。');
      wx.showModal({
        title: '领取失败',
        content: lines.join('\n'),
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // 记录本身没了：已领取、已被删除或超过保留期
    if (has('key not found') || has('key is not loss information')) {
      wx.showModal({
        title: '领取失败',
        content: '这条丢失记录已经失效（可能已被领取，或已被学校删除）。\n请在首页下拉刷新消息后再看，列表里没有这条就说明已经处理完了。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // 校服不属于当前账号
    if (has('yid is not belong to uid')) {
      wx.showModal({
        title: '领取失败',
        content: '这件校服不属于当前账号，无法领取。\n请用当初绑定这件校服的设备（或找学校核实绑定信息）。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    if (phrases.length === 0) {
      // 一个响应都没拿到，基本都是网络/服务器问题
      wx.showToast({
        title: this._claimUnreachable ? '连不上学校服务器，请检查网络' : '领取失败，请稍后重试',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '领取失败',
      content: app.phraseText(phrases[0], '领取失败，请核对 YID 后重试') + '。\n请核对二维码或 YID 后再试。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
