import flask
import json
import os,sys

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

storage = None
def start_init_storage():
    """
    {
        "admin":{
            "username":"admin",
            "password":"123456"
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
                "uniform":[

                ]
            }
    else:
        with open(storage_file, 'r') as f:
            storage = json.load(f)

information = None
def start_init_information():
    """
    type:
         1 - 丢失通知 - detail: {"yid": yid}
         2 - 通知用户已领取 - detail: {"yid": yid}
         3 - 激活衣服通知 - detail: {"yid": yid}
         4 - 学校删除衣服通知 - detail: {"yid": yid}
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

# 删除 information -- 待完成

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
    最后一次测试: 2026-05-17 17:47
    """
    payload_data = flask.request.json
    yid = payload_data['yid']
    
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
    最后一次测试: 2026-05-17 17:53
    """
    data = flask.request.json
    uid = data['uid']
    if uid not in information:
        return make_response("get msg success", True, {"msg": []}), 200
    return make_response("get msg success", True, {"msg": information[uid]}), 200


# 测试用
@app.route("/tect/save", methods=['POST'])
def tect_save_storage():
    if agree_debug:
        end_storage()
        return make_response("save successfully", True, {}), 200
    else:
        return make_response("REJECT & FORBIDDEN", False, {}), 403

# is_saved = False
if __name__ == '__main__':
    start_init_prompt()
    start_init_storage()
    start_init_information()

    app.run(debug=False, host='127.0.0.1', port=8888)

    end_storage()
    sys.exit(0)