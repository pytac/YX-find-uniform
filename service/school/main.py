# 测试版 ---

from flask import Flask, request
import json

app = Flask(__name__)

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
def handle_all_paths(path):
    # 打印请求路径
    print(f"Request Path: {request.path}")
    
    # 打印请求方法
    print(f"Request Method: {request.method}")
    
    # 打印查询参数
    print(f"Query Parameters: {dict(request.args)}")
    
    # 打印请求头
    print(f"Headers: {dict(request.headers)}")
    
    # 根据内容类型处理请求体数据
    data = None
    if request.is_json:
        data = request.get_json()
        print(f"JSON Payload: {data}")
    elif request.form:
        data = dict(request.form)
        print(f"Form Data: {data}")
    elif request.data:
        try:
            # 尝试解码为字符串
            data = request.data.decode('utf-8')
            print(f"Raw Data: {data}")
        except UnicodeDecodeError:
            print(f"Binary Data: {len(request.data)} bytes")
    
    # 返回简单的响应
    return {
        "message": "Request logged",
        "path": request.path,
        "method": request.method,
        "payload": data or dict(request.form) or (request.get_json() if request.is_json else None)
    }, 200

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=8888)