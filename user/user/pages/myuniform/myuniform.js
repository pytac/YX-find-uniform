const app = getApp();

Page({
  data: {
    uniformList: [],
    // 学校已删除、等待用户从小程序里移掉的校服数量
    pendingCount: 0
  },

  onShow() {
    // 本机存的校服可能已经被学校删掉（学校端删除时会推 type=4 删除通知），
    // 每次进页面都重新算一遍标记，再跟总服务器对一次
    this.loadUniforms();
    this.syncFromServer();
  },

  onPullDownRefresh() {
    this.syncFromServer(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 找出「学校已删除」的校服：来源是 type=4 删除通知。
  // 一个 YID 可能对应多条通知，取最新的一条用于显示删除时间。
  collectDeleteNotices() {
    const messages = app.getMessages() || {};
    const notices = {};
    Object.keys(messages).forEach((timeId) => {
      const msg = messages[timeId];
      if (!msg || Number(msg.type) !== 4) {
        return;
      }
      const yid = (msg.detail && msg.detail.yid) || '';
      if (!yid) {
        return;
      }
      const prev = notices[yid];
      if (!prev || (msg.timestamp || 0) >= (prev.timestamp || 0)) {
        notices[yid] = {
          time: msg.time || '',
          timestamp: msg.timestamp || 0
        };
      }
    });
    return notices;
  },

  loadUniforms() {
    const uniforms = wx.getStorageSync('uniforms') || [];
    const notices = this.collectDeleteNotices();
    // 上一次 /user/uniforms 成功返回过的 YID 集合。服务器只返回仍在册的校服，
    // 用来撤销已经被重新绑定的旧标记。
    const remoteYids = this._remoteYids || null;

    // 待清理的 YID 同时记在本机：用户把首页那条删除通知删掉之后，
    // 这里仍然认得出这件校服是学校删的，不会变成谁也清不掉的孤儿记录。
    const stored = app.getDeletedYids();
    const localYids = uniforms.map((u) => u.yid);
    let merged = stored.slice();
    Object.keys(notices).forEach((yid) => {
      if (merged.indexOf(yid) === -1) {
        merged.push(yid);
      }
    });
    if (remoteYids && remoteYids.length > 0) {
      // 服务器还在册的，说明又被重新绑上了，旧标记作废
      const alive = merged.filter((yid) => remoteYids.indexOf(yid) === -1);
      merged
        .filter((yid) => remoteYids.indexOf(yid) !== -1)
        .forEach((yid) => app.unmarkDeletedYid(yid));
      merged = alive;
    }
    // 已经从小程序里移除的校服不再需要标记，否则标记会越积越多
    merged = merged.filter((yid) => localYids.indexOf(yid) !== -1);
    if (JSON.stringify(merged) !== JSON.stringify(stored)) {
      app.markDeletedYids(merged);
    }

    // 只有服务器确实认得这个账号（至少有一件对得上）时，
    // 才把"本地有、服务器没有"判成已删除，避免换了服务器地址后全部误标
    const remoteKnowsAccount = !!(remoteYids && remoteYids.length > 0 &&
      uniforms.some((u) => remoteYids.indexOf(u.yid) !== -1));

    const list = uniforms.map((u) => {
      const notice = notices[u.yid] || null;
      const flagged = merged.indexOf(u.yid) !== -1;
      const missing = !flagged && remoteKnowsAccount && remoteYids.indexOf(u.yid) === -1;
      return {
        ...u,
        schoolLabel: u.schoolName || '未知学校',
        timeLabel: u.time || '—',
        deletedBySchool: flagged,
        noticeTime: notice ? notice.time : '',
        missingOnServer: missing
      };
    });

    this.setData({
      uniformList: list,
      pendingCount: list.filter((item) => item.deletedBySchool || item.missingOnServer).length
    });
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
        // 空列表说明这台服务器认定该账号名下没有校服，
        // 但可能是数据被重置，不据此标记任何一件为已删除
        this._remoteYids = remote.map((r) => r.yid);

        if (remote.length === 0) {
          this.loadUniforms();
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
        }
        this.loadUniforms();
        finish();
      },
      fail: () => {
        // 服务器不可达时保持本地数据不变
        finish();
      }
    });
  },

  onDeleteUniform(e) {
    const yid = e.currentTarget.dataset.yid;
    const item = (this.data.uniformList || []).find((u) => u.yid === yid) || {};
    const content = item.deletedBySchool
      ? '学校已经删除了这件校服（含学校登记信息），可以从小程序里移除。\n首页那条删除通知会保留，用于留档。'
      : '这件校服在服务器上已经查不到，可以从小程序里移除。\n首页那条删除通知会保留，用于留档。';

    wx.showModal({
      title: '移除校服',
      content,
      confirmText: '移除',
      confirmColor: '#E53935',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        this.removeUniform(yid);
      }
    });
  },

  removeUniform(yid) {
    const uniforms = wx.getStorageSync('uniforms') || [];
    wx.setStorageSync('uniforms', uniforms.filter((u) => u.yid !== yid));

    // 只清本地记录与标记，首页那条删除通知保留不动
    app.unmarkDeletedYid(yid);

    this.loadUniforms();
    wx.showToast({ title: '已移除', icon: 'success' });
  }
});
