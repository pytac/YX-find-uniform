[返回](../Readme.md#其他)

<a id="top"></a>

# 快捷跳转

- [跳转 service \ storage 格式](#service--storage-格式)
- [跳转 school \ storage 格式](#school--storage-格式)
- [跳转 school \ information 格式](#school--information-格式)

# 存储格式

`SID` 表示 `学校ID`

`YID` 表示 `服装ID`

`UID` 表示 `用户ID`

# service \ storage 格式

sotrage:

- `school_register_search`: 学校信息 (type: `Object`)
    - 存在多个
    - key: SID
    - value:
        - `name`: 学校名字
        - `password`: 密码
        - `school_service`: 学校服务地址

- `exist_school_name`: 存在的学校名字 (type: `Array`)
    - 存在多个
    - value: 学校名字

- `uniform_search`: 服装信息 (type: `Object`)
    - 存在多个
    - key: YID
    - value:
        - `is_active`: 是否激活 (type: `Boolean`)
        - `sid`: 学校ID
        - `detail`: 服装详情 (type: `Object` / `null`)
            - 若 `is_active` 为 `true` 时, 不为 `null`
            - `uid`: 用户ID
            - `student`: 学号 (type: `String`)


- <i> school_register: 注册学校信息 - 已废弃 </i>
- <i> uniform: 服装信息 - 已废弃 </i>
- <i> user_uniform: 用户服装信息 - 已废弃 </i>


<details>

<summary>表示代码（可跳过不看）</summary>

[跳转 school \ storage 格式](#school--storage-格式)

```python
storage = {
    # "school_register": [
    #     # 注册学校信息
    #     {
    #         "name": "名字",
    #         "password": "密码",
    #         "sid": "SID",
    #         "school_service": "学校服务地址"
    #     }, #...
    # ],
    "school_register_search": {
        "SID": {
            "name": "名字",
            "password": "密码",
            "school_service": "学校服务地址"
        }, # ...
    },
    "exist_school_name":[
        "name", #(学校名字)
    ]

    # "uniform": [
    #     服装信息
    #     {
    #         "yid": "YID",
    #         "is_active": True,
    #         "detail":{
    #             "uid": "用户ID",
    #         }
    #     },...
    # ],

    "uniform_search": {
        "YID": {
            "is_active": True,
            "sid": "SID",
            "detail":{
                "uid": "UID",
                "student": "学号"
            } # / None
        },# ...
    },

    "user_uniform":{
        "UID": [
            "YID", # ...
        ], # ...
    }
}
```

</details>

# school \ storage 格式

storage:

- `admin`: 管理员信息 (type: `Object`)
    - key: UID
    - value:
        - `username`: 管理员用户名
        - `password`: 管理员密码

- `uniform`: 服装信息 (type: `Object`)
    - 存在多个
    - key: YID
    - value:
        - `is_active`: 是否激活 (type: `Boolean`)
        - `sid`: 学校ID
        - `detail`: 服装详情 (type: `Object` / `null`)
            - 若 `is_active` 为 `true` 时, 不为 `null`
            - `uid`: 用户ID
            - `student`: 学号 (type: `String`)

<details>
<summary>表示代码（可跳过不看）</summary>

[跳转 school \ information 格式](#school--information-格式)

```python
storage = {
    "admin":{  # 管理员信息
        "username":"管理员用户名",
        "password":"管理员密码"
    },
    "uniform":{  # 服装信息
        "YID":{
            "is_active": True, # 是否激活 t/f
            "sid": "SID",
            "detail":{
                "uid": "UID",
                "student": "学号"
            } # / None
        } # ...
    }
}
```

</details>


# school \ information 格式

- information (type: `Object`)
    - 存在多个
    - key: UID
    - value:
        - 存在多个
        - key: 时间 (type: `Number`)
        - value:
            - `type`: 通知类型 (见下文, type: `Number`)
            - `time`: 通知时间 (type: `Number`)
            - `auto_delete`: 是否自动删除, `true` 为 15 天后自动自动删除 (type: `Boolean`)
            - `detail`: 通知详情 (见下文, type: `Object`)

- type - 通知类型 (type: `Number`)
    - `1`: 丢失通知
        - `detail` (type: `Object`)
            - `yid`: 服装ID
            - `name`: 学校名字
    - `2`: 通知用户已领取
        - `detail` (type: `Object`)
            - `yid`: 服装ID
            - `name`: 学校名字
    - `3`: 激活衣服通知
        - `detail` (type: `Object`)
            - `yid`: 服装ID
            - `name`: 学校名字
    - `4`: 学校删除衣服通知
        - `detail` (type: `Object`)
            - `yid`: 服装ID
            - `name`: 学校名字

<details>
<summary>表示代码（可跳过不看）</summary>

[回到开头](#top)

```python
"""
type:
    1 - 丢失通知 - detail: {"yid": yid, "name": school_name}
    2 - 通知用户已领取 - detail: {"yid": yid, "name": school_name}
    3 - 激活衣服通知 - detail: {"yid": yid, "name": school_name}
    4 - 学校删除衣服通知 - detail: {"yid": yid, "name": school_name}
"""
information = {
    "uid": {
        "time(id)": {
            "type": type,
            "time": time,
            "auto_delete": t/f #(15天后自动删除),
            "detail": {detail...}
        }
    }
}
```

</details>
