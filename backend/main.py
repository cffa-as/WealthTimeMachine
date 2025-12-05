from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
import json
import re

# 尝试加载 .env 文件（如果安装了 python-dotenv）
try:
    from dotenv import load_dotenv
    load_dotenv()  # 加载 .env 文件中的环境变量
except ImportError:
    # 如果没有安装 python-dotenv，跳过（可以使用系统环境变量）
    pass
import ai_service
try:
    from financial_model import financial_model
except ImportError as e:
    print(f"警告: 无法导入 financial_model: {e}")
    financial_model = None

try:
    from dashscope_image_service import dashscope_image_service
except ImportError as e:
    print(f"警告: 无法导入 dashscope_image_service: {e}")
    dashscope_image_service = None

try:
    import cache_service
except ImportError as e:
    print(f"警告: 无法导入 cache_service: {e}")
    cache_service = None

try:
    from dashscope_tts_service import dashscope_tts_service, get_supported_voices
except ImportError as e:
    print(f"警告: 无法导入 dashscope_tts_service: {e}")
    dashscope_tts_service = None
    get_supported_voices = None

try:
    from dashscope_asr_service import dashscope_asr_service
except ImportError as e:
    print(f"警告: 无法导入 dashscope_asr_service: {e}")
    dashscope_asr_service = None

app = FastAPI(title="财务时光机 API", version="1.0.0")

# 配置CORS，允许前端调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js默认端口
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class FinancialData(BaseModel):
    goal: str
    currentAsset: float
    monthlyIncome: float

class Path(BaseModel):
    id: int
    name: str
    monthlySave: float
    expectedReturn: float
    targetMonths: int
    riskLevel: str

class StoryRequest(BaseModel):
    goal: str
    currentAsset: float
    monthlyIncome: float
    selectedPath: Path

class TimelineItem(BaseModel):
    date: str
    event: str

class Chapter(BaseModel):
    title: str
    content: str
    data: Optional[Dict[str, Any]] = None
    timeline: Optional[List[TimelineItem]] = None
    imageQuery: Optional[str] = None

class StoryResponse(BaseModel):
    success: bool
    chapters: List[Chapter]
    message: Optional[str] = None

# 工具函数
def add_months(date: datetime, months: int) -> datetime:
    """添加月份"""
    new_date = date
    for _ in range(months):
        # 计算下个月的第一天
        if new_date.month == 12:
            new_date = new_date.replace(year=new_date.year + 1, month=1, day=1)
        else:
            new_date = new_date.replace(month=new_date.month + 1, day=1)
    return new_date

def format_date(date: datetime) -> str:
    """格式化日期为 YYYY-MM"""
    return f"{date.year}-{str(date.month).zfill(2)}"

def determine_goal_type(goal: str) -> str:
    """判断目标类型"""
    if "买房" in goal or "房" in goal:
        return "house"
    elif "买车" in goal or "车" in goal:
        return "car"
    elif "教育" in goal:
        return "education"
    elif "自由" in goal or "退休" in goal:
        return "freedom"
    else:
        return "general"

def generate_chapter1(data: FinancialData, targetAmount: float, goalType: str) -> Chapter:
    """生成第1章：现在的你"""
    asset_level = "low" if data.currentAsset < 50000 else "medium" if data.currentAsset < 200000 else "high"
    
    if asset_level == "low":
        content = f"""你坐在出租屋里，打开手机银行，看着账户里的{data.currentAsset/10000:.1f}万元。这是你工作以来，一点一滴攒下的积蓄。

你想起了自己的目标：{data.goal}。这个梦想看起来有些遥远，但你知道，每一个伟大的旅程都始于第一步。

你的月收入是{data.monthlyIncome:,.0f}元，虽然不算很高，但你相信，只要有计划、有坚持，梦想终会实现。

你打开了"财务时光机"，输入了自己的目标。AI告诉你：要实现这个目标，你需要准备约{targetAmount/10000:.0f}万元。

这个数字让你有点紧张，但更多的是期待。因为你知道，从今天开始，你的人生将翻开新的一页。"""
        imageQuery = "cartoon style illustration of a young person sitting in a cozy apartment room, looking at phone with banking app, warm lighting, hopeful expression, simple furniture, dreamy atmosphere"
    elif asset_level == "medium":
        content = f"""周末的下午，你坐在咖啡厅里，一边喝着拿铁，一边思考着未来。

账户里的{data.currentAsset/10000:.1f}万元，是你这几年努力工作的成果。你的月收入{data.monthlyIncome:,.0f}元，生活算是稳定，但你知道，这还不够。

你有一个更大的目标：{data.goal}。

你打开"财务时光机"，认真地输入了自己的信息。AI分析后告诉你：要实现这个目标，你需要准备约{targetAmount/10000:.0f}万元。

你算了算，如果按照现在的存钱速度，可能需要很长时间。但你不想等那么久，你想要一个更清晰、更高效的计划。

今天，就是改变的开始。"""
        imageQuery = "cartoon style illustration of a person sitting in a modern cafe with laptop and coffee, thoughtful expression, bright natural lighting, plants in background, planning future"
    else:
        content = f"""你站在落地窗前，俯瞰着城市的夜景。账户里的{data.currentAsset/10000:.1f}万元，是你多年积累的财富。

但你知道，财富不应该只是躺在账户里的数字，它应该为你的梦想服务。

你的目标是：{data.goal}。这不仅仅是一个财务目标，更是你对未来生活的期待。

你打开"财务时光机"，输入了自己的信息。AI告诉你：要实现这个目标，你需要准备约{targetAmount/10000:.0f}万元。

凭借你现在的资产基础和月收入{data.monthlyIncome:,.0f}元，这个目标完全可以实现。关键是，你需要一个科学的资产配置方案。

是时候让财富为梦想加速了。"""
        imageQuery = "cartoon style illustration of a successful person standing by floor-to-ceiling window overlooking city skyline at night, confident posture, modern office or apartment, inspiring view"
    
    return Chapter(
        title="第1章：现在的你",
        content=content,
        imageQuery=imageQuery,
        data={
            "currentAsset": data.currentAsset,
            "targetAmount": round(targetAmount),
            "progress": data.currentAsset / targetAmount,
        }
    )

def generate_chapter2(path: Path, goalType: str) -> Chapter:
    """生成第2章：做出选择"""
    path_style = "conservative" if path.riskLevel == "low" else "balanced" if path.riskLevel == "medium" else "aggressive"
    
    if path_style == "conservative":
        content = f"""面对三条不同的路径，你选择了{path.name}。

你知道自己的性格：稳重、谨慎，不喜欢冒险。你更愿意用时间换取安全感，而不是用风险换取速度。

{path.name}意味着：每月存{path.monthlySave:,.0f}元，主要投资于低风险的理财产品，预期年化收益{path.expectedReturn}%。

虽然收益不是最高的，但你知道，这条路最适合你。因为在实现梦想的路上，最重要的不是跑得最快，而是跑到终点。

你深吸一口气，点击了"确认"。从今天开始，你的财务计划正式启动。"""
        imageQuery = "cartoon style illustration of a person standing at a crossroads with three paths, choosing the safe steady path, protective shield symbol, calm colors, thoughtful decision-making scene"
    elif path_style == "balanced":
        content = f"""三条路径摆在你面前，你选择了{path.name}。

你不是一个极端的人。你既不想过于保守错失机会，也不想过于激进承担太大风险。你相信，最好的策略是在风险和收益之间找到平衡。

{path.name}意味着：每月存{path.monthlySave:,.0f}元，采用"稳健+成长"的组合投资策略，预期年化收益{path.expectedReturn}%。

这个方案让你感到舒适。它既有稳定的基础，又有成长的空间。就像人生一样，需要在稳定和冒险之间找到最佳平衡点。

你点击了"确认"，心中充满期待。"""
        imageQuery = "cartoon style illustration of a person balancing on a scale with stability and growth symbols, harmonious colors, confident expression, balanced composition showing wisdom"
    else:
        content = f"""看着三条路径，你毫不犹豫地选择了{path.name}。

你知道自己还年轻，有足够的时间和能力承担风险。与其慢慢积累，不如大胆一搏。你相信，高风险才能带来高回报。

{path.name}意味着：每月存{path.monthlySave:,.0f}元，主要投资于股票、基金等高成长性资产，预期年化收益{path.expectedReturn}%。

这个方案让你兴奋。虽然路上可能会有波动，但你相信，只要方向正确，短期的波动都不是问题。

你坚定地点击了"确认"。年轻就是最大的资本，是时候为梦想加速了！"""
        imageQuery = "cartoon style illustration of a determined person running on an upward trending arrow path, dynamic pose, energetic colors, rocket or growth symbols, ambitious and bold atmosphere"
    
    return Chapter(
        title="第2章：做出选择",
        content=content,
        imageQuery=imageQuery,
        data={
            "monthlySave": path.monthlySave,
            "expectedReturn": path.expectedReturn / 100,
            "targetDate": f"{path.targetMonths}个月后",
        }
    )

def generate_chapter3(path: Path, targetMonths: int, goalType: str) -> Chapter:
    """生成第3章：坚持的路上"""
    current_date = datetime.now()
    midpoint = targetMonths // 2
    
    timeline = [
        TimelineItem(date=format_date(current_date), event="开始执行财务计划"),
        TimelineItem(date=format_date(add_months(current_date, targetMonths // 4)), event="第一个季度，养成储蓄习惯"),
        TimelineItem(date=format_date(add_months(current_date, midpoint)), event="完成一半进度，资产稳步增长"),
        TimelineItem(date=format_date(add_months(current_date, targetMonths * 3 // 4)), event="进入冲刺阶段，目标越来越近"),
    ]
    
    if path.riskLevel == "low":
        content = f"""时间一个月一个月地过去。

每个月发工资的那天，你都会第一时间转出{path.monthlySave:,.0f}元到理财账户。这已经成为了你的习惯，就像呼吸一样自然。

第{int(targetMonths * 0.3)}个月，你的朋友约你去旅游，你犹豫了一下，还是拒绝了。你知道，每一次消费都是在延迟梦想的实现。

第{midpoint}个月，你打开账户，发现资产已经增长了不少。虽然增长速度不快，但每一分钱都是实实在在的，这让你感到踏实。

市场偶尔会有波动，但因为你选择的是稳健型投资，波动对你的影响很小。你继续坚持着，一步一个脚印。

第{targetMonths * 3 // 4}个月，你发现目标已经近在眼前。你开始研究{"房源信息" if goalType == "house" else "车型配置" if goalType == "car" else "具体实施方案"}，为最后的冲刺做准备。"""
        imageQuery = "cartoon style illustration of a person climbing steady steps up a mountain, progress bar filling up, calendar pages flying, determined expression, steady pace, encouraging atmosphere"
    elif path.riskLevel == "medium":
        content = f"""计划开始执行了。

每个月，你都会准时存入{path.monthlySave:,.0f}元。你采用的是"稳健+成长"的组合策略，一部分资金投资于稳定的理财产品，另一部分投资于成长性资产。

第{int(targetMonths * 0.2)}个月，市场出现了一次小幅下跌。你的账户从增长转为小幅亏损。你有点紧张，但你记得AI的建议："短期波动是正常的，关键是长期趋势。"你选择了坚持。

第{midpoint}个月，市场回暖，你的账户不仅收复了失地，还创了新高。你开始理解什么叫"风险和收益并存"。

你继续坚持着每月的储蓄计划。有时候会想放弃，但每次打开"财务时光机"，看到自己的进度条在不断前进，你就又有了动力。

第{int(targetMonths * 0.8)}个月，你发现自己已经完成了80%的目标。你开始认真规划{"买房" if goalType == "house" else "买车" if goalType == "car" else "实现目标"}的具体步骤。"""
        imageQuery = "cartoon style illustration of a person navigating through ups and downs on a wavy path, showing resilience, chart with fluctuations in background, perseverance theme, hopeful colors"
    else:
        content = f"""这是一段充满刺激的旅程。

每个月，你都会投入{path.monthlySave:,.0f}元到高成长性资产中。你知道这意味着更大的波动，但你已经做好了心理准备。

第{int(targetMonths * 0.15)}个月，市场大跌。你的账户从盈利10%变成了亏损5%。你的朋友劝你赶紧止损，但你选择了加仓。你相信，危机就是机会。

第{int(targetMonths * 0.4)}个月，市场反弹，你的账户收益率达到了25%。你的坚持得到了回报。你开始理解什么叫"高风险高收益"。

第{midpoint}个月，你的资产已经超过了预期进度。你没有因此放松，反而更加专注。你知道，市场随时可能变化，只有坚持到最后才能真正胜利。

期间经历了几次大的波动，但你都挺过来了。你发现，最大的敌人不是市场，而是自己的情绪。

第{int(targetMonths * 0.85)}个月，你发现目标已经触手可及。你开始为{"买房" if goalType == "house" else "买车" if goalType == "car" else "实现梦想"}做最后的准备。"""
        imageQuery = "cartoon style illustration of a person riding a roller coaster of market ups and downs, exciting and dynamic, showing courage and determination, vibrant energetic colors, thrilling journey"
    
    return Chapter(
        title="第3章：坚持的路上",
        content=content,
        imageQuery=imageQuery,
        timeline=[item.dict() for item in timeline]
    )

def generate_chapter4(data: FinancialData, path: Path, targetAmount: float, goalType: str) -> Chapter:
    """生成第4章：实现目标"""
    final_asset = round(targetAmount * 1.05)
    achieved_early = path.riskLevel == "high"
    
    if goalType == "house":
        content = f"""第{path.targetMonths}个月，你终于攒够了首付。

那天，你站在售楼处，手里拿着银行卡，心情既激动又紧张。从{data.currentAsset/10000:.1f}万到{final_asset/10000:.1f}万，从一个模糊的梦想到一个具体的地址，你用了{path.targetMonths}个月。

签约的那一刻，你想起了这{path.targetMonths}个月的点点滴滴：每个月准时的储蓄、市场波动时的坚持、朋友聚会时的克制...

现在，这一切都值得了。

你站在新房的阳台上，看着窗外的风景。这个小小的空间，承载着你的梦想和努力。你明白了：财务规划不是限制生活，而是让生活更有方向。

更重要的是，你学会了一种能力：把梦想变成计划，把计划变成现实。"""
        imageQuery = "cartoon style illustration of a happy person standing on balcony of new home, holding keys, beautiful view, warm sunset lighting, achievement and joy, dream come true atmosphere"
    elif goalType == "car":
        content = f"""第{path.targetMonths}个月，你走进了4S店。

销售顾问问你："全款还是贷款？"你微笑着说："全款。"

从{data.currentAsset/10000:.1f}万到{final_asset/10000:.1f}万，你用了{path.targetMonths}个月。这{path.targetMonths}个月里，你每次路过4S店都会停下来看看，想象着自己开着新车的样子。

现在，梦想成真了。

提车的那天，你坐在驾驶座上，双手握着方向盘，感受着新车的气息。这不仅仅是一辆车，更是你努力的证明。

你发动引擎，驶向回家的路。你知道，这只是开始。有了这次经验，你可以实现更多的梦想。"""
        imageQuery = "cartoon style illustration of a proud person sitting in driver seat of new car, holding steering wheel, excited smile, shiny new car interior, accomplishment and freedom theme"
    elif goalType == "education":
        content = f"""第{path.targetMonths}个月，你终于攒够了教育基金。

你打开银行账户，看着那个数字：{final_asset/10000:.1f}万元。这是你为孩子准备的未来。

从{data.currentAsset/10000:.1f}万到{final_asset/10000:.1f}万，你用了{path.targetMonths}个月。这{path.targetMonths}个月里，你减少了很多不必要的开支，把每一分钱都用在刀刃上。

现在，你可以自信地告诉孩子："无论你想学什么，爸爸/妈妈都能支持你。"

你明白了，最好的爱不是给孩子留下多少钱，而是教会他们如何规划人生、实现梦想。"""
        imageQuery = "cartoon style illustration of a parent and child looking at bright future together, books and graduation cap symbols, warm family atmosphere, hope and love, educational theme"
    elif goalType == "freedom":
        content = f"""第{path.targetMonths}个月，你的资产达到了{final_asset/10000:.1f}万元。

这个数字，意味着你有了更多的选择权。你可以选择继续工作，也可以选择暂时休息；可以选择稳定的生活，也可以选择冒险创业。

从{data.currentAsset/10000:.1f}万到{final_asset/10000:.1f}万，你用了{path.targetMonths}个月。这{path.targetMonths}个月的经历，让你明白了什么是真正的财务自由。

财务自由不是不工作，而是有选择的权利；不是挥霍无度，而是不为钱发愁。

你打开窗户，深呼吸。你知道，人生的新篇章，才刚刚开始。"""
        imageQuery = "cartoon style illustration of a liberated person with arms spread wide on mountain top, birds flying, sunrise, freedom and possibilities, inspiring landscape, achievement of independence"
    else:
        content = f"""第{path.targetMonths}个月，你实现了自己的目标。

账户里的{final_asset/10000:.1f}万元，是你{path.targetMonths}个月努力的成果。从{data.currentAsset/10000:.1f}万到{final_asset/10000:.1f}万，你证明了：只要有计划、有坚持，梦想就能实现。

这{path.targetMonths}个月的经历，改变的不仅仅是你的资产数字，更是你的思维方式。你学会了：

- 把梦想转化为具体的数字和计划
- 在诱惑面前保持定力
- 在波动中保持冷静
- 相信时间的力量

现在，你站在新的起点上。你知道，这只是开始，未来还有更多的梦想等着你去实现。"""
        imageQuery = "cartoon style illustration of a victorious person reaching the summit with flag, celebrating achievement, trophy or medal, success symbols, triumphant and joyful atmosphere"
    
    return Chapter(
        title="第4章：实现目标",
        content=content,
        imageQuery=imageQuery,
        data={
            "finalAsset": final_asset,
            "targetAmount": round(targetAmount),
            "achievedEarly": achieved_early,
            "monthsEarly": 2 if achieved_early else 0,
        }
    )

def generate_chapter5(goalType: str) -> Chapter:
    """生成第5章：尾声"""
    content = """故事到这里，似乎应该结束了。

但你知道，这不是结束，而是新的开始。

实现一个目标，最大的意义不是目标本身，而是在这个过程中，你成为了一个更好的自己：

你学会了延迟满足，知道了什么是真正重要的；
你学会了坚持，明白了时间的力量；
你学会了规划，懂得了如何把梦想变成现实。

这些能力，将伴随你一生。

现在，你可以设定下一个目标了。也许是更大的房子，也许是环游世界，也许是提前退休...

无论是什么，你都知道该怎么做。

因为你已经掌握了"财务时光机"的秘密：

未来不是等来的，而是规划出来的。

你的故事，未完待续..."""
    
    imageQuery = "cartoon style illustration of a person standing at a new starting line with multiple paths ahead, sunrise or dawn, open book transforming into a bright future, hope and endless possibilities"
    
    return Chapter(
        title="尾声：新的开始",
        content=content,
        imageQuery=imageQuery,
        data={
            "nextGoal": "设定你的下一个目标",
        }
    )

@app.get("/")
async def root():
    """健康检查"""
    return {
        "message": "财务时光机 API 运行中",
        "status": "ok",
        "ai_provider": "deepseek",
        "streaming": True
    }

@app.post("/api/planning/recommend")
async def recommend_path(financial_data: FinancialData):
    """
    使用金融决策模型推荐理财路径
    
    根据用户的目标、资产、收入，使用专业的金融模型进行风险评估和路径推荐
    返回三种风险等级（low, medium, high）的推荐方案，让用户选择
    
    使用现代投资组合理论、风险调整收益等金融计算方法
    """
    try:
        if financial_model is None:
            raise HTTPException(status_code=500, detail="金融模型未正确加载，请检查后端日志")
        
        print(f"收到推荐请求: goal={financial_data.goal}, asset={financial_data.currentAsset}, income={financial_data.monthlyIncome}")
        
        # 计算目标金额（三种方案使用相同的目标）
        target_amount = financial_model.calculate_target_amount(financial_data.goal)
        
        # 计算风险承受能力（用于确定主要推荐）
        risk_assessment = financial_model.calculate_risk_tolerance(
            financial_data.currentAsset,
            financial_data.monthlyIncome,
            financial_data.goal,
            age=30
        )
        recommended_risk = risk_assessment["risk_level"]
        
        # 为三种风险等级分别生成推荐
        recommendations = {}
        for risk_level in ["low", "medium", "high"]:
            # 计算该风险等级的最优储蓄方案
            savings_plan = financial_model.calculate_optimal_savings_rate(
                financial_data.currentAsset,
                financial_data.monthlyIncome,
                target_amount,
                risk_level
            )
            
            # 获取风险配置
            profile = financial_model.risk_profiles[risk_level]
            
            # 计算各种指标
            sharpe_ratio = financial_model.calculate_sharpe_ratio(risk_level)
            sortino_ratio = financial_model.calculate_sortino_ratio(risk_level)
            var_95 = financial_model.calculate_var(risk_level, confidence_level=0.95)
            cvar_95 = financial_model.calculate_cvar(risk_level, confidence_level=0.95)
            
            # 蒙特卡洛模拟
            mc_result = financial_model.monte_carlo_simulation(
            current_asset=financial_data.currentAsset,
                monthly_save=savings_plan["monthly_save"],
                expected_return=profile["expected_return"],
                volatility=profile["volatility"],
                months=savings_plan["target_months"],
                simulations=10000
            )
            
            # 动态资产配置优化
            optimized_allocation = financial_model.optimize_asset_allocation(
                risk_level=risk_level,
                current_asset=financial_data.currentAsset,
                target_amount=target_amount,
                time_horizon=savings_plan["target_months"]
            )
            
            # 生成推荐理由
            reason = financial_model._generate_recommendation_reason(
                risk_assessment,
                savings_plan,
                risk_level,
                target_amount
            )
            
            recommendations[risk_level] = {
                "recommendedRisk": risk_level,
                "reason": reason,
                "monthlySave": round(savings_plan["monthly_save"], 2),
                "expectedReturn": round(profile["expected_return"] * 100, 1),
                "targetMonths": savings_plan["target_months"],
                "targetAmount": round(target_amount, 2),
                "expectedFinalAmount": round(savings_plan["expected_final_amount"], 2),
                "sharpeRatio": round(sharpe_ratio, 2),
                "sortinoRatio": round(sortino_ratio, 2),
                "var95": round(var_95, 2),
                "cvar95": round(cvar_95, 2),
                "volatility": round(profile["volatility"] * 100, 1),
                "maxDrawdown": round(profile["max_drawdown"] * 100, 1),
                "assetAllocation": optimized_allocation,
                "monteCarloSimulation": {
                    "expectedValue": mc_result["expected_value"],
                    "median": mc_result["median"],
                    "confidenceInterval5": mc_result["p5"],
                    "confidenceInterval95": mc_result["p95"],
                    "confidenceInterval": mc_result["confidence_interval"]
                },
                "riskScore": round(risk_assessment["risk_score"], 2),
                "riskFactors": {
                    "asset_coverage": round(risk_assessment["factors"]["asset_coverage"], 2),
                    "time_pressure": round(risk_assessment["factors"]["time_pressure"], 2),
                    "age_factor": round(risk_assessment["factors"]["age_factor"], 2),
                    "income_stability": round(risk_assessment["factors"]["income_stability"], 2)
                }
            }
        
        print(f"推荐结果: 主要推荐={recommended_risk}, 三种方案已生成")
        
        return {
            "success": True,
            "recommendedRisk": recommended_risk,  # 主要推荐的风险等级
            "recommendations": recommendations,  # 三种风险等级的完整推荐
            "message": "推荐成功（金融模型计算，返回三种方案）"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"推荐失败错误详情: {error_detail}")
        raise HTTPException(status_code=500, detail=f"推荐失败: {str(e)}")

@app.post("/api/story/generate", response_model=StoryResponse)
async def generate_story(request: StoryRequest):
    """
    生成财务故事（使用AI模型）
    
    接收用户的目标、资产、收入和选择的路径，使用AI模型生成个性化的财务故事
    如果AI调用失败，会自动回退到本地生成
    """
    try:
        # 计算目标金额（简化计算）
        target_amount = request.currentAsset + request.selectedPath.monthlySave * request.selectedPath.targetMonths * (1 + request.selectedPath.expectedReturn / 100 / 12)
        
        # 准备数据
        financial_data_dict = {
            "goal": request.goal,
            "currentAsset": request.currentAsset,
            "monthlyIncome": request.monthlyIncome
        }
        
        selected_path_dict = {
            "name": request.selectedPath.name,
            "monthlySave": request.selectedPath.monthlySave,
            "expectedReturn": request.selectedPath.expectedReturn,
            "targetMonths": request.selectedPath.targetMonths,
            "riskLevel": request.selectedPath.riskLevel
        }
        
        # 使用本地生成（流式接口使用AI）
        goal_type = determine_goal_type(request.goal)
        financial_data = FinancialData(
            goal=request.goal,
            currentAsset=request.currentAsset,
            monthlyIncome=request.monthlyIncome
        )
        
        chapters = [
            generate_chapter1(financial_data, target_amount, goal_type),
            generate_chapter2(request.selectedPath, goal_type),
            generate_chapter3(request.selectedPath, request.selectedPath.targetMonths, goal_type),
            generate_chapter4(financial_data, request.selectedPath, target_amount, goal_type),
            generate_chapter5(goal_type),
        ]
        
        return StoryResponse(
            success=True,
            chapters=chapters,
            message="故事生成成功"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成故事失败: {str(e)}")


@app.post("/api/tts/generate")
async def generate_tts(request: Dict[str, Any]):
    """
    生成语音（TTS）
    
    使用通义千问3-TTS-Flash-Realtime模型
    支持多种音色和方言
    """
    try:
        text = request.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="文本内容不能为空")
        
        if not dashscope_tts_service or not dashscope_tts_service.available:
            raise HTTPException(status_code=503, detail="TTS服务不可用，请检查配置")
        
        # 获取音色参数，默认为 Cherry（芊悦）
        voice = request.get("voice", "Cherry")
        
        # 生成语音文件
        import tempfile
        import time
        from pathlib import Path
        
        temp_dir = Path(tempfile.gettempdir())
        output_path = temp_dir / f"tts_{int(time.time())}.pcm"
        
        file_path = dashscope_tts_service.generate_speech_to_file(
            text=text,
            output_path=str(output_path),
            voice=voice
        )
        
        if not file_path:
            raise HTTPException(status_code=500, detail="语音生成失败，请检查TTS服务配置")
        
        # 读取文件并转换为base64
        with open(file_path, 'rb') as f:
            audio_data = f.read()
        
        import base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        # 返回音频数据（base64编码）
        return {
            "success": True,
            "audio_data": audio_base64,
            "format": "pcm",
            "sample_rate": 24000,
            "channels": 1,
            "bits_per_sample": 16,
            "voice": voice
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        error_msg = str(e)
        print(f"TTS生成失败错误详情: {error_detail}")
        
        # 检查是否是账户权限错误
        if "账户权限" in error_msg or "Access denied" in error_msg or "account" in error_msg.lower():
            raise HTTPException(
                status_code=403,
                detail="TTS服务账户权限错误。请检查：1) API Key是否正确 2) 账户余额是否充足 3) 账户状态是否正常 4) 是否开通了TTS服务权限"
            )
        elif "quota" in error_msg.lower() or "limit" in error_msg.lower() or "配额" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="TTS服务配额不足，请检查账户余额或配额限制"
            )
        else:
            raise HTTPException(status_code=500, detail=f"TTS生成失败: {error_msg}")


@app.post("/api/chat")
async def chat(request: Dict[str, Any]):
    """
    文字对话接口（流式输出）
    使用DeepSeek生成回复，结合推荐的理财产品进行推销
    """
    try:
        message = request.get("message", "")
        if not message:
            raise HTTPException(status_code=400, detail="消息内容不能为空")
        
        # 获取推荐的理财产品信息（如果有）
        recommendation_info = request.get("recommendation", None)
        
        # 构建系统提示词
        system_prompt = """你是一个专业的理财顾问AI助手，擅长用通俗易懂的语言回答用户的理财问题。

重要要求：
1. 回复必须控制在300字以内
2. 使用简单的段落式表达，不要使用markdown格式（不要用**、#、-等符号）
3. 用温暖、专业、易懂的方式回答，避免过于专业的术语
4. 多用比喻和例子，让回答更生动
5. 如果问题比较复杂，选择最重要的2-3个点回答即可
6. 如果用户询问理财建议，要结合我们推荐的理财产品来回答，自然地推荐我们的产品
7. 强调产品的优势和适合性，但不要过于推销，要真诚、专业"""
        
        # 如果有推荐信息，添加到系统提示词中
        if recommendation_info:
            rec = recommendation_info
            risk_name = {"low": "稳健型", "medium": "平衡型", "high": "激进型"}.get(rec.get("riskLevel", "medium"), "平衡型")
            system_prompt += f"""

【推荐的理财产品信息】
- 方案类型：{risk_name}
- 预期年化收益率：{rec.get("expectedReturn", 0)}%
- 每月建议储蓄：{rec.get("monthlySave", 0):,.0f}元
- 预计达成时间：{rec.get("targetMonths", 0)}个月
- 风险等级：{rec.get("riskLevel", "medium")}

在回答用户问题时，要自然地结合这个推荐方案，说明为什么这个方案适合用户，强调其优势和特点。"""
        
        # 构建消息列表
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        # 流式生成回复
        async def generate():
            full_response = ""
            async for chunk in ai_service.call_deepseek_stream(messages, temperature=0.7):
                full_response += chunk
                # 清理markdown格式
                cleaned_chunk = chunk
                cleaned_chunk = cleaned_chunk.replace("**", "").replace("*", "")
                # 发送流式数据
                yield f"data: {json.dumps({'type': 'chunk', 'content': cleaned_chunk}, ensure_ascii=False)}\n\n"
            
            # 清理完整回复
            import re
            cleaned_response = full_response.strip()
            # 移除markdown格式
            cleaned_response = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned_response)
            cleaned_response = re.sub(r'\*(.*?)\*', r'\1', cleaned_response)
            cleaned_response = re.sub(r'^#+\s*', '', cleaned_response, flags=re.MULTILINE)
            cleaned_response = re.sub(r'^-\s*', '', cleaned_response, flags=re.MULTILINE)
            cleaned_response = re.sub(r'^\d+\.\s*', '', cleaned_response, flags=re.MULTILINE)
            cleaned_response = re.sub(r'\n{3,}', '\n\n', cleaned_response)
            
            # 限制在300字以内
            if len(cleaned_response) > 300:
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
            
            # 发送完成事件
            yield f"data: {json.dumps({'type': 'complete', 'content': cleaned_response}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    except Exception as e:
        print(f"生成回复失败: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"生成回复失败: {str(e)}")


@app.get("/api/tts/voices")
async def get_tts_voices():
    """
    获取支持的音色列表
    """
    try:
        if get_supported_voices is None:
            raise HTTPException(status_code=503, detail="TTS服务不可用，请检查配置")
        
        voices = get_supported_voices()
        return {
            "success": True,
            "voices": voices
        }
    except Exception as e:
        print(f"获取音色列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取音色列表失败: {str(e)}")


@app.websocket("/api/voice-chat")
async def voice_chat(websocket: WebSocket):
    """
    语音对话 WebSocket 端点
    支持实时语音识别和语音合成
    """
    await websocket.accept()
    
    try:
        # 接收初始配置（音色）
        config = await websocket.receive_json()
        voice = config.get("voice", "Cherry")
        print(f"语音对话开始，使用音色: {voice}")
        
        # 创建语音识别实例
        recognition = None
        current_sentence = ""
        
        def on_text(text: str):
            """实时文本回调"""
            nonlocal current_sentence
            current_sentence = text
        
        def on_sentence_end(text: str):
            """句子结束回调"""
            nonlocal current_sentence
            print(f"识别到完整句子: {text}")
            # 发送识别结果给前端
            import asyncio
            asyncio.create_task(websocket.send_json({
                "type": "text",
                "text": text,
                "isUser": True
            }))
            current_sentence = ""
        
        if dashscope_asr_service and dashscope_asr_service.available:
            recognition = dashscope_asr_service.create_recognition(
                on_text=on_text,
                on_sentence_end=on_sentence_end
            )
            if recognition:
                recognition.start()
                print("ASR识别已启动")
        
        # 发送就绪消息
        await websocket.send_json({"type": "ready"})
        
        # 处理音频数据和消息
        while True:
            try:
                data = await websocket.receive()
                
                if "bytes" in data:
                    # 接收音频数据（PCM格式，16kHz，16bit，单声道）
                    audio_bytes = data["bytes"]
                    if recognition:
                        recognition.send_audio_frame(audio_bytes)
                
                elif "text" in data:
                    # 接收文本消息
                    message = json.loads(data["text"])
                    msg_type = message.get("type")
                    
                    if msg_type == "text":
                        # 用户发送文本消息（用于测试或手动输入）
                        user_text = message.get("text", "")
                        if user_text:
                            # 调用AI服务生成回复
                            try:
                                ai_response = await ai_service.generate_response(user_text)
                                # 生成语音
                                if dashscope_tts_service and dashscope_tts_service.available:
                                    audio_data = dashscope_tts_service.generate_speech(
                                        text=ai_response,
                                        voice=voice
                                    )
                                    if audio_data:
                                        import base64
                                        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                                        await websocket.send_json({
                                            "type": "audio",
                                            "audio": audio_base64,
                                            "text": ai_response
                                        })
                                    else:
                                        await websocket.send_json({
                                            "type": "text",
                                            "text": ai_response
                                        })
                                else:
                                    await websocket.send_json({
                                        "type": "text",
                                        "text": ai_response
                                    })
                            except Exception as e:
                                print(f"AI回复生成失败: {e}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"生成回复失败: {str(e)}"
                                })
                    
                    elif msg_type == "sentence":
                        # 识别到的完整句子
                        sentence = message.get("text", "")
                        if sentence:
                            # 调用AI服务生成回复
                            try:
                                ai_response = await ai_service.generate_response(sentence)
                                # 生成语音
                                if dashscope_tts_service and dashscope_tts_service.available:
                                    audio_data = dashscope_tts_service.generate_speech(
                                        text=ai_response,
                                        voice=voice
                                    )
                                    if audio_data:
                                        import base64
                                        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                                        await websocket.send_json({
                                            "type": "audio",
                                            "audio": audio_base64,
                                            "text": ai_response
                                        })
                                    else:
                                        await websocket.send_json({
                                            "type": "text",
                                            "text": ai_response
                                        })
                                else:
                                    await websocket.send_json({
                                        "type": "text",
                                        "text": ai_response
                                    })
                            except Exception as e:
                                print(f"AI回复生成失败: {e}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"生成回复失败: {str(e)}"
                                })
                    
                    elif msg_type == "stop":
                        # 停止识别
                        if recognition:
                            recognition.stop()
                        break
                
            except WebSocketDisconnect:
                print("WebSocket连接断开")
                break
            except Exception as e:
                print(f"处理消息错误: {e}")
                import traceback
                print(traceback.format_exc())
                await websocket.send_json({
                    "type": "error",
                    "message": f"处理错误: {str(e)}"
                })
    
    except Exception as e:
        print(f"语音对话错误: {e}")
        import traceback
        print(traceback.format_exc())
    finally:
        # 清理资源
        if recognition:
            try:
                recognition.stop()
            except:
                pass
        try:
            await websocket.close()
        except:
            pass


async def _generate_chapter_images_with_updates(
    chapters: List[Dict], 
    request: StoryRequest = None, 
    selected_path_dict: Dict = None
):
    """
    为章节生成图片（带进度更新，通过SSE发送）
    
    支持缓存：如果图片已缓存，直接使用缓存；否则生成并保存缓存
    """
    if not dashscope_image_service or not dashscope_image_service.available:
        return
    
    import asyncio
    import re
    
    # 极速版接口虽然支持并发，但建议串行处理以避免限流
    for i, chapter in enumerate(chapters):
        try:
            # 检查图片缓存
            cached_image = None
            if cache_service and request and selected_path_dict:
                cached_image = cache_service.check_image_cache(
                    request.goal,
                    request.currentAsset,
                    request.monthlyIncome,
                    selected_path_dict,
                    i
                )
            
            if cached_image:
                # 使用缓存的图片
                print(f"✓ 使用缓存的图片: 章节 {i+1}")
                chapter["image"] = cached_image
                yield {
                    "type": "image_complete",
                    "chapterIndex": i,
                    "imageUrl": cached_image,
                    "from_cache": True
                }
                continue  # 跳过生成，继续下一个章节
            # 从章节标题和内容生成图片描述
            title = chapter.get("title", "")
            content = chapter.get("content", "")
            
            # 构建图片描述prompt（去掉章节编号）
            title_clean = title.split(":")[-1].strip() if ":" in title else title
            
            # 提取内容中的关键信息，构建更详细的prompt
            # 1. 提取场景关键词
            scene_keywords = []
            if "家" in content or "房子" in content or "房产" in content or "出租屋" in content:
                scene_keywords.append("温馨的家庭场景")
            if "咖啡" in content or "咖啡厅" in content or "咖啡店" in content:
                scene_keywords.append("现代咖啡厅")
            if "办公室" in content or "职场" in content or "工作" in content:
                scene_keywords.append("现代职场环境")
            if "旅行" in content or "旅游" in content or "度假" in content:
                scene_keywords.append("美丽的旅行场景")
            if "银行" in content or "理财" in content or "投资" in content or "资产" in content:
                scene_keywords.append("金融理财场景")
            if "城市" in content or "夜景" in content or "落地窗" in content:
                scene_keywords.append("城市夜景")
            if "手机" in content or "银行app" in content or "账户" in content:
                scene_keywords.append("查看手机理财应用")
            
            # 2. 提取情感和氛围关键词
            emotion_keywords = []
            if any(word in content for word in ["开心", "快乐", "兴奋", "满足", "希望", "期待"]):
                emotion_keywords.append("温暖、积极、充满希望")
            if any(word in content for word in ["困难", "挑战", "压力", "坚持", "努力"]):
                emotion_keywords.append("坚韧、努力、克服困难")
            if any(word in content for word in ["成功", "达成", "实现", "完成", "成就"]):
                emotion_keywords.append("成功、喜悦、成就感")
            if any(word in content for word in ["思考", "选择", "决定", "规划", "计划"]):
                emotion_keywords.append("深思、决策、关键时刻")
            if any(word in content for word in ["开始", "改变", "第一步", "旅程"]):
                emotion_keywords.append("新的开始、充满希望")
            
            # 3. 提取物品和符号关键词（替代人物）
            object_keywords = []
            if "手机" in content or "银行app" in content or "账户" in content:
                object_keywords.append("手机屏幕显示理财应用")
            if "咖啡" in content or "咖啡厅" in content:
                object_keywords.append("咖啡杯、笔记本")
            if "房子" in content or "房产" in content:
                object_keywords.append("房屋建筑、钥匙")
            if "旅行" in content or "旅游" in content:
                object_keywords.append("行李箱、地图、风景")
            if "投资" in content or "理财" in content:
                object_keywords.append("图表、计算器、硬币")
            if "目标" in content or "梦想" in content:
                object_keywords.append("目标图标、星星、箭头")
            if "时间" in content or "未来" in content:
                object_keywords.append("时钟、日历、时间线")
            
            # 4. 提取章节核心主题（从标题和内容开头提取）
            title_core = title_clean.replace("第", "").replace("章", "").replace("：", "").replace(":", "").strip()
            
            # 5. 提取内容的关键句子（前2-3个完整句子，包含更多信息）
            sentences = content.split("。")[:3]  # 取前3个完整句子
            key_sentences = [s.strip() for s in sentences if len(s.strip()) > 15]
            
            # 6. 构建详细的prompt（不包含人物）
            prompt_parts = []
            
            # 优先添加场景描述
            if scene_keywords:
                prompt_parts.append("，".join(scene_keywords[:2]))  # 最多2个场景
            
            # 添加物品和符号（替代人物）
            if object_keywords:
                prompt_parts.append("，".join(object_keywords[:2]))  # 最多2个物品
            
            # 添加章节核心主题
            if title_core:
                prompt_parts.append(title_core)
            
            # 添加关键内容摘要（提取核心信息，去掉过多细节和人物描述）
            if key_sentences:
                # 合并关键句子，提取核心信息
                content_summary = "。".join(key_sentences)
                # 去掉人物相关的描述
                content_summary = re.sub(r'你[坐站看打开思考]', '', content_summary)
                content_summary = re.sub(r'人物|人|肖像', '', content_summary)
                # 去掉过多的数字和具体金额，保留场景和情感
                content_summary = re.sub(r'\d+[万千]?元', '一定金额', content_summary)
                content_summary = re.sub(r'\d+\.\d+', '', content_summary)
                # 限制长度
                if len(content_summary) > 100:
                    content_summary = content_summary[:100] + "..."
                if content_summary.strip():
                    prompt_parts.append(content_summary)
            
            # 添加情感氛围
            if emotion_keywords:
                prompt_parts.append(emotion_keywords[0])  # 只取第一个
            
            # 组合prompt
            image_prompt = "，".join(prompt_parts)
            
            # 添加风格和质量要求（明确不要人物）
            image_prompt += "，高质量插画风格，细节丰富，色彩温暖，专业摄影，构图精美，无人物，场景为主，物品和符号"
            
            # 限制总长度（腾讯云API限制1024字符，但建议不超过800）
            if len(image_prompt) > 800:
                # 如果太长，优先保留前面的关键部分
                image_prompt = image_prompt[:800]
            
            print(f"开始为章节 {i+1} 生成图片: {title_clean}")
            print(f"图片生成prompt: {image_prompt[:150]}...")
            
            # 通知前端开始生成图片
            yield {
                "type": "image_generating",
                "chapterIndex": i,
                "chapterTitle": title_clean
            }
            
            # 使用极速版接口，直接返回图片URL（同步接口）
            # 如果失败，重试最多3次
            max_retries = 3
            image_url = None
            
            for retry in range(max_retries):
                try:
                    image_url = dashscope_image_service.generate_image(
                        prompt=image_prompt,
                        resolution="1024:1024",
                        rsp_img_type="url"  # 返回URL，有效期1小时
                    )
                    if image_url:
                        break
                except Exception as e:
                    error_str = str(e)
                    # 如果是资源不足或配额错误，直接放弃，不再重试
                    if ("ResourceInsufficient" in error_str or "资源不足" in error_str or 
                        "quota" in error_str.lower() or "insufficient" in error_str.lower() or
                        "配额" in error_str or "额度" in error_str):
                        print(f"图片生成服务资源不足，跳过图片生成: {error_str}")
                        break  # 直接跳出重试循环
                    elif ("RequestLimitExceeded" in error_str or "RateLimit" in error_str or
                          "rate" in error_str.lower() or "限流" in error_str or "限频" in error_str):
                        # 达到限流，等待后重试
                        wait_time = (retry + 1) * 2  # 等待2秒、4秒、6秒
                        print(f"达到限流，等待 {wait_time} 秒后重试...")
                        await asyncio.sleep(wait_time)
                    else:
                        print(f"生成图片失败: {e}")
                        if retry < max_retries - 1:
                            await asyncio.sleep(1)  # 短暂等待后重试
            
            if image_url:
                chapter["image"] = image_url
                print(f"章节 {i+1} 图片生成成功: {image_url}")
                
                # 保存图片到缓存
                if cache_service and request and selected_path_dict:
                    cache_service.save_image_to_cache(
                        request.goal,
                        request.currentAsset,
                        request.monthlyIncome,
                        selected_path_dict,
                        i,
                        image_url
                    )
                
                # 通知前端图片生成完成
                yield {
                    "type": "image_complete",
                    "chapterIndex": i,
                    "imageUrl": image_url
                }
            else:
                print(f"章节 {i+1} 图片生成失败（已重试 {max_retries} 次）")
                
                # 通知前端图片生成失败
                yield {
                    "type": "image_failed",
                    "chapterIndex": i
                }
                
        except Exception as e:
            print(f"为章节 {i+1} 生成图片失败: {e}")
            import traceback
            print(f"详细错误: {traceback.format_exc()}")
            
            # 通知前端图片生成失败
            yield {
                "type": "image_failed",
                "chapterIndex": i
            }


async def _generate_chapter_images_async(chapters: List[Dict], image_update_callback=None):
    """为章节生成图片（后台任务，使用极速版接口）"""
    if not dashscope_image_service or not dashscope_image_service.available:
        return
    
    import asyncio
    import re
    
    # 极速版接口虽然支持并发，但建议串行处理以避免限流
    for i, chapter in enumerate(chapters):
        try:
            # 从章节标题和内容生成图片描述
            title = chapter.get("title", "")
            content = chapter.get("content", "")
            
            # 构建图片描述prompt（去掉章节编号）
            title_clean = title.split(":")[-1].strip() if ":" in title else title
            
            # 提取内容中的关键信息，构建更详细的prompt
            # 1. 提取场景关键词
            scene_keywords = []
            if "家" in content or "房子" in content or "房产" in content or "出租屋" in content:
                scene_keywords.append("温馨的家庭场景")
            if "咖啡" in content or "咖啡厅" in content or "咖啡店" in content:
                scene_keywords.append("现代咖啡厅")
            if "办公室" in content or "职场" in content or "工作" in content:
                scene_keywords.append("现代职场环境")
            if "旅行" in content or "旅游" in content or "度假" in content:
                scene_keywords.append("美丽的旅行场景")
            if "银行" in content or "理财" in content or "投资" in content or "资产" in content:
                scene_keywords.append("金融理财场景")
            if "城市" in content or "夜景" in content or "落地窗" in content:
                scene_keywords.append("城市夜景")
            if "手机" in content or "银行app" in content or "账户" in content:
                scene_keywords.append("查看手机理财应用")
            
            # 2. 提取情感和氛围关键词
            emotion_keywords = []
            if any(word in content for word in ["开心", "快乐", "兴奋", "满足", "希望", "期待"]):
                emotion_keywords.append("温暖、积极、充满希望")
            if any(word in content for word in ["困难", "挑战", "压力", "坚持", "努力"]):
                emotion_keywords.append("坚韧、努力、克服困难")
            if any(word in content for word in ["成功", "达成", "实现", "完成", "成就"]):
                emotion_keywords.append("成功、喜悦、成就感")
            if any(word in content for word in ["思考", "选择", "决定", "规划", "计划"]):
                emotion_keywords.append("深思、决策、关键时刻")
            if any(word in content for word in ["开始", "改变", "第一步", "旅程"]):
                emotion_keywords.append("新的开始、充满希望")
            
            # 3. 提取物品和符号关键词（替代人物）
            object_keywords = []
            if "手机" in content or "银行app" in content or "账户" in content:
                object_keywords.append("手机屏幕显示理财应用")
            if "咖啡" in content or "咖啡厅" in content:
                object_keywords.append("咖啡杯、笔记本")
            if "房子" in content or "房产" in content:
                object_keywords.append("房屋建筑、钥匙")
            if "旅行" in content or "旅游" in content:
                object_keywords.append("行李箱、地图、风景")
            if "投资" in content or "理财" in content:
                object_keywords.append("图表、计算器、硬币")
            if "目标" in content or "梦想" in content:
                object_keywords.append("目标图标、星星、箭头")
            if "时间" in content or "未来" in content:
                object_keywords.append("时钟、日历、时间线")
            
            # 4. 提取章节核心主题（从标题和内容开头提取）
            title_core = title_clean.replace("第", "").replace("章", "").replace("：", "").replace(":", "").strip()
            
            # 5. 提取内容的关键句子（前2-3个完整句子，包含更多信息）
            sentences = content.split("。")[:3]  # 取前3个完整句子
            key_sentences = [s.strip() for s in sentences if len(s.strip()) > 15]
            
            # 6. 构建详细的prompt（不包含人物）
            prompt_parts = []
            
            # 优先添加场景描述
            if scene_keywords:
                prompt_parts.append("，".join(scene_keywords[:2]))  # 最多2个场景
            
            # 添加物品和符号（替代人物）
            if object_keywords:
                prompt_parts.append("，".join(object_keywords[:2]))  # 最多2个物品
            
            # 添加章节核心主题
            if title_core:
                prompt_parts.append(title_core)
            
            # 添加关键内容摘要（提取核心信息，去掉过多细节和人物描述）
            if key_sentences:
                # 合并关键句子，提取核心信息
                content_summary = "。".join(key_sentences)
                # 去掉人物相关的描述
                content_summary = re.sub(r'你[坐站看打开思考]', '', content_summary)
                content_summary = re.sub(r'人物|人|肖像', '', content_summary)
                # 去掉过多的数字和具体金额，保留场景和情感
                content_summary = re.sub(r'\d+[万千]?元', '一定金额', content_summary)
                content_summary = re.sub(r'\d+\.\d+', '', content_summary)
                # 限制长度
                if len(content_summary) > 100:
                    content_summary = content_summary[:100] + "..."
                if content_summary.strip():
                    prompt_parts.append(content_summary)
            
            # 添加情感氛围
            if emotion_keywords:
                prompt_parts.append(emotion_keywords[0])  # 只取第一个
            
            # 组合prompt
            image_prompt = "，".join(prompt_parts)
            
            # 添加风格和质量要求（明确不要人物）
            image_prompt += "，高质量插画风格，细节丰富，色彩温暖，专业摄影，构图精美，无人物，场景为主，物品和符号"
            
            # 限制总长度（腾讯云API限制1024字符，但建议不超过800）
            if len(image_prompt) > 800:
                # 如果太长，优先保留前面的关键部分
                image_prompt = image_prompt[:800]
            
            print(f"开始为章节 {i+1} 生成图片: {title_clean}")
            print(f"图片生成prompt: {image_prompt[:150]}...")
            
            # 通知前端开始生成图片
            if image_update_callback:
                await image_update_callback({
                    "type": "image_generating",
                    "chapterIndex": i,
                    "chapterTitle": title_clean
                })
            
            # 使用极速版接口，直接返回图片URL（同步接口）
            # 如果失败，重试最多3次
            max_retries = 3
            image_url = None
            
            for retry in range(max_retries):
                try:
                    image_url = dashscope_image_service.generate_image(
                        prompt=image_prompt,
                        resolution="1024:1024",
                        rsp_img_type="url"  # 返回URL，有效期1小时
                    )
                    if image_url:
                        break
                except Exception as e:
                    error_str = str(e)
                    # 如果是资源不足或配额错误，直接放弃，不再重试
                    if ("ResourceInsufficient" in error_str or "资源不足" in error_str or 
                        "quota" in error_str.lower() or "insufficient" in error_str.lower() or
                        "配额" in error_str or "额度" in error_str):
                        print(f"图片生成服务资源不足，跳过图片生成: {error_str}")
                        break  # 直接跳出重试循环
                    elif ("RequestLimitExceeded" in error_str or "RateLimit" in error_str or
                          "rate" in error_str.lower() or "限流" in error_str or "限频" in error_str):
                        # 达到限流，等待后重试
                        wait_time = (retry + 1) * 2  # 等待2秒、4秒、6秒
                        print(f"达到限流，等待 {wait_time} 秒后重试...")
                        await asyncio.sleep(wait_time)
                    else:
                        print(f"生成图片失败: {e}")
                        if retry < max_retries - 1:
                            await asyncio.sleep(1)  # 短暂等待后重试
            
            if image_url:
                chapter["image"] = image_url
                print(f"章节 {i+1} 图片生成成功: {image_url}")
                
                # 通知前端图片生成完成
                if image_update_callback:
                    await image_update_callback({
                        "type": "image_complete",
                        "chapterIndex": i,
                        "imageUrl": image_url
                    })
            else:
                print(f"章节 {i+1} 图片生成失败（已重试 {max_retries} 次）")
                
                # 通知前端图片生成失败
                if image_update_callback:
                    await image_update_callback({
                        "type": "image_failed",
                        "chapterIndex": i
                    })
                
        except Exception as e:
            print(f"为章节 {i+1} 生成图片失败: {e}")
            import traceback
            print(f"详细错误: {traceback.format_exc()}")
            
            # 通知前端图片生成失败
            if image_update_callback:
                await image_update_callback({
                    "type": "image_failed",
                    "chapterIndex": i
                })


@app.post("/api/story/generate-stream")
async def generate_story_stream(request: StoryRequest):
    """
    流式生成财务故事（使用AI模型）
    
    使用Server-Sent Events (SSE) 流式返回AI生成的故事内容
    前端可以实时看到生成过程，体验更好
    """
    async def generate():
        try:
            # 准备数据
            financial_data_dict = {
                "goal": request.goal,
                "currentAsset": request.currentAsset,
                "monthlyIncome": request.monthlyIncome
            }
            
            selected_path_dict = {
                "name": request.selectedPath.name,
                "monthlySave": request.selectedPath.monthlySave,
                "expectedReturn": request.selectedPath.expectedReturn,
                "targetMonths": request.selectedPath.targetMonths,
                "riskLevel": request.selectedPath.riskLevel
            }
            
            # 检查缓存
            cached_story = None
            if cache_service:
                cached_story = cache_service.check_story_cache(
                    request.goal,
                    request.currentAsset,
                    request.monthlyIncome,
                    selected_path_dict
                )
            
            if cached_story:
                # 使用缓存的故事
                print("✓ 使用缓存的故事")
                chapters = cached_story.get("chapters", [])
                
                # 发送开始信号
                yield f"data: {json.dumps({'type': 'start', 'message': '从缓存加载故事...'})}\n\n"
                
                # 模拟流式输出（快速返回完整内容）
                yield f"data: {json.dumps({'type': 'complete', 'chapters': chapters, 'from_cache': True}, ensure_ascii=False)}\n\n"
                
                # 检查图片缓存并生成图片更新事件
                if dashscope_image_service and dashscope_image_service.available:
                    for i, chapter in enumerate(chapters):
                        # 检查图片缓存
                        cached_image = None
                        if cache_service:
                            cached_image = cache_service.check_image_cache(
                                request.goal,
                                request.currentAsset,
                                request.monthlyIncome,
                                selected_path_dict,
                                i
                            )
                        
                        if cached_image:
                            # 使用缓存的图片
                            yield f"data: {json.dumps({
                                'type': 'image_complete',
                                'chapterIndex': i,
                                'imageUrl': cached_image,
                                'from_cache': True
                            }, ensure_ascii=False)}\n\n"
                        else:
                            # 图片未缓存，需要生成图片
                            # 使用完整的图片生成逻辑（复用现有的图片生成代码）
                            # 创建一个只包含当前章节的列表
                            single_chapter_list = [chapter]
                            async for update in _generate_chapter_images_with_updates(
                                single_chapter_list,
                                request,
                                selected_path_dict
                            ):
                                # 更新章节索引为原始索引
                                if "chapterIndex" in update:
                                    update["chapterIndex"] = i
                                yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                
                return  # 缓存命中，直接返回
            
            # 缓存未命中，生成新故事
            # 计算目标金额
            target_amount = request.currentAsset + request.selectedPath.monthlySave * request.selectedPath.targetMonths * (1 + request.selectedPath.expectedReturn / 100 / 12)
            
            # 构建Prompt
            system_prompt = """你是一个专业的财务故事讲述者。你的任务是生成真实、温暖、有代入感的财务规划故事。
请严格按照用户要求的JSON格式输出，确保JSON格式完全正确，可以被直接解析。"""
            
            user_prompt = ai_service.build_story_prompt(financial_data_dict, selected_path_dict, target_amount)
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # 发送开始信号
            yield f"data: {json.dumps({'type': 'start', 'message': '开始生成故事...'})}\n\n"
            
            # 流式调用DeepSeek
            full_response = ""
            async for chunk in ai_service.call_deepseek_stream(messages, temperature=0.8):
                full_response += chunk
                # 实时发送每个chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            
            # 尝试解析JSON
            try:
                # 提取JSON部分 - 更智能的提取逻辑
                json_str = full_response.strip()
                
                # 方法1: 查找 ```json 代码块
                if "```json" in json_str:
                    json_start = json_str.find("```json") + 7
                    json_end = json_str.find("```", json_start)
                    if json_end > json_start:
                        json_str = json_str[json_start:json_end].strip()
                
                # 方法2: 查找 ``` 代码块（没有json标记）
                elif "```" in json_str and json_str.count("```") >= 2:
                    json_start = json_str.find("```") + 3
                    json_end = json_str.find("```", json_start)
                    if json_end > json_start:
                        json_str = json_str[json_start:json_end].strip()
                
                # 方法3: 查找第一个 { 到最后一个 }
                elif "{" in json_str and "}" in json_str:
                    first_brace = json_str.find("{")
                    last_brace = json_str.rfind("}")
                    if last_brace > first_brace:
                        json_str = json_str[first_brace:last_brace + 1].strip()
                
                # 清理可能的markdown标记
                json_str = json_str.lstrip("```json").lstrip("```").rstrip("```").strip()
                
                # 尝试解析JSON
                story_data = json.loads(json_str)
                
                # 验证数据结构
                if not isinstance(story_data, dict) or "chapters" not in story_data:
                    raise ValueError("JSON格式不正确：缺少chapters字段")
                
                chapters = story_data.get("chapters", [])
                if not isinstance(chapters, list) or len(chapters) == 0:
                    raise ValueError("JSON格式不正确：chapters为空或不是数组")
                
                # 修正第3章的时间节点（使用当前时间）
                if len(chapters) >= 3:
                    chapter3 = chapters[2]
                    if isinstance(chapter3, dict) and chapter3.get("title", "").startswith("第3章"):
                        current_date = datetime.now()
                        target_months = request.selectedPath.targetMonths
                        midpoint = target_months // 2
                        
                        # 重新计算时间节点
                        timeline = [
                            {"date": format_date(current_date), "event": "开始执行财务计划"},
                            {"date": format_date(add_months(current_date, target_months // 4)), "event": "第一个季度，养成储蓄习惯"},
                            {"date": format_date(add_months(current_date, midpoint)), "event": "完成一半进度，资产稳步增长"},
                            {"date": format_date(add_months(current_date, target_months * 3 // 4)), "event": "进入冲刺阶段，目标越来越近"}
                        ]
                        chapter3["timeline"] = timeline
                        chapters[2] = chapter3
                
                # 发送完整的故事数据
                yield f"data: {json.dumps({'type': 'complete', 'chapters': chapters}, ensure_ascii=False)}\n\n"
                
                # 保存故事到缓存
                if cache_service:
                    cache_service.save_story_to_cache(
                        request.goal,
                        request.currentAsset,
                        request.monthlyIncome,
                        selected_path_dict,
                        chapters
                    )
                
                # 为每个章节生成图片（异步，不阻塞，通过SSE实时更新）
                if dashscope_image_service and dashscope_image_service.available:
                    # 在后台任务中生成图片并发送更新
                    async for update in _generate_chapter_images_with_updates(chapters, request, selected_path_dict):
                        yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                
            except json.JSONDecodeError as e:
                # JSON解析失败，尝试修复和提取
                error_msg = f"JSON解析失败: {str(e)}"
                print(f"JSON解析错误: {error_msg}")
                print(f"原始响应前500字符: {full_response[:500]}")
                
                # 方法1: 尝试修复不完整的JSON
                try:
                    # 查找chapters数组的开始
                    chapters_start = full_response.find('"chapters"')
                    if chapters_start > 0:
                        # 找到chapters数组的 [
                        array_start = full_response.find('[', chapters_start)
                        if array_start > 0:
                            # 尝试提取所有chapter对象
                            chapters = []
                            # 使用更灵活的方法：逐字符解析
                            remaining_text = full_response[array_start:]
                            
                            # 查找所有 "title" 的位置
                            title_positions = []
                            pos = 0
                            while True:
                                pos = remaining_text.find('"title"', pos)
                                if pos == -1:
                                    break
                                title_positions.append(pos)
                                pos += 7
                            
                            # 对每个title位置，尝试提取完整的chapter
                            for i, title_pos in enumerate(title_positions):
                                try:
                                    # 找到title的值
                                    title_start = remaining_text.find('"', title_pos + 7) + 1
                                    if title_start == 0:
                                        continue
                                    
                                    # 找到title的结束引号（考虑转义）
                                    title_end = title_start
                                    while title_end < len(remaining_text):
                                        if remaining_text[title_end] == '"' and remaining_text[title_end - 1] != '\\':
                                            break
                                        title_end += 1
                                    
                                    title = remaining_text[title_start:title_end].replace('\\"', '"').replace('\\n', '\n')
                                    
                                    # 找到content字段
                                    content_pos = remaining_text.find('"content"', title_end)
                                    if content_pos == -1:
                                        continue
                                    
                                    # 找到content的值
                                    content_start = remaining_text.find('"', content_pos + 9) + 1
                                    if content_start == 0:
                                        continue
                                    
                                    # 找到content的结束（可能是下一个chapter或结束）
                                    next_title_pos = len(remaining_text)
                                    if i + 1 < len(title_positions):
                                        next_title_pos = title_positions[i + 1]
                                    
                                    # 提取content（到下一个title之前，或到结束）
                                    content_end = content_start
                                    max_content_end = min(next_title_pos - 50, len(remaining_text))  # 留一些空间
                                    
                                    # 尝试找到content的结束引号
                                    quote_end = remaining_text.find('"', content_start)
                                    while quote_end < max_content_end:
                                        if remaining_text[quote_end - 1] != '\\':
                                            # 检查后面是否是逗号或}，确认是content的结束
                                            after_quote = remaining_text[quote_end + 1:quote_end + 10].strip()
                                            if after_quote.startswith(',') or after_quote.startswith('}'):
                                                content_end = quote_end
                                                break
                                        quote_end = remaining_text.find('"', quote_end + 1)
                                        if quote_end == -1:
                                            break
                                    
                                    # 如果没找到结束引号，使用下一个title之前的内容
                                    if content_end == content_start:
                                        content_end = min(next_title_pos - 20, len(remaining_text))
                                    
                                    content = remaining_text[content_start:content_end]
                                    # 清理转义字符和末尾的引号/逗号
                                    content = content.rstrip('"').rstrip(',').rstrip('}').rstrip()
                                    content = content.replace('\\"', '"').replace('\\n', '\n')
                                    
                                    if title and content:
                                        chapters.append({
                                            "title": title,
                                            "content": content
                                        })
                                except Exception as chapter_error:
                                    print(f"提取chapter {i+1}失败: {chapter_error}")
                                    continue
                            
                            if chapters:
                                print(f"成功提取 {len(chapters)} 个章节")
                                
                                # 修正第3章的时间节点（使用当前时间）
                                if len(chapters) >= 3:
                                    chapter3 = chapters[2]
                                    if isinstance(chapter3, dict) and chapter3.get("title", "").startswith("第3章"):
                                        current_date = datetime.now()
                                        target_months = request.selectedPath.targetMonths
                                        midpoint = target_months // 2
                                        
                                        # 重新计算时间节点
                                        timeline = [
                                            {"date": format_date(current_date), "event": "开始执行财务计划"},
                                            {"date": format_date(add_months(current_date, target_months // 4)), "event": "第一个季度，养成储蓄习惯"},
                                            {"date": format_date(add_months(current_date, midpoint)), "event": "完成一半进度，资产稳步增长"},
                                            {"date": format_date(add_months(current_date, target_months * 3 // 4)), "event": "进入冲刺阶段，目标越来越近"}
                                        ]
                                        chapter3["timeline"] = timeline
                                        chapters[2] = chapter3
                                
                                # 修正第3章的时间节点（使用当前时间）
                                if len(chapters) >= 3:
                                    chapter3 = chapters[2]
                                    if isinstance(chapter3, dict) and chapter3.get("title", "").startswith("第3章"):
                                        current_date = datetime.now()
                                        target_months = request.selectedPath.targetMonths
                                        midpoint = target_months // 2
                                        
                                        # 重新计算时间节点
                                        timeline = [
                                            {"date": format_date(current_date), "event": "开始执行财务计划"},
                                            {"date": format_date(add_months(current_date, target_months // 4)), "event": "第一个季度，养成储蓄习惯"},
                                            {"date": format_date(add_months(current_date, midpoint)), "event": "完成一半进度，资产稳步增长"},
                                            {"date": format_date(add_months(current_date, target_months * 3 // 4)), "event": "进入冲刺阶段，目标越来越近"}
                                        ]
                                        chapter3["timeline"] = timeline
                                        chapters[2] = chapter3
                                
                                yield f"data: {json.dumps({'type': 'complete', 'chapters': chapters}, ensure_ascii=False)}\n\n"
                                return
                except Exception as fix_error:
                    print(f"JSON修复失败: {fix_error}")
                
                # 方法2: 尝试找到第一个完整的JSON对象
                try:
                    if "{" in full_response and "}" in full_response:
                        first_brace = full_response.find("{")
                        # 从第一个 { 开始，尝试找到匹配的 }
                        brace_count = 0
                        last_brace = first_brace
                        for i in range(first_brace, len(full_response)):
                            if full_response[i] == "{":
                                brace_count += 1
                            elif full_response[i] == "}":
                                brace_count -= 1
                                if brace_count == 0:
                                    last_brace = i
                                    break
                        
                        if brace_count == 0:
                            json_str = full_response[first_brace:last_brace + 1]
                            story_data = json.loads(json_str)
                            chapters = story_data.get("chapters", [])
                            if chapters:
                                # 修正第3章的时间节点（使用当前时间）
                                if len(chapters) >= 3:
                                    chapter3 = chapters[2]
                                    if isinstance(chapter3, dict) and chapter3.get("title", "").startswith("第3章"):
                                        current_date = datetime.now()
                                        target_months = request.selectedPath.targetMonths
                                        midpoint = target_months // 2
                                        
                                        # 重新计算时间节点
                                        timeline = [
                                            {"date": format_date(current_date), "event": "开始执行财务计划"},
                                            {"date": format_date(add_months(current_date, target_months // 4)), "event": "第一个季度，养成储蓄习惯"},
                                            {"date": format_date(add_months(current_date, midpoint)), "event": "完成一半进度，资产稳步增长"},
                                            {"date": format_date(add_months(current_date, target_months * 3 // 4)), "event": "进入冲刺阶段，目标越来越近"}
                                        ]
                                        chapter3["timeline"] = timeline
                                        chapters[2] = chapter3
                                
                                yield f"data: {json.dumps({'type': 'complete', 'chapters': chapters}, ensure_ascii=False)}\n\n"
                                return
                except:
                    pass
                
                # 如果所有解析都失败，发送错误
                yield f"data: {json.dumps({'type': 'error', 'message': error_msg, 'raw': full_response[:1000]})}\n\n"
            
            except Exception as parse_error:
                error_msg = f"解析失败: {str(parse_error)}"
                print(f"解析错误: {error_msg}")
                yield f"data: {json.dumps({'type': 'error', 'message': error_msg, 'raw': full_response[:1000]})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'生成失败: {str(e)}'})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

