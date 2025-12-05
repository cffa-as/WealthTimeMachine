"""
阿里云 DashScope 实时语音识别服务
使用 fun-asr-realtime-2025-11-07 模型
"""
import os
import threading
from typing import Optional, Callable
from queue import Queue

try:
    import dashscope
    from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult
    DASHSCOPE_AVAILABLE = True
except ImportError:
    DASHSCOPE_AVAILABLE = False
    print("警告: dashscope 未安装，ASR功能将不可用。建议安装: pip install dashscope>=1.25.2")

# DashScope API Key（从环境变量获取）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")

# 检查必要的环境变量
if not DASHSCOPE_API_KEY and DASHSCOPE_AVAILABLE:
    print("警告: DashScope API Key 未配置，ASR功能将不可用。")
    print("请设置环境变量：")
    print("  export DASHSCOPE_API_KEY='your-api-key'")
    print("或在 .env 文件中配置：DASHSCOPE_API_KEY=your-api-key")


class ASRCallback(RecognitionCallback):
    """语音识别回调类"""
    def __init__(self, on_text: Optional[Callable[[str], None]] = None, on_sentence_end: Optional[Callable[[str], None]] = None):
        super().__init__()
        self.on_text_callback = on_text
        self.on_sentence_end_callback = on_sentence_end
        self.text_queue = Queue()
        self.sentence_queue = Queue()
    
    def on_open(self) -> None:
        print('ASR连接已建立')
    
    def on_close(self) -> None:
        print('ASR连接已关闭')
    
    def on_complete(self) -> None:
        print('ASR识别完成')
    
    def on_error(self, message) -> None:
        print(f'ASR错误: {message.message}')
        if self.on_text_callback:
            self.on_text_callback(f"[错误] {message.message}")
    
    def on_event(self, result: RecognitionResult) -> None:
        sentence = result.get_sentence()
        if 'text' in sentence:
            text = sentence['text']
            print(f'ASR识别文本: {text}')
            
            if self.on_text_callback:
                self.on_text_callback(text)
            
            if RecognitionResult.is_sentence_end(sentence):
                print(f'ASR句子结束, request_id: {result.get_request_id()}')
                if self.on_sentence_end_callback:
                    self.on_sentence_end_callback(text)


class DashScopeASRService:
    """阿里云 DashScope 实时语音识别服务类"""
    
    def __init__(self):
        if not DASHSCOPE_AVAILABLE:
            print("警告: dashscope SDK 未安装，ASR功能将不可用")
            self.available = False
        elif not DASHSCOPE_API_KEY:
            print("警告: DashScope API Key 未配置，ASR功能将不可用")
            self.available = False
        else:
            self.available = True
            dashscope.api_key = DASHSCOPE_API_KEY
            dashscope.base_websocket_api_url = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'
            print("DashScope ASR 服务初始化成功")
    
    def create_recognition(
        self,
        on_text: Optional[Callable[[str], None]] = None,
        on_sentence_end: Optional[Callable[[str], None]] = None
    ) -> Optional[Recognition]:
        """
        创建语音识别实例
        
        Args:
            on_text: 实时文本回调函数
            on_sentence_end: 句子结束回调函数
            
        Returns:
            Recognition 实例，失败返回None
        """
        if not self.available:
            return None
        
        try:
            callback = ASRCallback(on_text=on_text, on_sentence_end=on_sentence_end)
            recognition = Recognition(
                model='fun-asr-realtime-2025-11-07',
                format='pcm',
                sample_rate=16000,  # 支持 8000, 16000
                semantic_punctuation_enabled=False,
                callback=callback
            )
            return recognition
        except Exception as e:
            print(f"创建ASR识别实例失败: {e}")
            import traceback
            print(traceback.format_exc())
            return None


# 全局实例
dashscope_asr_service = DashScopeASRService() if DASHSCOPE_AVAILABLE else None

