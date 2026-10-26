const app = getApp();

Page({
  data: {
    uniformList: []
  },

  onShow() {
    this.loadUniforms();
    // 一个账号可能有多套校服：本机记录可能不全（换手机、清缓存、旧版本没存学校信息），
    // 每次进来都跟总服务器对一遍，缺的补上。
    this.syncFromServer();
  },

  onPullDownRefresh() {
    this.syncFromServer(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadUniforms() {
    const uniforms = wx.getStorageSync('uniforms') || [];
    const list = uniforms.map((u) => ({
      ...u,
      schoolLabel: u.schoolName || '未知学校',
      timeLabel: u.time || '—'
    }));
    this.setData({ uniformList: list });
  },

  // 从总服务器按 uid 拉取该用户名下的全部校服，与本地记录合并
  syncFromServer(done) {
    const finish = () => {
      if (typeof done === 'function') {
        done();
      }
    };

    const uid = app.globalData.uid;
    if (!uid) {
      finish();
      return;
    }

    const serverUrl = app.resolveUrl(app.globalData.serverUrl);
    if (!serverUrl) {
      finish();
      return;
    }

    wx.request({
      url: serverUrl + '/user/uniforms',
      method: 'POST',
      data: { uid },
      success: (res) => {
        if (!res.data || !res.data.Status) {
          finish();
          return;
        }
        const remote = (res.data.Detail && res.data.Detail.uniforms) || [];
        if (remote.length === 0) {
          finish();
          return;
        }

        const uniforms = wx.getStorageSync('uniforms') || [];
        let changed = false;

        remote.forEach((r) => {
          const schoolService = app.resolveUrl(r.school_service || '');
          const idx = uniforms.findIndex((u) => u.yid === r.yid);

          if (idx === -1) {
            // 远端有、本地没有：补回来（绑定时间为空表示是同步恢复的）
            uniforms.push({
              yid: r.yid,
              student: r.student || '',
              time: '',
              schoolName: r.school_name || '',
              schoolService: schoolService,
              restored: true
            });
            changed = true;
            return;
          }

          // 本地有但缺学校信息（早期版本没存），补齐
          const item = uniforms[idx];
          if (!item.schoolService && schoolService) {
            item.schoolService = schoolService;
            changed = true;
          }
          if (!item.schoolName && r.school_name) {
            item.schoolName = r.school_name;
            changed = true;
          }
        });

        if (changed) {
          wx.setStorageSync('uniforms', uniforms);
          this.loadUniforms();
        }
        finish();
      },
      fail: () => {
        // 服务器不可达时保持本地数据不变
        finish();
      }
    });
  }
});
