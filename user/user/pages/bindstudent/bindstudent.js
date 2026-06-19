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
    const serverUrl = app.globalData.serverUrl;

    if (!uid) {
      wx.showToast({ title: '请先在设置中填写UID', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    wx.request({
      url: serverUrl + '/user/enable',
      method: 'POST',
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
          wx.showToast({ title: res.data.Phrase || '绑定失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误，请检查服务器', icon: 'none' });
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
        uniform.schoolService = detail.school_service || '';
      }
      uniforms.push(uniform);
      wx.setStorageSync('uniforms', uniforms);
    }
  }
});
