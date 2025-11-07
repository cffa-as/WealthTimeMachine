# 算法设计文档

## 一、系统架构

### 1.1 技术栈选型

#### 后端框架
- **FastAPI**: 高性能异步Web框架，支持自动API文档生成
- **Pydantic**: 数据验证和序列化，确保类型安全
- **Uvicorn**: ASGI服务器，支持高并发

#### AI模型选型
- **DeepSeek Chat**: 
  - 选择理由：国产大模型，中文理解能力强，API兼容OpenAI格式
  - 模型特点：支持流式输出，响应速度快，成本可控
  - 应用场景：个性化故事生成，自然语言理解

#### 图像生成
- **腾讯云混元文生图API（极速版）**:
  - 选择理由：国产服务，响应速度快，支持中文Prompt
  - 技术特点：同步接口，延迟低，适合实时生成

### 1.2 数据流架构

```
用户输入 → 前端验证 → FastAPI后端
                ↓
        金融决策模型（MPT算法）
                ↓
        风险评估 + 路径推荐
                ↓
        DeepSeek AI（流式生成故事）
                ↓
        腾讯云图像生成（异步）
                ↓
        前端实时展示（SSE）
```

## 二、核心算法

### 2.1 现代投资组合理论（Modern Portfolio Theory, MPT）

**理论基础**: Markowitz (1952) 提出的均值-方差优化模型

**核心思想**: 在给定风险水平下，最大化预期收益；或在给定收益水平下，最小化风险

**实现方式**:
```python
# 风险-收益配置
risk_profiles = {
    "low": {
        "expected_return": 0.05,    # 年化5%
        "volatility": 0.03,         # 波动率3%
        "asset_allocation": {
            "bonds": 0.70,          # 债券70%
            "stocks": 0.20,         # 股票20%
            "cash": 0.10            # 现金10%
        }
    },
    # ... medium, high
}
```

### 2.2 多因子风险评估模型

**因子构成**:
1. **资产覆盖率因子** (Asset Coverage Factor)
   - 公式: `asset_coverage = current_asset / target_amount`
   - 权重: 30%
   - 意义: 衡量当前资产与目标的距离

2. **时间压力因子** (Time Pressure Factor)
   - 公式: `time_pressure = f(months_to_target)`
   - 权重: 30%
   - 意义: 时间越紧迫，风险承受能力要求越高

3. **年龄因子** (Age Factor)
   - 公式: `age_factor = 1 - (age - 25) / 50`
   - 权重: 20%
   - 理论基础: 生命周期理论（Life Cycle Hypothesis）
   - 意义: 年轻人可以承担更多风险

4. **收入稳定性因子** (Income Stability Factor)
   - 公式: `income_stability = min(1.0, monthly_income / 20000)`
   - 权重: 20%
   - 意义: 收入越高，风险承受能力越强

**综合风险评分**:
```python
risk_score = (
    asset_coverage * 0.3 +
    time_pressure * 0.3 +
    age_factor * 0.2 +
    income_stability * 0.2
)
```

### 2.3 货币时间价值（Time Value of Money, TVM）

**复利终值公式**:
```
FV = PV * (1 + r)^n
```

**年金终值公式**:
```
FV = PMT * [((1 + r)^n - 1) / r]
```

**综合公式**（考虑初始资产和定期储蓄）:
```
FV = PV * (1 + r)^n + PMT * [((1 + r)^n - 1) / r]
```

其中：
- FV: 未来价值（目标金额）
- PV: 现值（当前资产）
- PMT: 每期支付（月储蓄额）
- r: 每期利率（月化收益率 = 年化收益率 / 12）
- n: 期数（月数）

### 2.4 夏普比率（Sharpe Ratio）

**公式**:
```
Sharpe Ratio = (E[R] - Rf) / σ
```

其中：
- E[R]: 投资组合预期收益率
- Rf: 无风险利率（采用10年期国债收益率，约3%）
- σ: 投资组合收益率的标准差（波动率）

**评价标准**:
- Sharpe > 1: 优秀（每单位风险获得超过1单位超额收益）
- Sharpe 0.5-1: 良好
- Sharpe < 0.5: 一般

**理论参考**: Sharpe, W. F. (1966). Mutual Fund Performance.

### 2.5 索提诺比率（Sortino Ratio）

**公式**:
```
Sortino Ratio = (E[R] - Rf) / σ_down
```

其中：
- E[R]: 预期收益率
- Rf: 无风险利率
- σ_down: 下行标准差（只计算负收益的标准差）

**与Sharpe Ratio的区别**:
- Sharpe Ratio考虑所有波动（上行和下行）
- Sortino Ratio只考虑下行波动，更符合投资者心理
- 对于风险厌恶型投资者，Sortino Ratio更有参考价值

**假设**: 下行波动率约为总波动率的60%（基于历史数据统计）

**理论参考**: Sortino, F. A., & Price, L. N. (1994). Performance Measurement in a Downside Risk Framework.

### 2.6 风险价值（VaR - Value at Risk）

**公式**:
```
VaR = -μ + z_α * σ
```

其中：
- μ: 预期收益率
- z_α: 置信水平对应的Z值（95%置信度约1.645）
- σ: 波动率

**意义**: 在95%置信水平下，投资组合在特定时间内的最大可能损失

**理论参考**: Jorion, P. (2007). Value at Risk: The New Benchmark for Managing Financial Risk.

### 2.7 条件风险价值（CVaR / Expected Shortfall）

**公式**:
```
CVaR = E[Loss | Loss > VaR]
```

**与VaR的区别**:
- VaR只告诉我们"最坏情况下的损失"
- CVaR告诉我们"在最坏情况下，平均损失是多少"
- CVaR是**一致性风险度量**（Coherent Risk Measure），满足次可加性

**计算**: 基于正态分布假设，CVaR ≈ VaR * 1.3

**理论参考**: Artzner, P., et al. (1999). Coherent Measures of Risk.

### 2.8 蒙特卡洛模拟（Monte Carlo Simulation）

**模型**: 几何布朗运动（Geometric Brownian Motion）
```
S(t) = S(0) * exp((μ - σ²/2)*t + σ*W(t))
```

其中：
- S(t): t时刻的资产价值
- μ: 预期收益率（月化）
- σ: 波动率（月化）
- W(t): 布朗运动（随机项）

**实现**:
1. 进行10,000次模拟
2. 每次模拟生成随机收益率路径
3. 计算最终资产分布
4. 得到：
   - 预期值（均值）
   - 中位数
   - 5%分位数（保守估计）
   - 95%分位数（乐观估计）
   - 置信区间

**优势**:
- 考虑市场波动的不确定性
- 提供概率分布，而非单一预测
- 可以评估极端情况

**理论参考**: Glasserman, P. (2003). Monte Carlo Methods in Financial Engineering.

### 2.9 动态资产配置优化

**理论基础**: 生命周期投资理论（Life-Cycle Investing）

**动态调整因子**:
1. **时间因子**: 时间越长，可以承担更多风险（股票比例更高）
2. **资产覆盖率因子**: 资产越多，可以更保守（债券比例更高）

**公式**:
```
stocks_adj = base_stocks * (1 + time_factor * 0.2) * (1 - conservative_factor)
bonds_adj = base_bonds * (1 - time_factor * 0.1) * (1 + conservative_factor)
```

**理论参考**: Bodie, Z., Merton, R. C., & Samuelson, W. F. (1992). Labor Supply Flexibility and Portfolio Choice.

### 2.10 改进的多因子风险评估模型

**改进点**:
1. **使用加权几何平均**替代简单加权平均
   - 更符合多因子模型理论（Fama-French模型）
   - 避免极端值的影响

2. **收入稳定性使用对数函数**
   - 避免线性关系的极端值
   - 更符合实际收入分布

3. **动态风险调整**
   - 时间压力高 + 资产基础低 → 适度提高风险评分
   - 更符合实际投资决策逻辑

**理论参考**: Fama, E. F., & French, K. R. (1993). Common risk factors in the returns on stocks and bonds.

## 三、AI模型应用

### 3.1 DeepSeek Chat 模型

**模型特点**:
- 参数量: 67B（推测）
- 上下文长度: 32K tokens
- 支持流式输出
- 中文理解能力强

**应用场景**:
1. **个性化故事生成**
   - 输入: 用户财务数据 + 推荐路径
   - 输出: 5章节个性化财务故事
   - 特点: 流式生成，实时反馈

2. **Prompt工程**:
   - 结构化Prompt设计
   - 包含用户画像、风险等级、目标类型
   - 要求输出JSON格式，便于解析

### 3.2 图像生成模型

**腾讯云混元文生图API（极速版）**:
- 模型: 混元文生图模型
- 特点: 同步接口，延迟低（<2s）
- 分辨率: 1024x1024
- 应用: 为每个故事章节生成配图

## 四、性能优化

### 4.1 流式响应（Server-Sent Events, SSE）

**优势**:
- 实时反馈，提升用户体验
- 降低首字节时间（TTFB）
- 支持长文本生成

**实现**:
```python
async def generate():
    async for chunk in ai_service.call_deepseek_stream(messages):
        yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
```

### 4.2 异步图像生成

**策略**:
- 故事生成完成后，异步生成图像
- 通过SSE实时更新图像生成进度
- 避免阻塞主流程

### 4.3 JSON解析优化

**策略**:
- 多级容错机制
- 支持不完整JSON的修复
- 正则表达式提取关键字段

## 五、可解释性（Explainability）

### 5.1 风险评估可解释性

- 展示4个风险因子的具体数值
- 说明每个因子的含义和影响
- 提供通俗易懂的解释

### 5.2 推荐理由生成

- 基于风险因子生成个性化推荐理由
- 使用类比和比喻，降低理解门槛
- 展示关键指标（Sharpe Ratio, VaR等）

## 六、参考文献

1. Markowitz, H. (1952). Portfolio Selection. *Journal of Finance*, 7(1), 77-91.

2. Sharpe, W. F. (1966). Mutual Fund Performance. *Journal of Business*, 39(1), 119-138.

3. Sharpe, W. F. (1964). Capital Asset Prices: A Theory of Market Equilibrium Under Conditions of Risk. *Journal of Finance*, 19(3), 425-442.

4. Modigliani, F., & Brumberg, R. (1954). Utility Analysis and the Consumption Function: An Interpretation of Cross-Section Data. In K. Kurihara (Ed.), *Post-Keynesian Economics*.

5. Black, F., & Litterman, R. (1992). Global Portfolio Optimization. *Financial Analysts Journal*, 48(5), 28-43.

6. Jorion, P. (2007). *Value at Risk: The New Benchmark for Managing Financial Risk* (3rd ed.). McGraw-Hill.

7. Brealey, R. A., Myers, S. C., & Allen, F. (2020). *Principles of Corporate Finance* (13th ed.). McGraw-Hill Education.

## 七、未来优化方向

1. **蒙特卡洛模拟**: 用于更精确的风险评估和收益预测
2. **Black-Litterman模型**: 改进资产配置优化
3. **机器学习模型**: 基于历史数据优化风险评分权重
4. **实时市场数据**: 集成实时市场数据，动态调整预期收益率
5. **多目标优化**: 同时优化收益、风险、流动性等多个目标

