"""
腾讯云混元生图服务
"""
import os
import json
import time
from typing import Optional, Dict, Any

# 尝试导入腾讯云SDK
TENCENT_SDK_AVAILABLE = False
try:
    from tencentcloud.common import credential
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
    from tencentcloud.aiart.v20221229 import aiart_client, models
    TENCENT_SDK_AVAILABLE = True
except ImportError:
    print("警告: 腾讯云SDK未安装，文生图功能将不可用。请运行: pip install tencentcloud-sdk-python")
except Exception as e:
    print(f"警告: 导入腾讯云SDK时出错: {e}")

# 腾讯云配置（从环境变量获取，必须配置）
TENCENT_SECRET_ID = os.getenv("TENCENT_SECRET_ID")
TENCENT_SECRET_KEY = os.getenv("TENCENT_SECRET_KEY")
# 混元生图接口需要使用 ap-shanghai（上海）地域，不支持 ap-beijing
TENCENT_REGION = os.getenv("TENCENT_REGION", "ap-shanghai")

# 检查必要的环境变量
if not TENCENT_SECRET_ID or not TENCENT_SECRET_KEY:
    print("警告: 腾讯云密钥未配置，文生图功能将不可用。")
    print("请设置环境变量：")
    print("  export TENCENT_SECRET_ID='your-secret-id'")
    print("  export TENCENT_SECRET_KEY='your-secret-key'")
    print("或在 .env 文件中配置")


class TencentImageService:
    """腾讯云混元生图服务类"""
    
    def __init__(self):
        if not TENCENT_SDK_AVAILABLE:
            print("警告: 腾讯云SDK未安装，文生图功能将不可用")
            self.available = False
            return
        
        if not TENCENT_SECRET_ID or not TENCENT_SECRET_KEY:
            print("警告: 腾讯云密钥未配置，文生图功能将不可用。请设置环境变量 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY")
            self.available = False
        else:
            self.available = True
            try:
                if TENCENT_SDK_AVAILABLE:
                    # 初始化凭证
                    cred = credential.Credential(TENCENT_SECRET_ID, TENCENT_SECRET_KEY)
                    # 实例化http选项
                    httpProfile = HttpProfile()
                    httpProfile.endpoint = "aiart.tencentcloudapi.com"
                    # 实例化client选项
                    clientProfile = ClientProfile()
                    clientProfile.httpProfile = httpProfile
                    # 混元生图接口需要使用 ap-shanghai（上海）地域
                    # 注意：虽然endpoint是统一的，但region参数需要设置为支持的地域
                    region = TENCENT_REGION if TENCENT_REGION else "ap-shanghai"
                    # 实例化要请求产品的client对象
                    self.client = aiart_client.AiartClient(cred, region, clientProfile)
                    print(f"腾讯云混元生图服务初始化成功，使用地域: {region}")
                else:
                    self.available = False
            except Exception as e:
                print(f"初始化腾讯云客户端失败: {e}")
                self.available = False
    
    def generate_image(self, prompt: str, resolution: str = "1024:1024", rsp_img_type: str = "url") -> Optional[str]:
        """
        生成图片（使用极速版接口，同步返回）
        
        Args:
            prompt: 文本描述
            resolution: 图片分辨率，默认1024:1024
            rsp_img_type: 返回图像方式，'url' 或 'base64'，默认为 'url'
            
        Returns:
            图片URL（如果rsp_img_type='url'）或base64字符串（如果rsp_img_type='base64'），失败返回None
        """
        if not self.available or not TENCENT_SDK_AVAILABLE:
            return None
        
        try:
            # 使用极速版接口 TextToImageLite（同步接口，直接返回图片）
            req = models.TextToImageLiteRequest()
            req.Prompt = prompt
            req.Resolution = resolution
            req.LogoAdd = 1  # 添加水印
            req.RspImgType = rsp_img_type  # 返回URL，有效期1小时
            
            # 调用接口（同步，直接返回图片）
            resp = self.client.TextToImageLite(req)
            
            # 直接返回图片URL或base64
            if hasattr(resp, 'ResultImage'):
                return resp.ResultImage
            else:
                print(f"响应中未找到ResultImage字段，响应对象: {type(resp)}")
                # 尝试通过其他方式获取
                if hasattr(resp, 'result_image'):
                    return resp.result_image
                elif hasattr(resp, '__dict__'):
                    resp_dict = resp.__dict__
                    return resp_dict.get('ResultImage') or resp_dict.get('result_image')
                return None
            
        except Exception as e:
            if TENCENT_SDK_AVAILABLE and 'TencentCloudSDKException' in str(type(e)):
                print(f"腾讯云API调用失败: {e}")
            else:
                print(f"生成图片失败: {e}")
            import traceback
            print(f"详细错误: {traceback.format_exc()}")
            return None
    
    def query_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        查询任务状态
        
        Args:
            job_id: 任务ID
            
        Returns:
            任务状态信息或None
        """
        if not self.available or not TENCENT_SDK_AVAILABLE:
            return None
        
        try:
            req = models.QueryTextToImageJobRequest()
            req.JobId = job_id
            
            resp = self.client.QueryTextToImageJob(req)
            
            # 调试：打印响应对象的所有属性（仅第一次查询时打印）
            if not hasattr(resp, 'Status'):
                # 获取所有公共属性
                attrs = [attr for attr in dir(resp) if not attr.startswith('_')]
                print(f"调试：响应对象类型: {type(resp)}")
                print(f"调试：响应对象属性: {attrs}")
                # 尝试获取响应对象的字符串表示
                try:
                    print(f"调试：响应对象内容: {resp}")
                except:
                    pass
                
                # 尝试通过字典方式访问
                if hasattr(resp, '__dict__'):
                    print(f"调试：响应对象__dict__: {resp.__dict__}")
            
            # 安全获取响应属性 - 尝试多种可能的字段名
            status = None
            if hasattr(resp, 'Status'):
                status = resp.Status
            elif hasattr(resp, 'status'):
                status = resp.status
            elif hasattr(resp, 'JobStatus'):
                status = resp.JobStatus
            elif hasattr(resp, 'job_status'):
                status = resp.job_status
            else:
                # 尝试通过字典方式访问
                if hasattr(resp, '__dict__'):
                    resp_dict = resp.__dict__
                    status = resp_dict.get('Status') or resp_dict.get('status') or resp_dict.get('JobStatus')
            
            if status is None:
                # 打印所有可能的属性值
                attrs = [attr for attr in dir(resp) if not attr.startswith('_')]
                print(f"警告：无法获取任务状态 (JobId: {job_id})")
                print(f"响应对象类型: {type(resp)}")
                print(f"可用属性: {attrs}")
                # 尝试打印一些常见属性的值
                for attr in ['Status', 'status', 'JobStatus', 'JobId', 'ResultImage', 'Progress']:
                    if hasattr(resp, attr):
                        try:
                            print(f"  {attr} = {getattr(resp, attr)}")
                        except:
                            pass
                return None
            
            result = {
                "Status": status,  # PENDING, RUNNING, SUCCESS, FAIL
            }
            
            # 可选字段
            if hasattr(resp, 'JobId'):
                result["JobId"] = resp.JobId
            elif hasattr(resp, 'job_id'):
                result["JobId"] = resp.job_id
                
            if hasattr(resp, 'Progress'):
                result["Progress"] = resp.Progress
            elif hasattr(resp, 'progress'):
                result["Progress"] = resp.progress
                
            if hasattr(resp, 'ResultImage'):
                result["ResultImage"] = resp.ResultImage
            elif hasattr(resp, 'result_image'):
                result["ResultImage"] = resp.result_image
                
            if hasattr(resp, 'ErrorMsg'):
                result["ErrorMsg"] = resp.ErrorMsg
            elif hasattr(resp, 'error_msg'):
                result["ErrorMsg"] = resp.error_msg
            elif hasattr(resp, 'Error'):
                result["ErrorMsg"] = resp.Error
                
            return result
            
        except Exception as e:
            if TENCENT_SDK_AVAILABLE and 'TencentCloudSDKException' in str(type(e)):
                print(f"查询任务状态失败: {e}")
            else:
                print(f"查询任务状态失败: {e}")
            import traceback
            print(f"详细错误: {traceback.format_exc()}")
            return None
    
    def wait_for_image(self, job_id: str, max_wait: int = 60) -> Optional[str]:
        """
        等待图片生成完成
        
        Args:
            job_id: 任务ID
            max_wait: 最大等待时间（秒）
            
        Returns:
            图片URL或None
        """
        if not self.available:
            return None
        
        start_time = time.time()
        check_interval = 3  # 每3秒检查一次
        
        while time.time() - start_time < max_wait:
            status = self.query_job_status(job_id)
            if not status:
                # 如果查询失败，等待后重试
                time.sleep(check_interval)
                continue
            
            current_status = status.get("Status", "UNKNOWN")
            
            if current_status == "SUCCESS":
                result_image = status.get("ResultImage")
                if result_image:
                    # ResultImage可能是对象，需要获取URL字段
                    if isinstance(result_image, dict):
                        image_url = result_image.get("ResultUrl") or result_image.get("Url") or result_image.get("url")
                    elif isinstance(result_image, str):
                        image_url = result_image
                    else:
                        # 尝试获取属性
                        image_url = getattr(result_image, "ResultUrl", None) or getattr(result_image, "Url", None)
                    
                    if image_url:
                        return image_url
                    else:
                        print(f"任务完成但ResultImage格式不正确: {result_image}")
                        return None
                else:
                    print(f"任务完成但未返回图片URL: {job_id}")
                    return None
            elif current_status == "FAIL":
                error_msg = status.get('ErrorMsg', '未知错误')
                print(f"图片生成失败: {error_msg}")
                return None
            elif current_status in ["PENDING", "RUNNING"]:
                # 任务进行中，继续等待
                progress = status.get("Progress", 0)
                if progress > 0:
                    print(f"图片生成进度: {progress}%")
                time.sleep(check_interval)
            else:
                # 未知状态，等待后重试
                print(f"未知任务状态: {current_status}")
                time.sleep(check_interval)
        
        print(f"图片生成超时: {job_id} (等待了 {max_wait} 秒)")
        return None


# 全局实例
tencent_image_service = TencentImageService()

