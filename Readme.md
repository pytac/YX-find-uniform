# 衣寻 - 找到你的衣服

## 介绍

这个系统是一个基于 `微信小程序` (前端) 和 `flask` (后端)，用于寻找丢失的衣服（特别是校服）。

## 项目规划

- service: 后端
- - school: 学校相关接口
- - service: 服务相关接口
- gui: 前端
- - <i>暂时未制作</i>
- - maker: 制造商界面
- - school: 学校界面
- - user: 普通用户界面

## 协议

本项目采用 `PolyForm-Noncommercial-1.0.0` 协议。详细请阅读 `LICENSE` 文件，或从 [官网](https://polyformproject.org/licenses/noncommercial/1.0.0/) 获取。

如要获取许可证，请用 [邮箱联系我(pythongchong@outlook.com)](mailto:pythonchong@outlook.com)


# 其他

## service \ storage 格式

```plaintext
SID: 学校ID
YID: 衣服ID
UID: 用户ID

storage:
{
    "school_register": [
        注册学校信息
        {
            "name": "名字",
            "password": "密码",
            "sid": "SID"
        },...
    ],
    "school_register_search": {
        "SID": {
            "name": "名字",
            "password": "密码"
        },...
    },
    "exist_school_name":[
        "name", (学校名字)
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
            "detail":{
                "uid": "UID",
            } / None
        },...
    },

    "user_uniform":{
        "UID": [
            "YID",...
        ],...
    }
}
```