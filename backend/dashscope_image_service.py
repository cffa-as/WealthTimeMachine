"""
阿里云 DashScope 千问图片生成服务
"""
import os
import json
import requests
from typing import Optional, Dict, Any

# DashScope API Key（从环境变量获取）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")

# 检查必要的环境变量
if not DASHSCOPE_API_KEY:
    print("警告: DashScope API Key 未配置，文生图功能将不可用。")
    print("请设置环境变量：")
    print("  export DASHSCOPE_API_KEY='your-api-key'")
    print("或在 .env 文件中配置：DASHSCOPE_API_KEY=your-api-key")

# DashScope API 端点
DASHSCOPE_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"

# 千问 API 支持的尺寸列表
SUPPORTED_SIZES = [
    "1664*928",   # 横向
    "1472*1140",  # 横向
    "1328*1328",  # 正方形
    "1140*1472",  # 纵向
    "928*1664"    # 纵向
]


def map_to_supported_size(width: int, height: int) -> str:
    """
    将任意尺寸映射到千问 API 支持的尺寸
    
    Args:
        width: 目标宽度
        height: 目标高度
        
    Returns:
        支持的尺寸字符串，格式 "宽*高"
    """
    # 计算宽高比
    aspect_ratio = width / height if height > 0 else 1.0
    
    # 根据宽高比选择最接近的尺寸
    if aspect_ratio > 1.5:
        # 横向（宽 > 高）
        # 选择 1664*928 或 1472*1140
        if abs(aspect_ratio - 1664/928) < abs(aspect_ratio - 1472/1140):
            return "1664*928"
        else:
            return "1472*1140"
    elif aspect_ratio < 0.67:
        # 纵向（高 > 宽）
        # 选择 928*1664 或 1140*1472
        if abs(aspect_ratio - 928/1664) < abs(aspect_ratio - 1140/1472):
            return "928*1664"
        else:
            return "1140*1472"
    else:
        # 接近正方形，使用 1328*1328
        return "1328*1328"


class DashScopeImageService:
    """阿里云 DashScope 千问图片生成服务类"""
    
    def __init__(self):
        if not DASHSCOPE_API_KEY:
            print("警告: DashScope API Key 未配置，文生图功能将不可用")
            self.available = False
        else:
            self.available = True
            print("DashScope 千问图片生成服务初始化成功")
    
    def generate_image(self, prompt: str, resolution: str = "1024:1024", rsp_img_type: str = "url") -> Optional[str]:
        """
        生成图片
        
        Args:
            prompt: 文本描述
            resolution: 图片分辨率，格式 "宽*高"，如 "1024*1024"、"1328*1328"
            rsp_img_type: 返回图像方式，'url' 或 'base64'，默认为 'url'
            
        Returns:
            图片URL（如果rsp_img_type='url'）或base64字符串（如果rsp_img_type='base64'），失败返回None
        """
        if not self.available:
            return None
        
        try:
            # 解析分辨率（支持 "1024:1024" 或 "1024*1024" 格式）
            if ":" in resolution:
                width, height = resolution.split(":")
            elif "*" in resolution:
                width, height = resolution.split("*")
            else:
                # 默认 1024x1024
                width, height = "1024", "1024"
            
            # 转换为整数
            try:
                width_int = int(width.strip())
                height_int = int(height.strip())
            except ValueError:
                print(f"无法解析分辨率: {resolution}，使用默认尺寸 1328*1328")
                size = "1328*1328"
            else:
                # 检查是否是支持的尺寸
                size = f"{width_int}*{height_int}"
                if size not in SUPPORTED_SIZES:
                    # 映射到支持的尺寸
                    original_size = size
                    size = map_to_supported_size(width_int, height_int)
                    print(f"尺寸 {original_size} 不在支持列表中，已映射到 {size}")
            
            # 构建请求体
            payload = {
                "model": "qwen-image-plus",
                "input": {
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "text": prompt
                                }
                            ]
                        }
                    ]
                },
                "parameters": {
                    "negative_prompt": "",
                    "prompt_extend": True,
                    "watermark": False,
                    "size": size
                }
            }
            
            # 设置请求头
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}"
            }
            
            # 发送请求
            response = requests.post(
                DASHSCOPE_API_URL,
                headers=headers,
                json=payload,
                timeout=60  # 60秒超时
            )
            
            # 检查响应状态
            response.raise_for_status()
            
            # 解析响应
            result = response.json()
            
            # 提取图片 URL 或 base64
            # DashScope API 响应格式可能是：
            # 1. { "output": { "results": [{ "url": "...", "image": "..." }] } }
            # 2. { "output": { "choices": [{ "message": { "content": [{ "image": "..." }] } }] } }
            # 3. { "output": { "task_id": "...", "task_status": "..." } } (异步任务)
            # 4. 直接返回图片数据
            
            if "output" in result:
                output = result["output"]
                
                # 检查是否是异步任务
                if "task_id" in output:
                    print(f"DashScope API 返回异步任务 ID: {output.get('task_id')}")
                    print("注意: 当前实现仅支持同步返回，异步任务需要轮询查询")
                    return None
                
                # 检查 choices 数组（新格式）
                if "choices" in output and len(output["choices"]) > 0:
                    first_choice = output["choices"][0]
                    if "message" in first_choice and "content" in first_choice["message"]:
                        content = first_choice["message"]["content"]
                        # content 可能是数组或单个对象
                        if isinstance(content, list) and len(content) > 0:
                            first_content = content[0]
                        elif isinstance(content, dict):
                            first_content = content
                        else:
                            first_content = None
                        
                        if first_content and "image" in first_content:
                            image_url = first_content["image"]
                            # 根据 rsp_img_type 返回相应格式
                            if rsp_img_type == "base64":
                                # 如果是 URL，需要下载并转换为 base64（这里简化处理，直接返回 URL）
                                # 实际应用中可能需要下载图片并转换为 base64
                                if image_url.startswith("data:"):
                                    # 提取 base64 部分
                                    return image_url.split(",", 1)[1]
                                else:
                                    # URL 格式，返回 URL（或可以下载后转换）
                                    return image_url
                            else:
                                # 返回 URL
                                return image_url
                
                # 检查 results 数组（旧格式）
                if "results" in output and len(output["results"]) > 0:
                    first_result = output["results"][0]
                    
                    # 根据 rsp_img_type 返回相应格式
                    if rsp_img_type == "base64":
                        # 返回 base64 数据
                        if "image" in first_result:
                            # base64 数据可能带前缀 "data:image/png;base64,"，需要处理
                            image_data = first_result["image"]
                            if image_data.startswith("data:"):
                                # 提取 base64 部分
                                image_data = image_data.split(",", 1)[1]
                            return image_data
                    else:
                        # 返回 URL
                        if "url" in first_result:
                            return first_result["url"]
                        elif "image" in first_result:
                            # 如果返回的是 base64，也可以直接返回（前端可以处理）
                            return first_result["image"]
            
            # 如果响应格式不符合预期，打印调试信息
            print(f"DashScope API 响应格式不符合预期: {json.dumps(result, ensure_ascii=False, indent=2)}")
            return None
            
        except requests.exceptions.RequestException as e:
            print(f"DashScope API 请求失败: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    error_msg = json.dumps(error_detail, ensure_ascii=False, indent=2)
                    print(f"错误详情: {error_msg}")
                    
                    # 检查是否是资源不足或配额问题
                    error_str = str(error_detail).lower()
                    if "quota" in error_str or "limit" in error_str or "insufficient" in error_str or "资源" in error_str:
                        print("DashScope API 资源不足或配额已用完")
                except:
                    print(f"响应内容: {e.response.text}")
            return None
        except Exception as e:
            print(f"生成图片失败: {e}")
            import traceback
            print(f"详细错误: {traceback.format_exc()}")
            return None


# 全局实例
dashscope_image_service = DashScopeImageService()

