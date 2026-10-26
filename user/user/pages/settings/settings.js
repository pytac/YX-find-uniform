const app = getApp();

Page({
  data: {
    serverUrl: '',
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

  // 复制 UID：换手机或清缓存前可以先存一份，方便对照
  copyUid() {
    const uid = this.data.uid || '';
    if (!uid) {
      wx.showToast({
        title: 'UID 尚未生成',
        icon: 'none'
      });
      return;
    }
    if (!wx.setClipboardData) {
      wx.showToast({
        title: '请长按 UID 手动复制',
        icon: 'none'
      });
      return;
    }
    wx.setClipboardData({
      data: uid,
      success: () => {
        wx.showToast({
          title: 'UID 已复制',
          icon: 'success'
        });
      },
      fail: () => {
        // 部分机型/隐私设置下剪贴板不可用，退回长按选择
        wx.showToast({
          title: '复制失败，请长按 UID 选择',
          icon: 'none'
        });
      }
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
    // 缺 http:// 自动补上，回环地址自动换成局域网 IP
    url = app.normalizeServerUrl(url);
    app.saveServerUrl(url);
    this.setData({ serverUrl: url });
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 直接把请求打过去做一次连通性探测，成功/失败原因都显示出来，
  // 避免只看到一句笼统的"未连接服务器"却不知道卡在哪一步。
  testConnection() {
    const baseUrl = app.normalizeServerUrl(this.data.serverUrl);
    this.setData({ serverUrl: baseUrl });
    const target = baseUrl + '/maker/check_sid';

    wx.showLoading({ title: '测试中...' });
    wx.request({
      url: target,
      method: 'POST',
      timeout: 6000,
      // check_sid 只做存在性判断，传一个不存在的 sid 不会写入任何数据
      data: { sid: '__connectivity_probe__' },
      success: (res) => {
        wx.hideLoading();
        const data = res.data;
        if (data && typeof data.Status !== 'undefined') {
          wx.showModal({
            title: '连接成功',
            content: `服务器可访问：\n${target}\n\n返回状态码 ${res.statusCode}`,
            showCancel: false,
            confirmText: '好'
          });
        } else {
          wx.showModal({
            title: '地址可达，但返回内容不对',
            content: `${target}\n\n这个地址能访问，但返回的不是本项目的接口格式。\n请确认端口（总服务器是 5000，学校端是 8888）。`,
            showCancel: false
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        const errMsg = (err && err.errMsg) || '未知错误';
        console.error('[settings] 连通性测试失败', target, errMsg);

        let hint = '';
        if (errMsg.indexOf('domain list') >= 0) {
          hint = '域名校验未通过：开发者工具「详情 → 本地设置」勾选"不校验合法域名"，真机需打开调试模式。';
        } else if (errMsg.indexOf('timeout') >= 0) {
          hint = '连接超时：确认手机与电脑在同一 Wi-Fi，且电脑防火墙放行该端口。';
        } else if (errMsg.indexOf('localhost') >= 0 || errMsg.indexOf('127.0.0.1') >= 0) {
          hint = '地址是回环地址，请改成本机的局域网 IP。';
        } else {
          hint = '确认服务已启动（python main.py）、地址和端口填写正确。';
        }

        wx.showModal({
          title: '连接失败',
          content: `请求地址：${target}\n错误：${errMsg}\n\n${hint}`,
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  }
});
