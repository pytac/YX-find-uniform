const app = getApp();

Page({
  data: {
    uniformList: []
  },

  onShow() {
    this.loadUniforms();
  },

  loadUniforms() {
    const uniforms = wx.getStorageSync('uniforms') || [];
    this.setData({ uniformList: uniforms });
  }
});