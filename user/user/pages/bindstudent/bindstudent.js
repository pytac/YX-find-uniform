const app = getApp();

Page({
  data: {
    yid: '',
    studentValue: ''
  },

  onLoad(options) {
    const yid = options.yid || '';
    this.setData({ yid });
    wx.setNavigationBarTitle({ title: '绑定校服' });
  },

  onStudentInput(e) {
    this.setData({ studentValue: e.detail.value });
  },

  onSubmit() {
    const { yid, studentValue } = this.data;
    if (!studentValue || !studentValue.trim()) {
      wx.showToast({ title: '请输入学号', icon: 'none' });
      return;
    }

    const uid = app.globalData.uid;
    // 统一走 normalizeServerUrl：缺 http:// 也能修好，否则请求发不出去
    const serverUrl = app.normalizeServerUrl(app.globalData.serverUrl);
    const targetUrl = serverUrl + '/user/enable';

    if (!uid) {
      wx.showToast({ title: '用户标识异常，请重启小程序', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    wx.request({
      url: targetUrl,
      method: 'POST',
      timeout: 8000,
      data: {
        yid: yid,
        uid: uid,
        student: studentValue.trim()
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data && res.data.Status) {
          const now = new Date();
          const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
          app.addMessage({
            time_id: Date.now().toString(),
            type: 3,
            time: timeStr,
            auto_delete: true,
            detail: { yid, name: '校服' }
          });
          // 保存校服信息到本地，包括学校服务器地址
          this.saveUniform(yid, studentValue.trim(), timeStr, res.data.Detail);
          wx.showToast({ title: '绑定成功', icon: 'success' });
          // 延迟一会儿再跳转到主页
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/index/index' });
          }, 1500);
        } else {
          wx.showToast({ title: app.phraseText(res.data && res.data.Phrase, '绑定失败'), icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        const errMsg = (err && err.errMsg) || '未知错误';
        console.error('[enable] 请求失败', targetUrl, errMsg);
        // 把实际请求地址和微信给的错误原因直接显示出来，避免只看到一句"网络错误"
        let hint = '';
        if (errMsg.indexOf('domain list') >= 0) {
          hint = '\n\n域名校验未通过：请在开发者工具「详情 → 本地设置」勾选"不校验合法域名"，真机需打开调试模式。';
        } else if (errMsg.indexOf('timeout') >= 0) {
          hint = '\n\n连接超时：手机和电脑要在同一个 Wi-Fi 下，且电脑防火墙需放行该端口。';
        }
        wx.showModal({
          title: '连接服务器失败',
          content: `请求地址：${targetUrl}\n错误：${errMsg}${hint}`,
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  saveUniform(yid, student, time, detail) {
    const uniforms = wx.getStorageSync('uniforms') || [];
    const exists = uniforms.some(item => item.yid === yid);
    if (!exists) {
      const uniform = { yid, student, time };
      // 记录学校名称和学校服务器地址
      if (detail) {
        uniform.schoolName = detail.name || '';
        // 服务端可能返回 127.0.0.1（初始化模板遗留），存之前先纠成局域网地址
        uniform.schoolService = app.resolveUrl(detail.school_service || '');
      }
      uniforms.push(uniform);
      wx.setStorageSync('uniforms', uniforms);
    }
  }
});
