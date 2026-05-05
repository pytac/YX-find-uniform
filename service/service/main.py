
import flask               # 服务器搭建
import json,os             # 保存数据
from time import time      # 获取时间戳
# import hashlib             # 生成哈希值
import uuid
import sys                 # 获取命令行参数
import requests            # 发送请求

# 初始化 --------------------------------

storage_file = os.path.join(os.path.dirname(__file__), 'storage.json')

agree_debug = False
# use_uuid4 = True           # 只用 uuid5,4

# def start_init_agree_debug():
#     global agree_debug
#     argv = sys.argv[1:]
#     if len(argv) > 0 and '--agree-debug' in argv:
#         agree_debug = True

def start_init_prompt():
    global agree_debug, use_uuid4

    argv = sys.argv[1:]
    if len(argv) == 0:
        return

    if  '--tect' in argv or '-t' in argv:
        print("tect mode")
        agree_debug = use_uuid4 = True

    if  '--agree-debug' in argv:
        agree_debug = True
    
    # if '--use-uuid5' in argv:
    #     use_uuid4 = False


storage = None

def start_init_storage():
    
    global storage
    if not os.path.exists(storage_file):
        storage = {
            # 学校注册 sid,yid,uid 键值统一小写
            "exist_school_name":[
            ],
            "school_register_search": {
            },

            "uniform_search": {
            },

            "user_uniform":{
            }
        }

        if agree_debug:
            with open(os.path.join(os.path.dirname(__file__), 'tect\\init_storage.json'), 'r') as f:
                storage = json.load(f)

        with open(storage_file, 'w') as f:
            json.dump(storage, f, indent=4)
            # json.dump(storage, f)
    else:
        with open(storage_file, 'r') as f:
            storage = json.load(f)


# 结束 --------------------------------
def end_storage():
    print("saving!")
    with open(storage_file, 'w') as f:
        f.write(json.dumps(storage, indent=4))
        # json.dump(storage, f)

# 必要函数 --------------------------------

# 生成服装ID
# 直接使用 uuid4 生成
def generate_uniform_id():
    return uuid.uuid4()

def send_msg_to_school(sid,path,msg):
    url = storage["school_register_search"][sid]["school_service"]+path
    
    # 处理URL - 假如有 // 则合并
    url = url.split("//")
    url = (url[0] + "//" + "/".join(url[1:])) if url[0].startswith("http") else "http://" + '/'.join(url[:])
    
    return requests.post(url,json.dumps(msg))

# web服务器 --------------------------------------------
app = flask.Flask(__name__)

@app.route('/maker/make', methods=['POST'])
def make_uniform():
    '''
    payload:
    {
        "sid": "学校ID",
        ("yid": "服装ID",  当 agree_debug 时)
    }

    最后一次测试: 2026-05-05 16:15
    '''

    # 初始化数据集
    payload_data = flask.request.json
    result = {"YID": None, "Warning": []}

    # 错误 - 缺少学校ID
    if ("sid" not in payload_data):
        return flask.jsonify({
            "Error": "sid is required"
        }), 400
    # 错误 - 学校ID不存在
    if (payload_data["sid"] not in storage["school_register_search"]):
        return flask.jsonify({
            "Error": "sid not found",
        }), 404
    
    # 生成服装ID
    YID = generate_uniform_id()

    YID = str(YID)
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
    # 更新服装信息
    storage["uniform_search"][YID] = {
        "is_active": False,
        "sid": payload_data["sid"],
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
        "school_service": "学校服务地址",
    }

    最后一次测试: 2026-05-05 16:05
    '''
    payload_data = flask.request.json

    # 判断参数是否存在
    in_need_list = ["name","sid","password","school_service"]
    for i in in_need_list:
        if (not i in payload_data):
            return flask.jsonify({"Error":f"{i} is required"}), 400
    
    # 判断重复
    exist_list1 = ["name",              "sid"]
    exist_list2 = ["exist_school_name" ,"school_register_search"]
    for i in range(len(exist_list1)):
        if (payload_data[exist_list1[i]] in storage[exist_list2[i]]):
            return flask.jsonify({"Error":f"{exist_list1[i]} ({payload_data[exist_list1[i]]}) is exist"}), 400
        
    # 弱密码判断  撇了

    # 注册
    # 需要修改 school_register_search, exist_school_name

    storage["school_register_search"][payload_data["sid"]] =  {
        "name": payload_data["name"],
        "password": payload_data["password"],
        "school_service": payload_data["school_service"],
    }

    storage["exist_school_name"].append(payload_data["name"])

    # 返回结果
    if (storage["school_register_search"][payload_data["sid"]]["name"] != payload_data["name"]):
        return flask.jsonify({"Error":"school_register_search in error (register failed)"}), 500
    if (not payload_data["name"] in storage["exist_school_name"]):
        return flask.jsonify({"Error":"exist_school_name in error (register failed)"}), 500

    return flask.jsonify({"Success":"register successfully","Status":True}), 200

@app.route("/user/enable", methods=['POST'])
def enable_uniform():
    '''
    payload:
    {
        "yid": 衣服id,
        "uid": 用户id,
        "student": 学号
    }
    最后一次测试: 2026-05-05 17:25
    '''
    payload_data = flask.request.json

    # 判断参数是否存在
    in_need_list = ["yid","uid","student"]
    for i in in_need_list:
        if (not i in payload_data):
            return flask.jsonify({"Error":f"{i} is required"}), 400
    
    # 判断服装是否存在
    if (payload_data["yid"] not in storage["uniform_search"]):
        return flask.jsonify({"Error":"yid not found"}), 404
    # 判断是否已被激活
    if (storage["uniform_search"][payload_data["yid"]]["is_active"]):
        return flask.jsonify({"Error":"yid is already active"}), 423
    
    
    # 发送激活消息给学校
    print(storage["uniform_search"][payload_data["yid"]])
    sid = storage["uniform_search"][payload_data["yid"]]["sid"]
    response = send_msg_to_school(sid, "/service/enable",{
        "yid": payload_data["yid"],
        "uid": payload_data["uid"],
        "student": payload_data["student"]
    })
    print(response.json())
    if (response.status_code != 200):
        return flask.jsonify({"Error":"school enable failed","Detail":response.json()}),  response.status_code

    # 修改
    storage["uniform_search"][payload_data["yid"]] = {
        "is_active": True,
        "sid": sid,
        "detail": {
            "uid": payload_data["uid"],
            "student": payload_data["student"]
        }
    }

    storage["user_uniform"][payload_data["uid"]].append(payload_data["yid"])
    
    # 返回结果
    return flask.jsonify({"Success":"enable successfully","Status":True}), 200



is_saved=False
if __name__ == '__main__':
    # start_init_agree_debug()
    start_init_prompt()
    start_init_storage()

    app.run(debug=False, host="127.0.0.1", port=5000)

    end_storage()
    sys.exit(0)
