"""
阿里云 DashScope 通义千问实时语音合成服务
使用通义千问3-TTS-Flash-Realtime模型
"""
import os
import base64
import threading
import time
from typing import Optional
from pathlib import Path
import tempfile

try:
    import dashscope
    from dashscope.audio.qwen_tts_realtime import QwenTtsRealtime, QwenTtsRealtimeCallback, AudioFormat
    DASHSCOPE_AVAILABLE = True
except ImportError:
    DASHSCOPE_AVAILABLE = False
    print("警告: dashscope 未安装，TTS功能将不可用。建议安装: pip install dashscope>=1.25.2")

# DashScope API Key（从环境变量获取）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")

# 检查必要的环境变量
if not DASHSCOPE_API_KEY and DASHSCOPE_AVAILABLE:
    print("警告: DashScope API Key 未配置，TTS功能将不可用。")
    print("请设置环境变量：")
    print("  export DASHSCOPE_API_KEY='your-api-key'")
    print("或在 .env 文件中配置：DASHSCOPE_API_KEY=your-api-key")

# 支持的音色列表（通义千问3-TTS-Flash-Realtime）
SUPPORTED_VOICES = {
    "Cherry": {"name": "芊悦", "description": "阳光积极、亲切自然小姐姐", "dialect": "普通话"},
    "Ethan": {"name": "晨煦", "description": "标准普通话，带部分北方口音。阳光、温暖、活力、朝气", "dialect": "普通话"},
    "Jada": {"name": "上海-阿珍", "description": "风风火火的沪上阿姐", "dialect": "上海话"},
    "Dylan": {"name": "北京-晓东", "description": "北京胡同里长大的少年", "dialect": "北京话"},
    "Li": {"name": "南京-老李", "description": "耐心的瑜伽老师", "dialect": "南京话"},
    "Marcus": {"name": "陕西-秦川", "description": "面宽话短，心实声沉——老陕的味道", "dialect": "陕西话"},
    "Roy": {"name": "闽南-阿杰", "description": "诙谐直爽、市井活泼的台湾哥仔形象", "dialect": "闽南语"},
    "Peter": {"name": "天津-李彼得", "description": "天津相声，专业捧哏", "dialect": "天津话"},
    "Sunny": {"name": "四川-晴儿", "description": "甜到你心里的川妹子", "dialect": "四川话"},
    "Eric": {"name": "四川-程川", "description": "一个跳脱市井的四川成都男子", "dialect": "四川话"},
    "Rocky": {"name": "粤语-阿强", "description": "幽默风趣的阿强，在线陪聊", "dialect": "粤语"},
    "Kiki": {"name": "粤语-阿清", "description": "甜美的港妹闺蜜", "dialect": "粤语"},
}


class MyTtsCallback(QwenTtsRealtimeCallback):
    """TTS回调类"""
    def __init__(self):
        super().__init__()
        self.complete_event = threading.Event()
        self.audio_data = []
        self.error = None
        self.error_message = None
    
    def on_open(self) -> None:
        print('TTS连接已建立')
    
    def on_close(self, close_status_code, close_msg) -> None:
        print(f'TTS连接已关闭: code={close_status_code}, msg={close_msg}')
        
        # 检查是否是权限错误
        if close_msg:
            close_msg_str = str(close_msg)
            if 'Access denied' in close_msg_str or 'account' in close_msg_str.lower():
                self.error = "账户权限错误"
                self.error_message = "TTS服务访问被拒绝，请检查：\n1. API Key是否正确\n2. 账户余额是否充足\n3. 账户状态是否正常\n4. 是否开通了TTS服务权限"
            elif 'quota' in close_msg_str.lower() or 'limit' in close_msg_str.lower():
                self.error = "配额不足"
                self.error_message = "TTS服务配额已用完，请检查账户余额或配额限制"
            else:
                self.error = f"连接关闭: {close_msg_str}"
                self.error_message = close_msg_str
        
        self.complete_event.set()
    
    def on_event(self, response: dict) -> None:
        try:
            event_type = response.get('type', '')
            if event_type == 'session.created':
                print(f'TTS会话已创建: {response.get("session", {}).get("id", "")}')
            elif event_type == 'response.audio.delta':
                # 接收音频数据
                audio_b64 = response.get('delta', '')
                if audio_b64:
                    audio_bytes = base64.b64decode(audio_b64)
                    self.audio_data.append(audio_bytes)
            elif event_type == 'response.done':
                print('TTS响应完成')
            elif event_type == 'session.finished':
                print('TTS会话已完成')
                self.complete_event.set()
            elif event_type == 'error':
                # 处理错误事件
                error_info = response.get('error', {})
                error_msg = error_info.get('message', '未知错误')
                self.error = "TTS服务错误"
                self.error_message = error_msg
                print(f'TTS错误事件: {error_msg}')
                self.complete_event.set()
        except Exception as e:
            print(f'TTS事件处理错误: {e}')
            self.error = str(e)
            self.error_message = str(e)
            self.complete_event.set()
    
    def wait_for_finished(self):
        self.complete_event.wait()
        return b''.join(self.audio_data)


class DashScopeTTSService:
    """阿里云 DashScope 通义千问实时语音合成服务类"""
    
    def __init__(self):
        if not DASHSCOPE_AVAILABLE:
            print("警告: dashscope SDK 未安装，TTS功能将不可用")
            self.available = False
        elif not DASHSCOPE_API_KEY:
            print("警告: DashScope API Key 未配置，TTS功能将不可用")
            self.available = False
        else:
            self.available = True
            dashscope.api_key = DASHSCOPE_API_KEY
            print("DashScope TTS 服务初始化成功")
    
    def generate_speech(
        self, 
        text: str, 
        voice: str = "Cherry",
        output_format: str = "pcm"
    ) -> Optional[bytes]:
        """
        生成语音
        
        Args:
            text: 要合成的文本
            voice: 音色名称，默认为"Cherry"（芊悦）
                  支持的音色：Cherry, Jada, Dylan, Li, Marcus, Roy, Peter, Sunny, Eric, Rocky, Kiki
            output_format: 输出格式，"pcm" 或 "mp3"
            
        Returns:
            音频数据（bytes），失败返回None
        """
        if not self.available:
            return None
        
        # 验证音色是否支持
        if voice not in SUPPORTED_VOICES:
            print(f"警告: 不支持的音色 '{voice}'，使用默认音色 'Cherry'")
            voice = "Cherry"
        
        try:
            # 创建回调
            callback = MyTtsCallback()
            
            # 创建TTS客户端
            tts_client = QwenTtsRealtime(
                model='qwen3-tts-flash-realtime',
                callback=callback,
                url='wss://dashscope.aliyuncs.com/api-ws/v1/realtime'  # 北京地域
            )
            
            # 连接
            tts_client.connect()
            
            # 更新会话配置
            tts_client.update_session(
                voice=voice,
                response_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
                mode='server_commit'
            )
            
            # 发送文本（如果文本过长，需要分段发送）
            # TTS API限制：单个文本片段不能超过2000字符
            max_chunk_size = 1800  # 留一些余量，避免边界问题
            if len(text) <= max_chunk_size:
                tts_client.append_text(text)
            else:
                # 分段发送，按句号、问号、感叹号等标点符号分割
                import re
                # 按标点符号分割，尽量保持句子完整
                sentences = re.split(r'([。！？\n])', text)
                current_chunk = ""
                for i in range(0, len(sentences), 2):
                    if i + 1 < len(sentences):
                        sentence = sentences[i] + sentences[i + 1]
                    else:
                        sentence = sentences[i]
                    
                    if len(current_chunk + sentence) <= max_chunk_size:
                        current_chunk += sentence
                    else:
                        if current_chunk:
                            tts_client.append_text(current_chunk)
                        current_chunk = sentence
                
                # 发送最后一段
                if current_chunk:
                    tts_client.append_text(current_chunk)
            
            tts_client.finish()
            
            # 等待完成
            audio_data = callback.wait_for_finished()
            
            if callback.error:
                error_msg = callback.error
                if callback.error_message:
                    error_msg = f"{callback.error}\n{callback.error_message}"
                print(f"TTS生成失败: {error_msg}")
                # 如果是账户权限错误，抛出更详细的异常
                if "账户权限" in callback.error or "Access denied" in str(callback.error_message):
                    raise Exception(f"TTS账户权限错误: {callback.error_message or '请检查API Key和账户状态'}")
                return None
            
            if not audio_data:
                print("TTS生成失败: 未收到音频数据")
                if callback.error_message:
                    print(f"错误详情: {callback.error_message}")
                return None
            
            voice_info = SUPPORTED_VOICES.get(voice, {})
            print(f"TTS生成成功: {len(audio_data)} 字节，音色: {voice_info.get('name', voice)}")
            return audio_data
            
        except Exception as e:
            print(f"TTS生成失败: {e}")
            import traceback
            print(f"详细错误: {traceback.format_exc()}")
            return None
    
    def generate_speech_to_file(
        self,
        text: str,
        output_path: Optional[str] = None,
        voice: str = "Cherry"
    ) -> Optional[str]:
        """
        生成语音并保存到文件
        
        Args:
            text: 要合成的文本
            output_path: 输出文件路径，如果为None则使用临时文件
            voice: 音色名称，支持的音色：Cherry, Jada, Dylan, Li, Marcus, Roy, Peter, Sunny, Eric, Rocky, Kiki
            
        Returns:
            文件路径，失败返回None
        """
        audio_data = self.generate_speech(text, voice)
        if not audio_data:
            return None
        
        try:
            if output_path is None:
                # 使用临时文件
                temp_dir = Path(tempfile.gettempdir())
                output_path = str(temp_dir / f"tts_{int(time.time())}.pcm")
            
            # 保存音频文件
            with open(output_path, 'wb') as f:
                f.write(audio_data)
            
            print(f"TTS音频已保存: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"保存TTS音频失败: {e}")
            return None


# 全局实例
dashscope_tts_service = DashScopeTTSService() if DASHSCOPE_AVAILABLE else None

def get_supported_voices():
    """获取支持的音色列表"""
    return SUPPORTED_VOICES

