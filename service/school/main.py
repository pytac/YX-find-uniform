import flask
import requests
import json
from time import time
import os,sys
import threading
import time as time_module

# 初始化 ---

# 开始
storage_file = os.path.join(os.path.dirname(__file__), 'storage.json')
information_file = os.path.join(os.path.dirname(__file__), 'information.json')

agree_debug = False
def start_init_prompt():
    global agree_debug
    argv = sys.argv[1:]
    if len(argv) > 0 and '-t' in argv:
        agree_debug = True
        print("debug mode")

# 终端里手敲地址的容错：补协议、去尾部斜杠
DEFAULT_SCHOOL_SERVICE = "http://127.0.0.1:8888"

def normalize_url(url):
    url = (url or "").strip()
    if not url:
        return ""
    if not url.lower().startswith(("http://", "https://")):
        url = "http://" + url
    return url.rstrip("/")

def ask(question, default=""):
    """读一行输入；直接回车则用默认值"""
    raw = input(question).strip()
    return raw if raw else default

def ask_yes_no(question, default=False):
    """Y/n 询问；直接回车取默认值"""
    hint = "Y/n" if default else "y/N"
    raw = input(f"{question} ({hint}) ").strip().lower()
    if not raw:
        return default
    return raw in ("y", "yes", "1", "true", "是")

def describe_request_error(e):
    """requests 的异常原文太长，取一句能看懂的"""
    text = str(e)
    if ("Connection refused" in text) or ("WinError 10061" in text) or ("NewConnectionError" in text):
        return "对方端口没有服务在监听（总服务器没启动？地址写错了？）"
    if ("timed out" in text) or ("Timeout" in text):
        return "请求超时（地址能通但没响应，检查端口和防火墙）"
    if ("Name or service not known" in text) or ("getaddrinfo failed" in text):
        return "域名 / IP 解析失败"
    return text[:200]

# 全局读写锁（保护 storage 和 information）
data_lock = threading.RLock()

storage = None

def register_to_service():
    """
    首次初始化时询问是否把本校登记到总服务器，并调用总服务器的 /school/register。

    返回 True  表示总服务器上已认下这个 sid（本次注册成功，或确认之前注册过）；
    返回 False 表示没登记（跳过 / 用户放弃 / 连不上）。
    注册成功后把远程密码存进 storage['admin']['password_remote']，
    不然初始化只走一次，密码丢了就再也补不回来。
    """
    try:
        return _register_flow()
    except EOFError:
        # 非交互方式启动（管道 / 关掉 stdin）时不要让程序带着异常退出
        print("\n[init] 输入被中断，跳过注册")
        return False

def _register_flow():
    service = storage.get('service', '')
    name = storage.get('school_name', '')
    sid = storage.get('sid', '')

    print()
    print(f"[init] 本校：{name} (sid: {sid})  总服务器：{service}")
    if not ask_yes_no("[init] 是否在总服务器中注册？"):
        print("[init] 已跳过注册：总服务器不认识这个 sid，扫码生成的衣服会返回 sid not found")
        return False

    while True:
        password = ask("[init] 远程管理密码（学校在总服务器上的密码）: ")
        if not password:
            print("[init] 密码不能为空，请重新输入")
            continue
        school_service = normalize_url(
            ask(f"[init] 本校对外服务地址（默认 {DEFAULT_SCHOOL_SERVICE}）: ", DEFAULT_SCHOOL_SERVICE)
        )
        if not school_service:
            print("[init] 服务地址不能为空，请重新输入")
            continue

        payload = {
            "name": name,
            "sid": sid,
            "password": password,
            "school_service": school_service,
        }
        try:
            response = requests.post(service + "/school/register", json=payload, timeout=8)
        except requests.exceptions.RequestException as e:
            print(f"[init] 连不上总服务器 {service}：{describe_request_error(e)}")
            if ask_yes_no("[init] 重新填写并重试？", True):
                continue
            print("[init] 已跳过注册，稍后可在总服务器手动补登记（POST /school/register）")
            return False

        try:
            body = response.json()
        except ValueError:
            body = {"raw": (response.text or "")[:200]}
        phrase = str(body.get("Phrase", body.get("raw", "")))

        # 注册成功
        if response.status_code == 200:
            storage.setdefault('admin', {})['password_remote'] = password
            print(f"[init] 注册成功：{name} ({sid}) -> {service}")
            print(f"[init] 总服务器会通过 {school_service} 反向调用本站")
            if ("127.0.0.1" in school_service) or ("localhost" in school_service):
                print("[init] 注意：127.0.0.1 只在本机有效。若总服务器不在同一台机器上，请改成局域网 IP 再重新初始化")
            return True

        # sid / 校名被占用：多半是之前注册过但被重复初始化了
        if "is exist" in phrase:
            print(f"[init] 注册失败：{phrase}")
            print("[init] 说明这个 sid 或校名已被总服务器占用。若本校之前注册过，直接当作已注册即可。")
            if ask_yes_no("[init] 当作已注册继续？"):
                storage.setdefault('admin', {})['password_remote'] = password
                return True
            print("[init] 已跳过注册。若确定没注册过，请删掉 storage.json 重新初始化，并换个 sid / 校名")
            return False

        print(f"[init] 注册失败（HTTP {response.status_code}）：{phrase}")
        if ask_yes_no("[init] 重新填写并重试？", True):
            continue
        print("[init] 已跳过注册，稍后可在总服务器手动补登记（POST /school/register）")
        return False

def start_init_storage():
    """
    {
        "school_name":"Example School",
        "sid":"Example",
        "service":"http://127.0.0.1:5000",
        "admin":{
            "username":"admin",
            "password":"123456",
            "password_remote": None/(学校在总服务器上的密码，初始化注册时写入)
        },
        "uniform":{
            "yid":{
                "is_active": t/f,
                "yid": yid,
                "detail": None/{
                    "uid": uid,
                    "student": student id(e.g. "20240101")
                }
            }
        }
    }
    """
    global storage
    if not os.path.exists(storage_file):
        if agree_debug:
            with open(os.path.join(os.path.dirname(__file__), 'tect\\init_storage.json'), 'r') as f:
                storage = json.load(f)
        else:
            storage = {
                "admin":{
                    "username":"admin",
                    "password":"123456"
                },
                "uniform":{}   # 改为字典，与原结构说明一致
            }
        if agree_debug:
            storage['school_name'] = "Example School"
            storage['sid'] = "Example"
            storage['service'] = "http://127.0.0.1:5000"
        else:
            storage['school_name'] = input("[init] Type school name: ")
            storage['sid'] = input("[init] Type sid: ")
            storage['service'] = normalize_url(input("[init] Type service url: "))
            # 在远程注册
            register_to_service()
    else:
        with open(storage_file, 'r') as f:
            storage = json.load(f)
        # 老配置里地址可能是手敲的（没写 http://，或结尾带 /），统一整理一遍
        storage['service'] = normalize_url(storage.get('service', ''))
        # 兼容旧数据：如果 uniform 是列表，转为字典
        if isinstance(storage.get('uniform'), list):
            old_list = storage['uniform']
            new_dict = {}
            for item in old_list:
                if 'yid' in item:
                    new_dict[item['yid']] = item
            storage['uniform'] = new_dict

information = None
def start_init_information():
    """
    type:
         1 - 丢失通知 - detail: {"yid": yid, "name": school_name}
         2 - 通知用户已领取 - detail: {"yid": yid, "name": school_name}
         3 - 激活衣服通知 - detail: {"yid": yid, "name": school_name}
         4 - 学校删除衣服通知 - detail: {"yid": yid, "name": school_name}
    {
        # "uid":[{
        #         "type": type,
        #         "time": time,
        #         "auto_delete": t/f (15天后自动删除),
        #         "detail": {detail...}
        #     },...]
        
        "uid": {
            "time(id)": {
                "type": type,
                "time": time,
                "auto_delete": t/f (15天后自动删除),
                "detail": {detail...}
            }
        }
    }
    """
    global information
    if not os.path.exists(information_file):
        information = {}
    else:
        with open(information_file, 'r') as f:
            information = json.load(f)

# 结束
def end_storage():
    print("saving")
    with data_lock:
        with open(storage_file, 'w') as f:
            json.dump(storage, f, indent=4)
        with open(information_file, 'w') as f:
            json.dump(information, f, indent=4)

# 函数
def make_response(phrase, status, detail=None):
    if detail is None:
        detail = {}
    return flask.jsonify({
        "Phrase": phrase,
        "Status": status,
        "Detail": detail
    })

def send_information(uid, type, time_val, auto_delete=True, detail={}):
    """
    注意：参数名改为 time_val 避免与导入的 time 模块或函数冲突，
    但在调用时请确保传入的是时间戳数值。
    """
    global information

    with data_lock:
        # 确保 uid 存在，且值为字典
        if uid not in information:
            information[uid] = {}

        # json 只能接受 str 为键，使用 str 类型的时间戳作为 Key。
        # 同一个用户可能有多套校服，同一秒内可能连发多条通知（比如两件都丢了），
        # 直接覆盖会让先到的那条凭空消失，冲突时顺延到下一个可用序号。
        msg_key = str(time_val)
        while msg_key in information[uid]:
            msg_key = str(int(msg_key) + 1)

        information[uid][msg_key] = {
            "type": type,
            "time": time_val,      # 原始时间保留在 value 中
            "auto_delete": auto_delete,
            "detail": detail
        }

# ------------------ 定时清理 information ------------------
def cleanup_information():
    """
    删除 information 中 auto_delete=True 且超过 15 天的消息。
    适配新的字典结构 (Key为int时间戳)
    """
    now_ts = int(time_module.time())
    expire_seconds = 15 * 24 * 3600
    deleted_count = 0
    empty_users = []

    with data_lock:
        # 遍历所有用户
        for uid, msg_dict in list(information.items()):
            keys_to_delete = []
            
            # 遍历该用户下的所有消息 (key是int, value是消息详情)
            for msg_key, msg in msg_dict.items():
                auto_del = msg.get('auto_delete', False)
                msg_time = msg.get('time', 0)
                
                # 确保 msg_time 是数值类型用于计算
                try:
                    msg_time = float(msg_time) 
                except (TypeError, ValueError):
                    msg_time = 0
                
                # 判断是否过期
                if auto_del and (now_ts - msg_time) > expire_seconds:
                    keys_to_delete.append(msg_key)
                    deleted_count += 1
            
            # 执行删除
            for key in keys_to_delete:
                if key in information[uid]: # 二次检查防止并发错误
                    del information[uid][key]
                    
            # 如果该用户没有消息了，标记为待删除用户
            if not information[uid]:
                empty_users.append(uid)

        # 删除空的用户条目
        for uid in empty_users:
            if uid in information:
                del information[uid]

    if deleted_count > 0 or empty_users:
        print(f"[Cleanup] Removed {deleted_count} expired messages, removed {len(empty_users)} empty user entries.")

def cleanup_scheduler():
    """后台清理循环：启动时执行一次，之后每小时执行一次"""
    cleanup_information()
    while True:
        time_module.sleep(3600)
        cleanup_information()

def start_cleanup_thread():
    """启动后台清理线程（守护线程）"""
    thread = threading.Thread(target=cleanup_scheduler, daemon=True)
    thread.start()

# web 服务 ---
app = flask.Flask(__name__)

@app.route('/service/enable', methods=['POST'])
def enable():
    """
    payload:
    {
        "yid": yid,
        "uid": uid,
        "student": student id(e.g. "20240101")
    }
    最后一次测试: 2026-05-23 22:32
    """
    payload_data = flask.request.json
    yid = payload_data['yid']
    
    with data_lock:
        storage['uniform'][yid] = {
            "is_active": True,
            "yid": yid,
            "detail": {
                "uid": payload_data['uid'],
                "student": payload_data['student']
            }
        }
        send_information(**{
            "uid": payload_data['uid'],
            "type": 2,
            "time_val": int(time()),
            "auto_delete": True,
            "detail": {"yid": yid, "name": storage['school_name']}
        })
    return make_response("enable success", True, {}), 200

@app.route('/user/get_msg', methods=['POST'])
def get_msg():
    """
    payload:
    {
     "uid": uid
    }
    return:
    {
        "msg": {
            1716700000000: { "type": 1, ... },
            1716700001000: { "type": 2, ... }
        }
    }
    最后一次测试: 2026-05-26 16:43
    """
    data = flask.request.json
    uid = data['uid']
    
    with data_lock:
        if uid not in information:
            # 返回空字典而不是空列表
            return make_response("get msg success", True, {"msg": {}}), 200
        
        # 直接返回该用户的消息字典副本
        # dict(information[uid]) 创建浅拷贝，防止外部修改影响内部结构
        msg_dict = dict(information[uid])
        
        return make_response("get msg success", True, {"msg": msg_dict}), 200

@app.route("/user/del_msg", methods=['POST'])
def del_msg():
    """
    payload:
    {
        "uid":uid,
        "key":msg_key
    }
    最后一次测试: 2026-06-07 20:07
    """
    payload = flask.request.json
    uid = payload["uid"]
    key = payload["key"]

    with data_lock:
        if (not (uid in information)):
            return make_response("uid not found",False,{}), 404
        if (not (key in information[uid])):
            return make_response("key not found",False,{}), 404
        
        if (information[uid][key]["type"] == 1):
            return make_response("loss information cannot be deleted",False,{}), 423
        
        del information[uid][key]
        return make_response("delete msg success", True, {"key": key}), 200

@app.route('/service/loss', methods=['POST'])
def loss():
    """
    payload:
    {
        "yid": yid,
    }
    最后一次测试: 2026-05-23 22:37
    """
    payload_data = flask.request.json
    yid = payload_data['yid']

    with data_lock:
        # 判断衣服是否存在
        if yid not in storage['uniform']:
            return make_response("yid not found", False, {}), 404

        # 发送消息给用户
        uid = storage['uniform'][yid]['detail']['uid']
        send_information(**{
            "uid": uid,
            "type": 1,
            "time_val": int(time()),
            "auto_delete": False,
            "detail": {"yid": yid, "name": storage['school_name']}
        })

    return make_response("lossing report successful", True, {}), 200

@app.route("/user/get_loss", methods=['POST'])
def get_loss():
    """
    payload:
    {
        "uid": uid,
        "yid": yid,
        "key": key => 对应丢失衣服的 key
    }
    最后一次测试: 
    """
    payload = flask.request.json
    uid = payload["uid"]
    yid = payload["yid"]
    key = payload["key"]

    with data_lock:
        if (not (uid in information)):
            return make_response("uid not found",False,{}), 404
        if (not (key in information[uid])):
            return make_response("key not found",False,{}), 404
        if (information[uid][key]["type"] != 1):
            return make_response("key is not loss information",False,{}), 404
        if (information[uid][key]["detail"]["yid"] != yid):
            return make_response("yid is not belong to key",False,{}), 404
        
        if (not (yid in storage["uniform"])):
            return make_response("yid not found",False,{}), 404
        if (storage["uniform"][yid]["detail"]["uid"] != uid):
            return make_response("yid is not belong to uid",False,{}), 403
        
        del information[uid][key]
        send_information(**{
            "uid": uid,
            "type": 2,
            "time_val": int(time()),
            "auto_delete": True,
            "detail": {"yid": yid, "name": storage['school_name']}
        })
        return make_response("get loss success", True, {"yid": yid, "key": key}), 200

@app.route("/admin/delete", methods=['POST'])
def delete_uniform():
    """"
    payload:
    {
        "password_local": password,
        "password_remote": password(remote),
        "yid": yid,
    }
    最后一次测试: 2026-05-24 21:01
    """
    payload_data = flask.request.json
    password = payload_data['password_local']
    yid = payload_data['yid']

    with data_lock:
        # 判断密码是否正确
        if password != storage['admin']['password']:
            return make_response("forbidden", False, {}), 403
        # 判断衣服是否存在
        if yid not in storage['uniform']:
            return make_response("yid not found", False, {}), 404
        # 删除衣服
        # 远程
        response = requests.post(storage['service'] + "/school/delete", json={
            "password": payload_data['password_remote'],
            "yid": yid,
            "sid": storage['sid']
        })
        if response.status_code != 200:
            return make_response("remote delete uniform failed", False, response.json() if response.json() else {}), response.status_code
        # 本地
        uid = storage['uniform'][yid]['detail']['uid']
        del storage['uniform'][yid]
        # 通知
        send_information(**{
            "uid": uid,
            "type": 4,
            "time_val": int(time()),
            "auto_delete": True,
            "detail": {"yid": yid, "name": storage['school_name']}
        })
        return make_response("delete uniform", True, {}), 200

# 测试用
@app.route("/tect/save", methods=['POST'])
def tect_save_storage():
    if agree_debug:
        end_storage()
        return make_response("save successfully", True, {}), 200
    else:
        return make_response("REJECT & FORBIDDEN", False, {}), 403
    
@app.route("/tect/clear", methods=['POST'])
def tect_clear():
    if agree_debug:
        cleanup_information()
        return make_response("clear successfully", True, {}), 200
    else:
        return make_response("REJECT & FORBIDDEN", False, {}), 403

@app.route("/tect/send_information", methods=['POST'])
def tect_send():
    if agree_debug:
        send_information(** flask.request.json)
        return make_response("send successfully", True, {}), 200
    else:
        return make_response("REJECT & FORBIDDEN", False, {}), 403
    

# is_saved = False
if __name__ == '__main__':
    start_init_prompt()
    first_run = not os.path.exists(storage_file)
    start_init_storage()
    start_init_information()

    # 首次初始化（可能刚在总服务器注册过）先把配置落盘，
    # 否则要等到正常退出才写文件，中途崩溃就白注册了
    if first_run:
        end_storage()

    # 启动定时清理线程（程序启动时立即清理一次，之后每小时一次）
    start_cleanup_thread()

    app.run(debug=False, host='0.0.0.0', port=8888)
    # app.run(debug=False, host='192.168.101.7', port=8888)
    # app.run(debug=False, host='127.0.0.1', port=8888)
    
    end_storage()
    sys.exit(0)