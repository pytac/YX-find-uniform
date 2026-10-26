import flask               # 服务器搭建
import json,os             # 保存数据
from time import time      # 获取时间戳
# import hashlib             # 生成哈希值
import uuid
import sys                 # 获取命令行参数
import requests            # 发送请求
import threading           # 添加全局锁

# 初始化 --------------------------------

storage_file = os.path.join(os.path.dirname(__file__), 'storage.json')

agree_debug = False

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


storage = None
storage_lock = threading.RLock()  # 全局可重入锁

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

            # "user_uniform":{
            # }
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
    with storage_lock:  # 保存时加锁
        with open(storage_file, 'w') as f:
            f.write(json.dumps(storage, indent=4))
            # json.dump(storage, f)

# 必要函数 --------------------------------

# 生成服装ID
# 直接使用 uuid4 生成
def generate_uniform_id():
    return uuid.uuid4()

def send_msg_to_school(sid,path,msg):
    # 读取学校服务地址时需要加锁
    with storage_lock:
        url = storage["school_register_search"][sid]["school_service"]+path
    
    # 处理URL - 假如有 // 则合并
    url = url.split("//")
    url = (url[0] + "//" + "/".join(url[1:])) if url[0].startswith("http") else "http://" + '/'.join(url[:])
    
    return requests.post(url,json=msg)

# 辅助函数：安全读取学校返回的 JSON
# 学校端返回 HTML 错误页或空响应时，直接 .json() 会抛异常让本接口 500
def _safe_json(resp):
    try:
        return resp.json()
    except ValueError:
        return {"raw": (resp.text or "")[:200]}

# 辅助函数：统一响应格式
def _make_response(phrase, status, detail=None):
    if detail is None:
        detail = {}
    return flask.jsonify({
        "Phrase": phrase,
        "Status": status,
        "Detail": detail
    })

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

    最后一次测试: 2026-05-23 21:50
    '''

    # 初始化数据集
    payload_data = flask.request.json
    result = {"YID": None, "Warning": []}

    # 错误 - 缺少学校ID
    if ("sid" not in payload_data):
        return _make_response("sid is required", False, {}), 400
    # 错误 - 学校ID不存在
    with storage_lock:
        if (payload_data["sid"] not in storage["school_register_search"]):
            return _make_response("sid not found", False, {}), 404
    
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
    with storage_lock:
        storage["uniform_search"][YID] = {
            "is_active": False,
            "sid": payload_data["sid"],
            "detail": None
        }

    # 返回结果
    return _make_response("Make uniform success", True, result), 200

@app.route("/maker/check_sid", methods=['POST'])
def check_sid():
    '''
    payload:
    {
        "sid": "学校ID",
    }

    最后一次测试: 2026-06-19 14:25
    '''
    payload_data = flask.request.json

    if ("sid" not in payload_data):
        return _make_response("sid is required", False, {}), 400
    
    return _make_response("Check sid success", True, {"res": payload_data["sid"] in storage["school_register_search"]}), 200

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

    最后一次测试: 2026-05-05 16:05 ~> 2026-05-23 21:54
    '''
    payload_data = flask.request.json

    # 判断参数是否存在
    in_need_list = ["name","sid","password","school_service"]
    for i in in_need_list:
        if (not i in payload_data):
            return _make_response(f"{i} is required", False, {}), 400
    
    # 判断重复（加锁保护整个检查+注册过程）
    with storage_lock:
        exist_list1 = ["name",              "sid"]
        exist_list2 = ["exist_school_name" ,"school_register_search"]
        for i in range(len(exist_list1)):
            if (payload_data[exist_list1[i]] in storage[exist_list2[i]]):
                return _make_response(f"{exist_list1[i]} ({payload_data[exist_list1[i]]}) is exist", False, {}), 400
            
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
            return _make_response("school_register_search in error (register failed)", False, {}), 500
        if (not payload_data["name"] in storage["exist_school_name"]):
            return _make_response("exist_school_name in error (register failed)", False, {}), 500

    return _make_response("register successfully", True, {}), 200

@app.route("/user/enable", methods=['POST'])
def enable_uniform():
    '''
    payload:
    {
        "yid": 衣服id,
        "uid": 用户id,
        "student": 学号
    }
    最后一次测试: 2026-05-23 22:32
    '''
    payload_data = flask.request.json

    # 判断参数是否存在
    in_need_list = ["yid","uid","student"]
    for i in in_need_list:
        if (not i in payload_data):
            return _make_response(f"{i} is required", False, {}), 400
    
    # 读取服装信息并判断（加锁）
    with storage_lock:
        # 判断服装是否存在
        if (payload_data["yid"] not in storage["uniform_search"]):
            return _make_response("yid not found", False, {}), 404
        # 判断是否已被激活
        if (storage["uniform_search"][payload_data["yid"]]["is_active"]):
            # 一个人可以有多套校服，重复扫到自己已绑的那件时给个明白的提示，
            # 而不是让客户端弹出英文的 "yid is already active"
            owner = (storage["uniform_search"][payload_data["yid"]]["detail"] or {}).get("uid")
            if (owner == payload_data["uid"]):
                return _make_response("该校服已绑定在当前账号下，无需重复添加", False, {}), 423
            return _make_response("该校服已被其他账号绑定", False, {}), 423
        
        sid = storage["uniform_search"][payload_data["yid"]]["sid"]
    
    # 发送激活消息给学校
    print(storage["uniform_search"][payload_data["yid"]])  # 注意：这行在锁外读取，但只是为了打印，不影响逻辑
    response = send_msg_to_school(sid, "/service/enable",{
        "yid": payload_data["yid"],
        "uid": payload_data["uid"],
        "student": payload_data["student"]
    })
    print(_safe_json(response))
    if (response.status_code != 200):
        # 将学校返回的错误信息放入 Detail
        error_detail = _safe_json(response)
        return _make_response("school enable failed", False, error_detail), response.status_code

    # 修改本地存储（加锁）
    with storage_lock:
        storage["uniform_search"][payload_data["yid"]] = {
            "is_active": True,
            "sid": sid,
            "detail": {
                "uid": payload_data["uid"],
                "student": payload_data["student"]
            }
        }

        # 如果用户不存在，下面这行会报 KeyError，原代码如此，不修改
        # if (payload_data["uid"] not in storage["user_uniform"]):
        #     storage["user_uniform"][payload_data["uid"]] = []
        # storage["user_uniform"][payload_data["uid"]].append(payload_data["yid"])
    
    # 返回结果，附带 school_service 信息
    return _make_response("enable successfully", True, {"school_service": storage["school_register_search"][sid]["school_service"],"name": storage["school_register_search"][sid]["name"]}), 200

@app.route("/user/uniforms", methods=['POST'])
def user_uniforms():
    '''
    payload:
    {
        "uid": 用户id
    }

    一个 uid 名下可以有多套校服，也可能分属不同学校。
    客户端靠这个接口在换手机 / 清缓存后把校服列表找回来。
    '''
    payload_data = flask.request.json or {}
    uid = payload_data.get("uid")
    if (not uid or not isinstance(uid, str)):
        return _make_response("uid is required", False, {}), 400

    items = []
    with storage_lock:
        for yid, info in storage["uniform_search"].items():
            if (not info.get("is_active")):
                continue
            detail = info.get("detail") or {}
            if (detail.get("uid") != uid):
                continue
            sid = info.get("sid")
            school = storage["school_register_search"].get(sid, {})
            items.append({
                "yid": yid,
                "student": detail.get("student", ""),
                "sid": sid,
                "school_name": school.get("name", ""),
                "school_service": school.get("school_service", ""),
            })

    items.sort(key=lambda x: x["yid"])
    return _make_response("get uniforms success", True, {"uniforms": items}), 200

@app.route("/user/loss", methods=['POST'])
def loss():
    '''
    payload:
    {
        "yid": 衣服id
    }
    最后一次测试: 2026-05-23 22:37
    '''
    payload_data = flask.request.json
    
    # 加锁读取和判断
    with storage_lock:
        # 判断衣服是否存在
        if (payload_data["yid"] not in storage["uniform_search"]):
            return _make_response("yid not found", False, {}), 404
        
        # 判断是否已被激活
        if (not storage["uniform_search"][payload_data["yid"]]["is_active"]):
            return _make_response("yid is not active", False, {}), 423
        
        sid = storage["uniform_search"][payload_data["yid"]]["sid"]
    
    # 反馈给学校（锁外发送请求）
    try:
        response = send_msg_to_school(sid, "/service/loss",{
            "yid": payload_data["yid"],
        })
    except requests.exceptions.RequestException as e:
        # 学校服务器没开或地址不通，明确告诉客户端，避免只看到一个 500
        print(f"[loss] school service unreachable: {e}")
        return _make_response("school service unreachable", False, {"sid": sid, "error": str(e)}), 502

    print(_safe_json(response))
    if (response.status_code != 200):
        # 将学校返回的错误信息放入 Detail
        error_detail = _safe_json(response)
        return _make_response("school loss failed", False, error_detail), response.status_code

    # 记录这一次上报，便于在总服务器端核对（退出时随 storage 一起落盘）
    with storage_lock:
        records = storage.setdefault("loss_records", {})
        record_id = str(int(time() * 1000))
        while record_id in records:
            record_id = str(int(record_id) + 1)
        records[record_id] = {
            "yid": payload_data["yid"],
            "sid": sid
        }
        total = len(records)
    print(f"[loss] recorded yid={payload_data['yid']} sid={sid} total={total}")

    return _make_response("lossing report successfully", True, {"sid": sid}), 200

@app.route("/school/delete", methods=['POST'])
def delete_uniform():
    """
    payload:
    {
        "yid": 衣服id,
        "sid": 学校id,
        "password": 密码
    }
    最后一次测试: 2026-05-24 21:01
    """
    payload_data = flask.request.json
    yid = payload_data["yid"]
    sid = payload_data["sid"]

    # 判断密码
    if (payload_data["password"] != storage["school_register_search"][sid]["password"]):
        return _make_response("forbidden", False, {}), 403

    # 判断服装是否存在
    if (yid not in storage["uniform_search"]):
        return _make_response("yid not found", False, {}), 404
    # 判断是否是此学校的
    if (storage["uniform_search"][yid]["sid"] != sid):
        return _make_response("yid not found", False, {}), 404
    # 判断是否已被激活
    if (not storage["uniform_search"][yid]["is_active"]):
        return _make_response("yid is not active", False, {}), 423
    
    # 删除服装
    del storage["uniform_search"][yid]
    return _make_response("delete successfully", True, {}), 200

# 测试用
@app.route("/tect/save", methods=['POST'])
def tect_save_storage():
    if agree_debug:
        end_storage()
        return _make_response("save successfully", True, {}), 200
    else:
        return _make_response("REJECT & FORBIDDEN", False, {}), 403

is_saved=False
if __name__ == '__main__':
    # start_init_agree_debug()
    start_init_prompt()
    start_init_storage()

    app.run(debug=False, host="0.0.0.0", port=5000)
    # app.run(debug=False, host="192.168.101.7", port=5000)
    # app.run(debug=False, host="127.0.0.1", port=5000)

    end_storage()
    sys.exit(0)