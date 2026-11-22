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
- - agent: 供 AI Agent 查看校服消息的 skill 文档


<a id="install"></a>

<<<<<<< HEAD
## 运行环境与依赖
=======
## 启动与依赖
>>>>>>> working

后端与制造商工具都是 Python 程序，要求 **Python 3.9 及以上**。依赖声明集中在仓库根目录，两种方式任选：

```
pip install -r requirements.txt   # 通用方式
uv sync                           # uv 复现（推荐）
```

| 程序 | 入口 | 依赖 | 默认监听 |
|---|---|---|---|
| 总服务器 | `service/service/main.py` | flask、requests | `0.0.0.0:5000` |
| 学校服务器 | `service/school/main.py` | flask、requests | `0.0.0.0:8888` |
| 制造商工具 | `user/maker/main.py` | flask、requests、qrcode[pil] | 命令行，无端口 |

启动方式：

```bash
uv sync                                   # 第一次：按 uv.lock 建 .venv 并装依赖
uv run python service/service/main.py     # 之后每次这样启动
uv run python service/school/main.py
uv run python user/maker/main.py
```

也可以激活虚拟环境后直接用解释器运行（等价）：

```bash
.venv\Scripts\activate                    # Windows
source .venv/bin/activate                 # Linux/macOS

python service/service/main.py

deactivate                                # 退出环境
```

已在 `Python 3.11` + `Flask 3.1.3` + `requests 2.34.2` + `qrcode 8.2` 环境下实测通过。

> `uv.lock` 是清华镜像源解析的，国内安装更快。若需改用官方源，执行 `uv lock --no-config` 重新解析即可。

### 学校服务器首次初始化

`service/school/main.py` 第一次启动（目录下还没有 `storage.json`）会依次询问：

| 询问 | 填什么 |
|---|---|
| `Type school name` | 学校名称，总服务器不允许重名 |
| `Type sid` | 学校 ID，全局唯一，注册后不要改 |
| `Type service url` | 总服务器地址，如 `192.168.2.128:5000`（会自动补 `http://`） |
| `是否在总服务器中注册？` | 回车 = 否；`y` = 现在注册 |
| 远程管理密码 | 学校在总服务器上的密码，会存进 `storage.json` 的 `admin.password_remote` |
| 本校对外服务地址 | 总服务器反向调用本站要用的地址，默认 `http://127.0.0.1:8888` |

选 `y` 时会直接调用总服务器的 `POST /school/register` 完成登记：

- **注册成功**：`sid` 立刻可用，制造商用这个 `sid` 生成的衣服才能正常激活；配置在启动时就落盘，不怕中途崩溃。
- **连不上 / 参数被拒**：会提示具体原因并让你重新填写重试，放弃也不影响启动，只是该 `sid` 在总服务器上不存在，
  之后手动 `POST /school/register` 补登记即可。
- **提示 `is exist`**：说明这个 `sid` 或校名已被总服务器占用。之前注册过同一所学校的话，选「当作已注册继续」即可。

想改学校名 / `sid` / 注册信息，删掉 `service/school/storage.json` 再启动一次即可重新初始化（**会丢弃已激活的校服记录**，先备份）。

## Agent 支持（查看校服消息）

`user/agent/SKILL.md` 是一份给 AI Agent 用的操作手册，描述「怎么查某个账号的校服和消息」

有了它，Agent 可以直接回答这类问题，用户不用自己在小程序里翻：

- 「我有哪些校服？」
- 「我 002 学号那件校服有人捡到吗？」

使用前提只需要一个参数：

| 参数 | 获取方式 |
|---|---|
| UID | 小程序「设置 → 用户UID → 复制」 |
| 服务器地址(若测试) | 查看服务器的 ip 与 服务器的端口 |

如果是问某一件具体的校服，还需要用户补充 **YID 和它对应的学校** —— 平台没有
「按 YID 反查学校」的接口，学校地址只能从账号的校服列表里拿到，或由用户告知。

> **能力边界**：Agent 只做查询和解释。**添加校服、领取丢失这两件事 AI 侧尚未完善，
> 必须由用户在小程序里扫码完成**，Agent 负责指路并事后核对结果。

> 注意：`uid` 由手机本地生成，Agent 无法自行推算，必须由用户提供。

<a id="other"></a>

## 其他

- [存储格式](docs/storage.md)
- [接口文档](docs/api.md)
- [Agent Skill：查看校服消息](user/agent/SKILL.md)

## 协议

本项目采用 `PolyForm-Noncommercial-1.0.0` 协议。详细请阅读 `LICENSE` 文件，或从 [官网](https://polyformproject.org/licenses/noncommercial/1.0.0/) 获取。

如要获取许可证，请用 [邮箱联系我(pythongchong@outlook.com)](mailto:pythonchong@outlook.com)

## 缺陷

这部分是这个项目的缺陷，因为**时间限制**，所以没有做， 所以**不可直接投入生产环境使用**

- 验证用户身份，避免“你不是人类”
- 密码使用明文存储，不安全，需要哈希加盐处理
- 数据库使用json文件，会有锁的冲突，占用内存大，容易保存不了数据。这里需要改成 SQL 数据库
