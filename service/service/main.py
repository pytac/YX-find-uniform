
import flask               # 服务器搭建
import json,os             # 保存数据
from time import time      # 获取时间戳
import hashlib             # 生成哈希值
import sys                 # 获取命令行参数

# 初始化 --------------------------------

storage_file = os.path.join(os.path.dirname(__file__), 'storage.json')

agree_debug = False

def start_init_agree_debug():
    global agree_debug
    argv = sys.argv[1:]
    if len(argv) > 0 and '--agree-debug' in argv:
        agree_debug = True

storage = None

def start_init_storage():
    '''
    SID: 学校ID
    YID: 衣服ID
    UID: 用户ID

    storage:
    {
        "school_register": [               --> list [ dict ]
            注册学校信息
            {
                "name": "名字",
                "password": "密码",
                "sid": "SID"
            },...
        ],
        "school_register_search": {       --> dict [ dict ]
            "SID": {
                "name": "名字",
                "password": "密码"
            },...
        },
        "exist_school_name":[             --> list [ str ]
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
        "uniform_search": {               --> dict [ dict ]
            "YID": {
                "is_active": True,
                "detail":{
                    "uid": "用户ID",
                }
            },...
        }
    }
    '''
    
    global storage
    if not os.path.exists(storage_file):
        storage = {
            # 学校注册 sid,yid,uid 键值统一小写
            "school_register": [
                {
                    "name": "Example School",
                    "password": "ExamplePassword",
                    "sid": "Example"
                }
            ],
            "school_register_search": {
                "Example": {
                    "name": "Example School",
                    "password": "ExamplePassword"
                }
            },
            "exist_school_name":[
                "Example School",
            ],


            # "uniform": [
            #     {
            #         "yid": "ExampleY",             # 衣服ID: generate_uniform_id(学校ID, 时间戳, 批次)
            #         "is_active": True,
            #         "detail":{
            #             "uid": "ExampleUser",
            #         }
            #     }
            # ],
            "uniform_search": {
                "ExampleY": {
                    "is_active": True,
                    "detail":{
                        "uid": "ExampleUser",
                    }
                }
            }
        }
        with open(storage_file, 'w') as f:
            json.dump(storage, f, indent=4)
            # json.dump(storage, f)
    else:
        with open(storage_file, 'r') as f:
            storage = json.load(f)

batch =  1 # 批次，四位数


# 结束 --------------------------------
def end_storage():
    print("saving!")
    with open(storage_file, 'w') as f:
        f.write(json.dumps(storage, indent=4))
        # json.dump(storage, f)

# 必要函数 --------------------------------

# 生成服装ID
def generate_uniform_id(school_id, timestamp, batch):
    print(school_id, timestamp, batch)
    if (type(batch) != str):
        batch = str(batch)
        print(batch)
    
    # 直接拼接：学校ID(10位) + 时间戳(10位) + 批次(4位)
    raw_data = f"{school_id}{timestamp}{batch.zfill(4)}"
    print(raw_data)
    
    # 如果原始数据不超过300位，直接返回
    if len(raw_data) <= 300:
        return raw_data
    
    # 超出则用SHA-256截取
    hash_result = hashlib.sha256(raw_data.encode()).hexdigest()
    print(hash_result)
    return school_id + hash_result[:min(286, len(hash_result))]  # 保留学校ID前缀




# web服务器 --------------------------------------------
app = flask.Flask(__name__)

@app.route('/maker/make', methods=['POST'])
def make_uniform():
    '''
    payload:
    {
        "school_id": "学校ID",
        ("timestamp": "时间戳",  当 agree_debug 时)
        ("batch": "批次",  当 agree_debug 时)
        ("yid": "服装ID",  当 agree_debug 时)
    }
    '''

    # 初始化数据集
    payload_data = flask.request.json
    result = {"YID": None, "Warning": []}

    # 错误 - 缺少学校ID
    if ("school_id" not in payload_data):
        return flask.jsonify({
            "Error": "school_id is required"
        }), 400
    # 错误 - 学校ID不存在
    if (payload_data["school_id"] not in storage["school_register_search"]):
        return flask.jsonify({
            "Error": "school_id not found",
        }), 400

    # 获取时间戳
    timestamp = None
    if ("timestamp" in payload_data):
        if (agree_debug):
            timestamp = payload_data["timestamp"]
        else:
            timestamp = int(time())
            result["Warning"].append("timestamp is not provided")
    else:
        timestamp = int(time())
    
    # 获取批次
    global batch
    loc_batch = batch
    if ("batch" in payload_data):
        if (agree_debug):
            loc_batch = payload_data["batch"]
        else:
            result["Warning"].append("batch is not provided")
    
    # 生成服装ID
    YID = generate_uniform_id(payload_data["school_id"], timestamp, loc_batch)
    if ("yid" in payload_data):
        if (agree_debug):
            YID = payload_data["yid"]
        else:
            result["Warning"].append("yid is not provided")
    
    result["YID"] = YID
    
    # 没有警告，删除警告键
    if (not result["Warning"]):
        result.pop("Warning")
    
    # 本地更新
    # 如果批次与当前批次相同，增加批次
    if (loc_batch == batch):
        batch = int((batch+1)%1000)
    print(batch)
    # 更新服装信息
    storage["uniform_search"][YID] = {
        "is_active": False,
        "detail": None
    }

    # 返回结果
    return flask.jsonify(result), 200


@app.route("/school/register", methods=['POST'])
def school_resgister():
    '''
    payload:
    {
        "name": 学校名称,
        "sid": 学校id  (不可重复),
        "password": 密码,
    }
    '''
    payload_data = flask.request.json

    # 判断参数是否存在
    in_need_list = ["name","sid","password"]
    for i in in_need_list:
        if (not i in payload_data):
            return flask.jsonify({"Error":f"{i} is required"}), 400
    
    # 判断重复
    exist_list1 = ["name",              "sid"]
    exist_list2 = ["exist_school_name", "school_register_search"]
    for i in range(len(exist_list1)):
        if (payload_data[exist_list1[i]] in storage[exist_list2[i]]):
            return flask.jsonify({"Error":f"{exist_list1[i]} ({payload_data[exist_list1[i]]}) is exist"}), 400
        
    # 弱密码判断  撇了

    # 注册
    # 需要修改 school_register, school_register_search, exist_school_name
    storage["school_register"].append( {
        "name":payload_data["name"],
        "sid": payload_data["sid"],
        "password": payload_data["password"]
    } )

    storage["school_register_search"][payload_data["sid"]] =  {
        "name": payload_data["name"],
        "password": payload_data["password"]
    }

    storage["exist_school_name"].append(payload_data["name"])

    # 返回结果
    if (storage["school_register_search"][payload_data["sid"]]["name"] != payload_data["name"]):
        return flask.jsonify({"Error":"school_register_search in error (register failed)"}), 500
    if (not payload_data["name"] in storage["exist_school_name"]):
        return flask.jsonify({"Error":"exist_school_name in error (register failed)"}), 500

    return flask.jsonify({"Success":"register successfully","Status":True}), 200

is_saved=False
if __name__ == '__main__':
    start_init_agree_debug()
    start_init_storage()

    app.run(debug=False)

    end_storage()
    sys.exit(0)
