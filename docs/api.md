[返回](../Readme.md#其他)

# 总览

系统的所有接口，包括总服务器端、学校端的接口。

## 统一响应格式
```json
{
  "Phrase": "描述信息",
  "Status": true/false,
  "Detail": {}
}
```

## 接口索引

- [总服务器端（Central Server）](#总服务器端central-server)
  - [1. 生成衣物ID - /maker/make](#1-生成衣物id)
  - [2. 学校注册 - /school/register](#2-学校注册)
  - [3. 用户激活衣物 - /user/enable](#3-用户激活衣物)
  - [4. 上报衣物丢失 - /user/loss](#4-上报衣物丢失)
  - [5. 学校删除衣物 - /school/delete](#5-学校删除衣物)
- [学校端（School Server）](#学校端school-server)
  - [1. 激活衣物（学校本地） - /service/enable](#1-激活衣物学校本地)
  - [2. 获取用户消息 - /user/get_msg](#2-获取用户消息)
  - [3. 删除用户消息 - /user/del_msg](#3-删除用户消息)
  - [4. 上报衣物丢失（学校本地） - /service/loss](#4-上报衣物丢失学校本地)
  - [5. 用户领取丢失衣物 - /user/get_loss](#5-用户领取丢失衣物)
  - [6. 管理员删除衣物 - /admin/delete](#6-管理员删除衣物)

---

# 总服务器端（Central Server）

总服务器运行于中心节点，负责学校注册、衣物ID生成、用户激活/丢失上报的跨校转发以及学校端衣物删除的同步。  
**默认地址**：`http://127.0.0.1:5000`（可在启动时修改）

## 1. 生成衣物ID
**`POST /maker/make`**

为指定学校生成一个未激活的衣物唯一标识（YID）。

**请求体 (JSON)**
| 字段  | 类型   | 必填 | 说明                                   |
|-------|--------|------|----------------------------------------|
| `sid` | string | 是   | 学校ID（需已注册）                      |
| `yid` | string | 否   | 仅在调试模式（`--agree-debug`）下可指定 |

**成功响应**
```json
{
  "Phrase": "Make uniform success",
  "Status": true,
  "Detail": {
    "YID": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**错误响应**
- 缺少 `sid`：400 `{"Phrase":"sid is required", "Status":false}`
- `sid` 不存在：404 `{"Phrase":"sid not found", "Status":false}`

---

## 2. 学校注册
**`POST /school/register`**

新学校在总服务器注册，信息包括名称、ID、密码及本校服务地址。

**请求体 (JSON)**
| 字段              | 类型   | 必填 | 说明                     |
|-------------------|--------|------|--------------------------|
| `name`            | string | 是   | 学校名称                 |
| `sid`             | string | 是   | 学校ID（全局唯一）        |
| `password`        | string | 是   | 管理员密码               |
| `school_service`  | string | 是   | 本校服务的根URL          |

**成功响应**
```json
{
  "Phrase": "register successfully",
  "Status": true,
  "Detail": {}
}
```

**错误响应**
- 缺少必填字段：400 `{"Phrase":"{field} is required", "Status":false}`
- 学校名称或 `sid` 已存在：400 `{"Phrase":"name (xxx) is exist", "Status":false}`

---

## 3. 用户激活衣物
**`POST /user/enable`**

用户绑定并激活某衣物，总服务器会通知对应学校进行本地激活，并将本地的衣物状态更新为 `is_active: true`。

**请求体 (JSON)**
| 字段      | 类型   | 必填 | 说明                     |
|-----------|--------|------|--------------------------|
| `yid`     | string | 是   | 衣物ID                   |
| `uid`     | string | 是   | 用户ID                   |
| `student` | string | 是   | 学号（如 `"20240101"`）  |

**成功响应**
```json
{
  "Phrase": "enable successfully",
  "Status": true,
  "Detail": {
    "school_service": "http://school.example.com",
    "name": "某某学校"
  }
}
```

**错误响应**
- 缺少必填字段：400
- `yid` 不存在：404 `{"Phrase":"yid not found", "Status":false}`
- 衣物已激活：423 `{"Phrase":"yid is already active", "Status":false}`
- 通知学校失败：状态码随学校返回，`Detail` 中包含学校返回的错误信息

---

## 4. 上报衣物丢失
**`POST /user/loss`**

用户上报衣物丢失，总服务器会转发丢失通知到对应学校。

**请求体 (JSON)**
| 字段  | 类型   | 必填 | 说明   |
|-------|--------|------|--------|
| `yid` | string | 是   | 衣物ID |

**成功响应**
```json
{
  "Phrase": "lossing report successfully",
  "Status": true,
  "Detail": {
    "sid": "学校ID"
  }
}
```

**错误响应**
- `yid` 不存在：404 `{"Phrase":"yid not found", "Status":false}`
- 衣物未激活：423 `{"Phrase":"yid is not active", "Status":false}`
- 通知学校失败：状态码随学校返回，`Detail` 中包含学校错误信息

---

## 5. 学校删除衣物
**`POST /school/delete`**

学校管理员验证密码后，从总服务器删除衣物记录（仅删除，不通知学校端）。

**请求体 (JSON)**
| 字段       | 类型   | 必填 | 说明               |
|------------|--------|------|--------------------|
| `yid`      | string | 是   | 衣物ID             |
| `sid`      | string | 是   | 学校ID             |
| `password` | string | 是   | 学校管理员密码     |

**成功响应**
```json
{
  "Phrase": "delete successfully",
  "Status": true,
  "Detail": {}
}
```

**错误响应**
- 密码错误：403 `{"Phrase":"forbidden", "Status":false}`
- `yid` 不存在或不属于该学校：404 `{"Phrase":"yid not found", "Status":false}`
- 衣物未激活：423 `{"Phrase":"yid is not active", "Status":false}`

---

# 学校端（School Server）

学校端运行于各学校本地，负责本校衣物的激活、用户消息的存储与查询、丢失上报的处理以及管理员删除衣物。  
**默认地址**：`http://127.0.0.1:8888`（当前版本启动时绑定 `192.168.101.7:8888`）

## 1. 激活衣物（学校本地）
**`POST /service/enable`**

由总服务器调用，将衣物标记为已激活，并给用户发送一条“已领取”消息（type=2）。

**请求体 (JSON)**
| 字段      | 类型   | 必填 | 说明                     |
|-----------|--------|------|--------------------------|
| `yid`     | string | 是   | 衣物ID                   |
| `uid`     | string | 是   | 用户ID                   |
| `student` | string | 是   | 学号                     |

**成功响应**
```json
{
  "Phrase": "enable success",
  "Status": true,
  "Detail": {}
}
```
同时用户会收到一条 type=2 的消息（“通知用户已领取”）。

---

## 2. 获取用户消息
**`POST /user/get_msg`**

查询指定用户的所有消息（包括丢失通知、领取通知、删除通知等）。

**请求体 (JSON)**
| 字段  | 类型   | 必填 | 说明   |
|-------|--------|------|--------|
| `uid` | string | 是   | 用户ID |

**成功响应**
```json
{
  "Phrase": "get msg success",
  "Status": true,
  "Detail": {
    "msg": {
      "1716700000": {
        "type": 1,
        "time": 1716700000,
        "auto_delete": false,
        "detail": {
          "yid": "some_yid",
          "name": "学校名称"
        }
      }
    }
  }
}
```
> 说明：`msg` 对象中键为时间戳的字符串形式，值为消息详情。  
> **消息类型**：1-丢失通知，2-通知用户已领取，3-激活衣服通知（实际使用2），4-学校删除衣服通知。

---

## 3. 删除用户消息
**`POST /user/del_msg`**

用户手动删除一条非丢失通知的消息（类型为1的丢失通知不允许删除）。

**请求体 (JSON)**
| 字段  | 类型   | 必填 | 说明                       |
|-------|--------|------|----------------------------|
| `uid` | string | 是   | 用户ID                     |
| `key` | string | 是   | 消息的键（即时间戳字符串） |

**成功响应**
```json
{
  "Phrase": "delete msg success",
  "Status": true,
  "Detail": {
    "key": "1716700000"
  }
}
```

**错误响应**
- `uid` 不存在：404 `{"Phrase":"uid not found", "Status":false}`
- `key` 不存在：404 `{"Phrase":"key not found", "Status":false}`
- 消息类型为 1（丢失通知）：423 `{"Phrase":"loss information cannot be deleted", "Status":false}`

---

## 4. 上报衣物丢失（学校本地）
**`POST /service/loss`**

由总服务器调用，标记衣物丢失并给用户发送一条丢失通知（type=1）。

**请求体 (JSON)**
| 字段  | 类型   | 必填 | 说明   |
|-------|--------|------|--------|
| `yid` | string | 是   | 衣物ID |

**成功响应**
```json
{
  "Phrase": "lossing report successful",
  "Status": true,
  "Detail": {}
}
```
同时用户会收到一条 type=1 的消息（不会自动删除）。

**错误响应**
- `yid` 不存在：404 `{"Phrase":"yid not found", "Status":false}`

---

## 5. 用户领取丢失衣物
**`POST /user/get_loss`**

用户确认已找回丢失衣物，系统会删除对应的丢失通知（type=1）并追加一条领取成功通知（type=2）。

**请求体 (JSON)**
| 字段  | 类型   | 必填 | 说明                               |
|-------|--------|------|------------------------------------|
| `uid` | string | 是   | 用户ID                             |
| `yid` | string | 是   | 衣物ID                             |
| `key` | string | 是   | 对应丢失通知的消息键（时间戳字符串）|

**成功响应**
```json
{
  "Phrase": "get loss success",
  "Status": true,
  "Detail": {
    "yid": "xxx",
    "key": "1716700000"
  }
}
```
同时，该条丢失通知被删除，并新增一条 type=2 的消息（自动15天后删除）。

**错误响应**
- `uid` 或 `key` 不存在：404
- 消息类型不是 1：404 `{"Phrase":"key is not loss information", ...}`
- `detail.yid` 与请求中的 `yid` 不匹配：404
- 衣物不存在或不属于该用户：404 或 403

---

## 6. 管理员删除衣物
**`POST /admin/delete`**

学校管理员验证本地密码后，请求总服务器删除该衣物，并给用户发送一条删除通知（type=4）。

**请求体 (JSON)**
| 字段              | 类型   | 必填 | 说明                       |
|-------------------|--------|------|----------------------------|
| `password_local`  | string | 是   | 学校本地管理员密码         |
| `password_remote` | string | 是   | 总服务器管理员密码（用于验证） |
| `yid`             | string | 是   | 衣物ID                     |

**成功响应**
```json
{
  "Phrase": "delete uniform",
  "Status": true,
  "Detail": {}
}
```
同时，该用户的 type=4 消息会被添加（自动15天后删除）。

**错误响应**
- 本地密码错误：403 `{"Phrase":"forbidden", "Status":false}`
- `yid` 不存在：404 `{"Phrase":"yid not found", ...}`
- 远程删除失败：状态码随总服务器返回，`Detail` 包含远程错误信息

---

> **注**：以上接口均不包含以 `/tect` 开头的测试接口。所有时间戳均为秒级（`int(time())`）。消息的自动清理机制：`auto_delete=true` 的消息将在 15 天后被后台线程自动删除。