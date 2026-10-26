const app = getApp();

Page({
  data: {
    messageList: [],
    unreadCount: 0,
    showAddModal: false,
    addYid: '',
    addStudent: '',
    showReportModal: false,
    reportYid: ''
  },

  onShow() {
    this.loadMessages();
  },

  loadMessages() {
    this.fetchMessagesFromServer();
  },

  // 获取已激活校服中保存的学校服务器地址（兼容旧逻辑，返回第一个）
  getSchoolServiceUrl() {
    const urls = app.collectSchoolUrls();
    return urls.length > 0 ? urls[0] : '';
  },

  // 清空消息缓存
  clearMessages() {
    app.globalData.messages = {};
    wx.setStorageSync('messages', {});
    this.setData({ messageList: [], unreadCount: 0 });
  },

  fetchMessagesFromServer() {
    const uid = app.globalData.uid;
    if (!uid) {
      this.clearMessages();
      return;
    }

    // 如果没有绑定校服，不发送 get_msg 请求
    const uniforms = wx.getStorageSync('uniforms') || [];
    if (uniforms.length === 0) {
      this.clearMessages();
      return;
    }

    // 一个账号可能有多套校服，且可能分属不同学校：
    // 必须把所有学校都问一遍再合并，只问第一个会漏掉其它学校的通知。
    const schools = app.collectSchoolUrls();
    if (schools.length === 0) {
      this.clearMessages();
      return;
    }

    const buckets = schools.map(() => null);
    let arrived = 0;
    // 请求序号：连点刷新时只认最后一次的结果，避免旧结果覆盖新结果
    const seq = (this._msgSeq || 0) + 1;
    this._msgSeq = seq;

    const merge = () => {
      if (this._msgSeq !== seq) {
        return;
      }
      app.globalData.messages = {};
      wx.setStorageSync('messages', {});
      schools.forEach((url, i) => {
        const bucket = buckets[i];
        if (!bucket || !bucket.msgs) {
          return;
        }
        Object.keys(bucket.msgs).forEach((rawKey) => {
          const msg = bucket.msgs[rawKey];
          if (!msg) {
            return;
          }
          const timeStr = this.timestampToStr(msg.time);
          app.addMessage({
            // 不同学校在同一秒也可能产生相同 key，加来源前缀防止互相覆盖
            time_id: url + '#' + rawKey,
            type: msg.type,
            time: timeStr,
            timestamp: msg.time,
            auto_delete: msg.auto_delete || false,
            detail: msg.detail || {},
            source: url,
            rawKey: rawKey
          });
        });
      });

      const messages = app.getMessages();
      const list = Object.keys(messages).map((timeId) => ({
        timeId,
        ...messages[timeId]
      }));
      // 按时间戳降序排列：越晚的消息越在上面
      list.sort((a, b) => {
        const tsA = a.timestamp || 0;
        const tsB = b.timestamp || 0;
        return tsB - tsA;
      });
      this.setData({
        messageList: list,
        unreadCount: list.length
      });
    };

    schools.forEach((schoolUrl, index) => {
      wx.request({
        url: schoolUrl + '/user/get_msg',
        method: 'POST',
        data: { uid },
        success: (res) => {
          if (res.data && res.data.Status) {
            buckets[index] = {
              url: schoolUrl,
              msgs: (res.data.Detail && res.data.Detail.msg) || {}
            };
          }
        },
        fail: (err) => {
          console.error('[get_msg] 请求失败', schoolUrl, err && err.errMsg);
        },
        complete: () => {
          arrived += 1;
          if (arrived < schools.length) {
            return;
          }
          merge();
          // 所有学校都不可达时才提示，只要有一家通了就正常展示
          const onlineCount = buckets.filter((b) => b).length;
          if (onlineCount === 0) {
            wx.showToast({ title: '未连接到服务器', icon: 'none' });
          }
        }
      });
    });
  },

  onRefresh() {
    wx.showToast({
      title: '刷新中...',
      icon: 'loading',
      duration: 1000
    });
    this.fetchMessagesFromServer();
  },

  // 删除消息（非丢失通知）
  onDeleteMsg(e) {
    const timeId = e.currentTarget.dataset.timeid;
    const uid = app.globalData.uid;
    if (!uid) {
      wx.showToast({ title: '用户标识异常，请重启小程序', icon: 'none' });
      return;
    }

    // 多校服时消息可能来自不同学校，必须回到它自己那台学校服务器上删，
    // 否则会去错的学校删、删不掉又看不出原因
    const msg = (this.data.messageList || []).find((m) => m.timeId === timeId) || {};
    const source = msg.source || app.findSchoolByYid((msg.detail && msg.detail.yid) || '') || '';
    const rawKey = msg.rawKey || timeId;

    const removeLocal = () => {
      const local = wx.getStorageSync('messages') || {};
      if (local[timeId]) {
        delete local[timeId];
        app.globalData.messages = local;
        wx.setStorageSync('messages', local);
      }
      this.setData({ messageList: (this.data.messageList || []).filter((m) => m.timeId !== timeId) });
    };

    // 本地自己插的通知（没有来源学校）直接删本地
    if (!source) {
      removeLocal();
      wx.showToast({ title: '已删除', icon: 'success' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: source + '/user/del_msg',
            method: 'POST',
            data: { uid, key: rawKey },
            success: (res2) => {
              if (res2.data && res2.data.Status) {
                wx.showToast({ title: '删除成功', icon: 'success' });
                this.fetchMessagesFromServer();
              } else {
                wx.showToast({ title: app.phraseText(res2.data && res2.data.Phrase, '删除失败'), icon: 'none' });
              }
            },
            fail: () => {
              wx.showToast({ title: '请求失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 领取丢失衣物（丢失通知 → 扫码输入YID → 调用API）
  onClaimLoss(e) {
    const timeId = e.currentTarget.dataset.timeid;
    const yid = e.currentTarget.dataset.yid;
    const uid = app.globalData.uid;
    if (!uid) {
      wx.showToast({ title: '用户标识异常，请重启小程序', icon: 'none' });
      return;
    }

    const msg = (this.data.messageList || []).find((m) => m.timeId === timeId) || {};
    // 把消息来源学校一起带过去，领取时才能问对学校
    const source = encodeURIComponent(msg.source || app.findSchoolByYid(yid) || '');

    // 跳转到扫码/输入页面，传入参数
    wx.navigateTo({
      url: `/pages/scan/scan?mode=claimLoss&timeId=${encodeURIComponent(timeId)}&yid=${encodeURIComponent(yid)}&source=${source}&key=${encodeURIComponent(msg.rawKey || timeId)}`
    });
  },

  timestampToStr(ts) {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  goToMyUniform() {
    wx.navigateTo({
      url: '/pages/myuniform/myuniform'
    });
  },

  // 添加校服 → 跳转到独立的添加校服页面
  goToScanAdd() {
    const uid = app.globalData.uid;
    if (!uid) {
      wx.showToast({
        title: '用户标识异常，请重启小程序',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/adduniform/adduniform'
    });
  },

  // 报告丢失 → 跳转到独立的报告丢失页面
  goToScanReport() {
    const uid = app.globalData.uid;
    if (!uid) {
      wx.showToast({
        title: '用户标识异常，请重启小程序',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/reportloss/reportloss'
    });
  },

  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  }
});
