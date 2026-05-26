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

# 全局读写锁（保护 storage 和 information）
data_lock = threading.RLock()

storage = None
def start_init_storage():
    """
    {
        "school_name":"Example School",
        "sid":"Example",
        "service":"http://127.0.0.1:5000",
        "admin":{
            "username":"admin",
            "password":"123456",
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
            storage['service'] = input("[init] Type service url: ")
            # 在远程注册 （代办）
    else:
        with open(storage_file, 'r') as f:
            storage = json.load(f)
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
    
    # 确保 uid 存在，且值为字典
    if uid not in information:
        information[uid] = {}
    
    # 使用 int 类型的时间戳作为 Key
    # 使用 int(time_val * 1000) 可以提供毫秒级精度，减少同一秒内消息覆盖的风险
    # 如果业务严格限制 Key 为秒级时间戳，请使用 int(time_val)
    msg_key = int(time_val) 
    
    with data_lock:
        # 直接存入字典
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
            "time": int(time()),
            "auto_delete": False,
            "detail": {"yid": yid, "name": storage['school_name']}
        })

    return make_response("lossing report successful", True, {}), 200

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
            "time": int(time()),
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
    start_init_storage()
    start_init_information()

    # 启动定时清理线程（程序启动时立即清理一次，之后每小时一次）
    start_cleanup_thread()

    app.run(debug=False, host='127.0.0.1', port=8888)

    end_storage()
    sys.exit(0)