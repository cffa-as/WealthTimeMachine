"""
AI服务模块 - 基于DeepSeek大语言模型的智能故事生成系统

模型选型：
- DeepSeek Chat: 67B参数大语言模型
- 特点：中文理解能力强，支持流式输出，API兼容OpenAI格式
- 应用：个性化财务故事生成，自然语言理解

技术特点：
1. 流式响应（Streaming）：实时生成，降低延迟
2. Prompt工程：结构化Prompt设计，确保输出质量
3. JSON解析：多级容错机制，支持不完整JSON修复
4. 温度控制：temperature=0.8，平衡创造性和准确性

参考：
- OpenAI API Documentation
- DeepSeek API Documentation
"""
import os
import json
from typing import Dict, Any, AsyncGenerator
from openai import AsyncOpenAI

# DeepSeek API Key（从环境变量获取，必须配置）
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
if not DEEPSEEK_API_KEY:
    raise ValueError(
        "DEEPSEEK_API_KEY 环境变量未设置。"
        "请设置环境变量：export DEEPSEEK_API_KEY='your-api-key'"
        "或在 .env 文件中配置：DEEPSEEK_API_KEY=your-api-key"
    )

# 初始化DeepSeek客户端（兼容OpenAI格式）
deepseek_client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)


async def call_deepseek_stream(messages: list, temperature: float = 0.7) -> AsyncGenerator[str, None]:
    """
    调用DeepSeek API（流式输出）
    
    Args:
        messages: 消息列表，格式 [{"role": "system/user/assistant", "content": "..."}]
        temperature: 温度参数，控制随机性（0-1）
    
    Yields:
        AI生成的文本片段（逐个token）
    """
    stream_response = await deepseek_client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        temperature=temperature,
        max_tokens=4000,
        stream=True
    )
    
    async for chunk in stream_response:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


def build_story_prompt(financial_data: Dict, selected_path: Dict, target_amount: float) -> str:
    """
    构建故事生成的Prompt
    
    根据用户的目标、资产、收入、选择的路径等信息，生成个性化的财务故事
    """
    goal = financial_data["goal"]
    current_asset = financial_data["currentAsset"]
    monthly_income = financial_data["monthlyIncome"]
    
    path_name = selected_path["name"]
    monthly_save = selected_path["monthlySave"]
    expected_return = selected_path["expectedReturn"]
    target_months = selected_path["targetMonths"]
    risk_level = selected_path["riskLevel"]
    
    # 判断目标类型
    goal_type = "买房" if "买房" in goal or "房" in goal else \
                "买车" if "买车" in goal or "车" in goal else \
                "教育" if "教育" in goal else \
                "财务自由" if "自由" in goal or "退休" in goal else "一般目标"
    
    # 判断资产水平
    asset_level = "较低" if current_asset < 50000 else "中等" if current_asset < 200000 else "较高"
    
    # 判断收入水平
    income_level = "较低" if monthly_income < 10000 else "中等" if monthly_income < 20000 else "较高"
    
    prompt = f"""你是一个专业的财务故事讲述者，擅长用温暖、真实、有代入感的方式讲述财务规划故事。

请根据以下信息，生成一个5章节的财务故事，展示用户从现状到实现目标的完整旅程：

【用户信息】
- 财务目标：{goal}
- 当前资产：{current_asset:,.0f}元（{asset_level}水平）
- 月收入：{monthly_income:,.0f}元（{income_level}水平）
- 目标金额：约{target_amount/10000:.0f}万元

【选择的路径】
- 路径名称：{path_name}
- 每月储蓄：{monthly_save:,.0f}元
- 预期年化收益：{expected_return}%
- 预计时间：{target_months}个月
- 风险等级：{risk_level}（{"低风险" if risk_level == "low" else "中风险" if risk_level == "medium" else "高风险"}）

【故事要求】
1. 生成5个章节，每个章节要有标题、详细内容、时间线（第3章）和图片描述
2. 根据资产水平调整语气：
   - {asset_level}资产 → {"强调'从零开始'的励志感" if asset_level == "较低" else "强调'稳步积累'的踏实感" if asset_level == "中等" else "强调'财富增值'的成就感"}
3. 根据风险等级调整故事风格：
   - {risk_level} → {"强调'安全第一'、'稳扎稳打'" if risk_level == "low" else "强调'风险可控'、'收益平衡'" if risk_level == "medium" else "强调'敢于冒险'、'高收益'"}
4. 根据目标类型调整场景：
   - {goal_type} → 在故事中融入相关的具体场景和细节
5. 故事要真实、有代入感，避免说教，多用场景描写和内心独白
6. 每个章节约200-300字

【输出格式】
请严格按照以下JSON格式输出，不要添加任何其他文字：

{{
  "chapters": [
    {{
      "title": "第1章：现在的你",
      "content": "详细的故事内容...",
      "imageQuery": "英文图片描述，用于生成配图",
      "data": {{
        "currentAsset": {current_asset},
        "targetAmount": {int(target_amount)},
        "progress": {current_asset/target_amount:.2f}
      }}
    }},
    {{
      "title": "第2章：做出选择",
      "content": "详细的故事内容...",
      "imageQuery": "英文图片描述",
      "data": {{
        "monthlySave": {monthly_save},
        "expectedReturn": {expected_return/100},
        "targetDate": "{target_months}个月后"
      }}
    }},
    {{
      "title": "第3章：坚持的路上",
      "content": "详细的故事内容...",
      "imageQuery": "英文图片描述",
      "timeline": [
        {{"date": "2024-01", "event": "开始执行财务计划"}},
        {{"date": "2024-04", "event": "第一个季度，养成储蓄习惯"}},
        {{"date": "2024-07", "event": "完成一半进度，资产稳步增长"}},
        {{"date": "2024-10", "event": "进入冲刺阶段，目标越来越近"}}
      ]
    }},
    {{
      "title": "第4章：实现目标",
      "content": "详细的故事内容...",
      "imageQuery": "英文图片描述",
      "data": {{
        "finalAsset": {int(target_amount * 1.05)},
        "targetAmount": {int(target_amount)},
        "achievedEarly": {"true" if risk_level == "high" else "false"},
        "monthsEarly": {2 if risk_level == "high" else 0}
      }}
    }},
    {{
      "title": "尾声：新的开始",
      "content": "详细的故事内容...",
      "imageQuery": "英文图片描述",
      "data": {{
        "nextGoal": "设定你的下一个目标"
      }}
    }}
  ]
}}

请开始生成故事："""
    
    return prompt


async def generate_response(user_message: str) -> str:
    """
    生成AI回复（用于对话）
    
    Args:
        user_message: 用户消息
    
    Returns:
        AI生成的回复文本（300字以内，简单段落式，无markdown）
    """
    messages = [
        {
            "role": "system",
            "content": """你是一个专业的理财顾问AI助手，擅长用通俗易懂的语言回答用户的理财问题。

重要要求：
1. 回复必须控制在300字以内
2. 使用简单的段落式表达，不要使用markdown格式（不要用**、#、-等符号）
3. 用温暖、专业、易懂的方式回答，避免过于专业的术语
4. 多用比喻和例子，让回答更生动
5. 如果问题比较复杂，选择最重要的2-3个点回答即可"""
        },
        {
            "role": "user",
            "content": user_message
        }
    ]
    
    # 使用流式API，但收集完整回复
    full_response = ""
    async for chunk in call_deepseek_stream(messages, temperature=0.7):
        full_response += chunk
        # 如果已经超过300字，提前停止（留一些余量）
        if len(full_response) > 350:
            break
    
    # 清理回复：移除markdown格式，限制长度
    cleaned_response = full_response.strip()
    
    # 移除markdown格式
    import re
    # 移除 **粗体**
    cleaned_response = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned_response)
    # 移除 *斜体*
    cleaned_response = re.sub(r'\*(.*?)\*', r'\1', cleaned_response)
    # 移除 # 标题
    cleaned_response = re.sub(r'^#+\s*', '', cleaned_response, flags=re.MULTILINE)
    # 移除 - 列表符号
    cleaned_response = re.sub(r'^-\s*', '', cleaned_response, flags=re.MULTILINE)
    # 移除数字列表
    cleaned_response = re.sub(r'^\d+\.\s*', '', cleaned_response, flags=re.MULTILINE)
    # 移除多余的空行
    cleaned_response = re.sub(r'\n{3,}', '\n\n', cleaned_response)
    
    # 限制在300字以内
    if len(cleaned_response) > 300:
        # 按句号、问号、感叹号分割，保留完整的句子
        sentences = re.split(r'([。！？])', cleaned_response)
        result = ""
        for i in range(0, len(sentences), 2):
            if i + 1 < len(sentences):
                sentence = sentences[i] + sentences[i + 1]
            else:
                sentence = sentences[i]
            if len(result + sentence) <= 300:
                result += sentence
            else:
                break
        cleaned_response = result.strip()
    
    return cleaned_response
