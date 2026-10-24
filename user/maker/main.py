"""制造商端：批量申请衣物 ID（YID），并生成对应的二维码图片。

流程：
    1. 校验学校 ID（调用总服务器 /maker/check_sid）
    2. 询问二维码保存文件夹（不存在会自动创建）
    3. 循环：询问是否继续 → 申请一个 YID → 生成二维码 → 存为 <时间戳>.png

用法：
    python main.py
"""

import os
import sys
import time

import qrcode
import requests

# 总服务器地址。总服务器与制造商端跑在同一台机器上时，直接用回环地址即可；
# 如果部署到别的机器，改成那台机器的地址（如 http://192.168.101.7:5000）。
SERVER_URL = "http://127.0.0.1:5000"

# 单次请求超时（秒）。服务器没启动时不会一直卡在这里
TIMEOUT = 10

# 视为“是”的回答
YES = ("", "y", "yes", "是")


def ask(prompt):
    return input(prompt).strip()


def confirm(prompt):
    return ask(prompt).lower() in YES


def ask_sid():
    """反复询问学校 ID，直到服务器确认存在、且用户自己也确认"""
    while True:
        sid = ask("请输入学校ID: ")
        if not sid:
            print("不能为空!")
            continue

        try:
            res = requests.post(
                f"{SERVER_URL}/maker/check_sid",
                json={"sid": sid},
                timeout=TIMEOUT,
            )
            data = res.json()
        except requests.RequestException as e:
            print(f"连接总服务器失败({SERVER_URL}): {e}")
            print("请先启动总服务器 service/main.py 后重试。")
            raise SystemExit(1)
        except ValueError:
            print("总服务器返回的不是 JSON，请检查地址是否正确。")
            raise SystemExit(1)

        if not data.get("Status"):
            print(f"检查学校ID失败: {data.get('Phrase')}")
            continue

        if not data["Detail"]["res"]:
            print("学校ID不存在!")
            continue

        print("学校ID存在!")
        if confirm(f"sid: {sid}\n你确认吗(Y/n): "):
            return sid
        print("请重新输入。")


def ask_folder():
    """反复询问保存文件夹，不存在则创建，最后让用户确认"""
    while True:
        # 从资源管理器把文件夹拖进终端时，路径会带上引号，这里一并去掉
        raw = ask("请输入二维码保存文件夹: ").strip().strip('"\'')
        if not raw:
            print("不能为空!")
            continue

        folder = os.path.abspath(os.path.expanduser(raw))

        if os.path.isfile(folder):
            print("这是一个文件，不是文件夹!")
            continue

        if not os.path.isdir(folder):
            try:
                os.makedirs(folder)
            except OSError as e:
                print(f"无法创建文件夹: {e}")
                continue
            print(f"已创建文件夹: {folder}")

        if not os.access(folder, os.W_OK):
            print("该文件夹不可写!")
            continue

        print(f"二维码将保存在: {folder}")
        if confirm("确认吗(Y/n): "):
            return folder


def request_yid(sid):
    """向总服务器申请一个 YID"""
    res = requests.post(
        f"{SERVER_URL}/maker/make",
        json={"sid": sid},
        timeout=TIMEOUT,
    )
    data = res.json()
    if not data.get("Status"):
        raise RuntimeError(data.get("Phrase") or f"HTTP {res.status_code}")
    return data["Detail"]["YID"]


def make_qr(yid, folder):
    """生成二维码并保存为 <时间戳>.png，返回文件路径"""
    # 同一秒内连续生成会撞名，往后找一个还没被占用的时间戳
    ts = int(time.time())
    while True:
        path = os.path.join(folder, f"{ts}.png")
        if not os.path.exists(path):
            break
        ts += 1

    qr = qrcode.QRCode(
        # 二维码要印在衣领上、还要经得起水洗，容错率取高一些
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(yid)
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(path)
    return path


def main():
    print("=== 批量获取YID & 生成二维码 ===")
    SERVER_URL = ask("请输入总服务器地址: ")
    print(f"总服务器: {SERVER_URL}")

    sid = ask_sid()
    folder = ask_folder()

    done = []
    try:
        while True:
            try:
                yid = request_yid(sid)
                path = make_qr(yid, folder)
            except ValueError:
                print("总服务器返回的不是 JSON，本次跳过。")
            except requests.RequestException as e:
                print(f"请求总服务器失败: {e}")
            except RuntimeError as e:
                print(f"申请YID失败: {e}")
            except OSError as e:
                print(f"保存二维码失败: {e}")
            else:
                done.append((yid, path))
                print(f"[{len(done)}] YID: {yid}")
                print(f"     已保存: {path}")

            if not confirm("\n继续生成吗(Y/n): "):
                break
    except KeyboardInterrupt:
        print("\n已中断。")

    if done:
        print(f"\n共生成 {len(done)} 个二维码，文件夹: {folder}")
    else:
        print("\n没有生成任何二维码。")
    return done


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n已中断。")
        sys.exit(130)
