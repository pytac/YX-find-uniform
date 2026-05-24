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
        "uid":[{
                "type": type,
                "time": time,
                "auto_delete": t/f (15天后自动删除),
                "detail": {detail...}
            },...]
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

def send_information(uid, type, time, auto_delete=True, detail={}):
    if uid not in information:
        information[uid] = []
    information[uid].append({
        "type": type,
        "time": time,
        "auto_delete": auto_delete,
        "detail": detail
    })
# ------------------ 定时清理 information ------------------
def cleanup_information():
    """
    删除 information 中 auto_delete=True 且超过 15 天的消息。
    15 天 = 15 * 24 * 3600 秒。
    该函数在执行时会获取 data_lock，确保并发安全。

    最后一次测试: 2026-05-23 22:40
    """
    now_ts = int(time_module.time())
    expire_seconds = 15 * 24 * 3600
    deleted_count = 0
    empty_users = []

    with data_lock:
        for uid, msg_list in list(information.items()):
            new_list = []
            for msg in msg_list:
                auto_del = msg.get('auto_delete', False)
                msg_time = msg.get('time', 0)
                # 确保 msg_time 是数值类型
                try:
                    msg_time = int(msg_time)
                except (TypeError, ValueError):
                    msg_time = 0
                if auto_del and (now_ts - msg_time) > expire_seconds:
                    deleted_count += 1
                    continue
                new_list.append(msg)
            if new_list:
                information[uid] = new_list
            else:
                empty_users.append(uid)
        for uid in empty_users:
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
    最后一次测试: 2026-05-23 22:40
    """
    data = flask.request.json
    uid = data['uid']
    with data_lock:
        if uid not in information:
            return make_response("get msg success", True, {"msg": []}), 200
        # 返回副本，避免外部修改
        msg_copy = information[uid][:]
    return make_response("get msg success", True, {"msg": msg_copy}), 200

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