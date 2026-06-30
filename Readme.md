# 衣寻 - 找到你的衣服

## 介绍

这个系统是一个基于 `微信小程序` (用户前端) 和 `flask` (后端)，用于寻找丢失的衣服（特别是校服）。

## 项目规划

- service: 后端
- - school: 学校相关接口
- - service: 服务相关接口
- user: 用户端
- - user: 普通用户界面
- - maker: 制造商界面


<a id="other"></a>

## 其他

- [存储格式](docs/storage.md)
- [接口文档](docs/api.md)

## 协议

本项目采用 `PolyForm-Noncommercial-1.0.0` 协议。详细请阅读 `LICENSE` 文件，或从 [官网](https://polyformproject.org/licenses/noncommercial/1.0.0/) 获取。

如要获取许可证，请用 [邮箱联系我(pythongchong@outlook.com)](mailto:pythonchong@outlook.com)

## 缺陷

这部分是这个项目的缺陷，因为**时间限制**，所以没有做， 所以**不可直接投入生产环境使用**

- 验证用户身份，避免“你不是人类”
- 密码使用明文存储，不安全，需要哈希加盐处理
- 数据库使用json文件，会有锁的冲突，占用内存大，容易保存不了数据。这里需要改成 SQL 数据库

## 代办

- [  ] 制作制造商接口