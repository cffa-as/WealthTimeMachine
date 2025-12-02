"use client"

import React from "react"

import type { ReactNode } from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Shield, Scale, Rocket, ArrowLeft, TrendingUp, Sparkles, BarChart3, Info, TrendingDown } from "lucide-react"
import { getRecommendation, type RecommendationResponse } from "@/lib/api"

interface FinancialData {
  goal: string
  currentAsset: number
  monthlyIncome: number
}

interface Path {
  id: number
  name: string
  icon: ReactNode
  monthlySave: number
  expectedReturn: number
  targetMonths: number
  riskLevel: "low" | "medium" | "high"
  description: string
}

interface SerializablePath {
  id: number
  name: string
  monthlySave: number
  expectedReturn: number
  targetMonths: number
  riskLevel: "low" | "medium" | "high"
  description: string
}

function recommendPath(financialData: FinancialData): "low" | "medium" | "high" {
  const { currentAsset, monthlyIncome, goal } = financialData

  // Estimate target amount based on goal keywords
  let estimatedTarget = 500000 // default 50万
  if (goal.includes("买房") || goal.includes("房")) {
    estimatedTarget = 1000000 // 100万
  } else if (goal.includes("买车") || goal.includes("车")) {
    estimatedTarget = 300000 // 30万
  } else if (goal.includes("教育")) {
    estimatedTarget = 500000 // 50万
  } else if (goal.includes("自由") || goal.includes("退休")) {
    estimatedTarget = 2000000 // 200万
  }

  const gap = estimatedTarget - currentAsset
  const monthsAtCurrentIncome = gap / (monthlyIncome * 0.3) // Assume 30% savings rate

  // Decision logic:
  // 1. If income is high (>20k) and gap is manageable -> high risk
  // 2. If income is medium (10k-20k) -> medium risk
  // 3. If income is low (<10k) or gap is very large -> low risk
  // 4. If current asset is already high (>50% of target) -> can be more aggressive

  const assetRatio = currentAsset / estimatedTarget

  if (monthlyIncome >= 20000 && assetRatio > 0.3) {
    return "high"
  } else if (monthlyIncome >= 15000 || assetRatio > 0.5) {
    return "high"
  } else if (monthlyIncome >= 10000 && monthsAtCurrentIncome < 60) {
    return "medium"
  } else if (assetRatio > 0.6) {
    return "medium"
  } else {
    return "low"
  }
}

function getAlternativePath(recommended: "low" | "medium" | "high"): "low" | "medium" | "high" {
  if (recommended === "high") return "medium"
  if (recommended === "medium") return "low"
  return "medium"
}

export default function PlanningPage() {
  const router = useRouter()
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [selectedPath, setSelectedPath] = useState<Path | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [recommendedRisk, setRecommendedRisk] = useState<"low" | "medium" | "high">("medium")
  const [recommendation, setRecommendation] = useState<RecommendationResponse["recommendation"] | null>(null)
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(true)

  useEffect(() => {
    const data = sessionStorage.getItem("financialData")
    if (!data) {
      router.push("/")
      return
    }
    const parsedData = JSON.parse(data)
    setFinancialData(parsedData)
    
    // 调用后端API获取推荐
    const loadRecommendation = async () => {
      try {
        setIsLoadingRecommendation(true)
        const result = await getRecommendation(parsedData)
        console.log("后端返回的推荐数据:", result)
        
        if (result && result.recommendation) {
          console.log("推荐详情:", result.recommendation)
          setRecommendation(result.recommendation)
          setRecommendedRisk(result.recommendation.recommendedRisk)
        } else {
          console.warn("后端返回数据格式不正确:", result)
          throw new Error("后端返回数据格式不正确")
        }
      } catch (error) {
        console.error("获取推荐失败，使用本地计算:", error)
        // 回退到本地计算
        const recommended = recommendPath(parsedData)
        setRecommendedRisk(recommended)
        setRecommendation(null) // 清除推荐数据，使用回退方案
      } finally {
        setIsLoadingRecommendation(false)
      }
    }
    
    loadRecommendation()
  }, [router])

  // 使用后端推荐数据或默认值构建路径
  // 如果推荐的是某个风险等级，使用推荐数据；否则使用默认值
  const getPathData = (riskLevel: "low" | "medium" | "high") => {
    const isRecommended = recommendation && recommendation.recommendedRisk === riskLevel
    const baseData = {
      low: {
        monthlySave: Math.round((financialData?.monthlyIncome || 12000) * 0.3),
        expectedReturn: 5,
        targetMonths: 48,
      },
      medium: {
        monthlySave: Math.round((financialData?.monthlyIncome || 12000) * 0.4),
        expectedReturn: 7,
        targetMonths: 36,
      },
      high: {
        monthlySave: Math.round((financialData?.monthlyIncome || 12000) * 0.5),
        expectedReturn: 9,
        targetMonths: 30,
      },
    }
    
    return isRecommended && recommendation
      ? {
          monthlySave: recommendation.monthlySave ?? baseData[riskLevel].monthlySave,
          expectedReturn: recommendation.expectedReturn ?? baseData[riskLevel].expectedReturn,
          targetMonths: recommendation.targetMonths ?? baseData[riskLevel].targetMonths,
        }
      : baseData[riskLevel]
  }

  const allPaths: Record<string, Path> = {
    low: {
      id: 1,
      name: "稳健型",
      icon: <Shield className="w-8 h-8" />,
      ...getPathData("low"),
      riskLevel: "low",
      description: "安全第一，稳扎稳打",
    },
    medium: {
      id: 2,
      name: "平衡型",
      icon: <Scale className="w-8 h-8" />,
      ...getPathData("medium"),
      riskLevel: "medium",
      description: "风险可控，收益平衡",
    },
    high: {
      id: 3,
      name: "激进型",
      icon: <Rocket className="w-8 h-8" />,
      ...getPathData("high"),
      riskLevel: "high",
      description: "敢于冒险，追求高收益",
    },
  }

  const alternativeRisk = getAlternativePath(recommendedRisk)
  const paths = [allPaths[recommendedRisk], allPaths[alternativeRisk]]

  const handleSelectPath = (path: Path) => {
    setSelectedPath(path)
    setIsLoading(true)

    const serializablePath: SerializablePath = {
      id: path.id,
      name: path.name,
      monthlySave: path.monthlySave,
      expectedReturn: path.expectedReturn,
      targetMonths: path.targetMonths,
      riskLevel: path.riskLevel,
      description: path.description,
    }
    sessionStorage.setItem("selectedPath", JSON.stringify(serializablePath))

    setTimeout(() => {
      router.push("/story")
    }, 1000)
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-chart-3"
      case "medium":
        return "bg-chart-2"
      case "high":
        return "bg-chart-1"
      default:
        return "bg-muted"
    }
  }

  if (!financialData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-2 sm:mb-3 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-1.5 sm:mb-2 text-balance">
            AI为您推荐财务路径
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground line-clamp-2">{financialData.goal}</p>
        </div>

        {/* 金融模型推荐分析 */}
        {isLoadingRecommendation ? (
          <Card className="p-3 sm:p-4 mb-4 sm:mb-5">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">正在分析您的财务状况...</p>
            </div>
          </Card>
        ) : recommendation ? (
          <Card className="p-3 sm:p-4 mb-4 sm:mb-5 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-primary/20">
            <div className="space-y-4">
              {/* 推荐标题 */}
              <div className="flex gap-2 sm:gap-2.5 items-start">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold mb-1 text-sm sm:text-base flex items-center gap-2">
                    金融模型智能分析
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-2">
                    {recommendation.reason || "基于您的财务状况分析，为您推荐最适合的理财路径。"}
                  </p>
                  {/* 可解释性说明 */}
                  <div className="mt-2 p-3 sm:p-4 bg-background/50 rounded-md border border-border/50">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                          <span className="text-base">💡</span>
                          为什么这样推荐？
                        </p>
                      </div>
                      
                      {/* 简化版分析 - 使用比喻 */}
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">📊</span>
                          <span>
                            <span className="font-medium text-foreground">就像爬山一样：</span>
                            您的目标是 <span className="font-medium text-foreground">¥{((recommendation.targetAmount ?? 0) / 10000).toFixed(0)}万</span>，
                            目前完成了 <span className="font-medium text-primary">{Math.min(100, ((recommendation.riskFactors?.asset_coverage ?? 0) * 100)).toFixed(0)}%</span>。
                            {((recommendation.riskFactors?.asset_coverage ?? 0) < 0.2 
                              ? " 就像刚起步，需要稳扎稳打。"
                              : (recommendation.riskFactors?.asset_coverage ?? 0) < 0.5
                              ? " 已经走了一段路，可以适当加速。"
                              : " 已经接近山顶，可以更稳健地前进。")}
                          </span>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">⚖️</span>
                          <span>
                            <span className="font-medium text-foreground">您的风险承受能力：</span>
                            <span className="font-medium text-primary">{((recommendation.riskScore ?? 0) * 100).toFixed(0)}分</span>（满分100）。
                            {((recommendation.riskScore ?? 0) < 0.4 
                              ? " 就像开车，您更适合平稳驾驶。"
                              : (recommendation.riskScore ?? 0) < 0.7
                              ? " 就像开车，您可以适当超车，但要注意安全。"
                              : " 就像开车，您可以在高速路上驰骋。")}
                          </span>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">⏰</span>
                          <span>
                            <span className="font-medium text-foreground">时间压力：</span>
                            {((recommendation.riskFactors?.time_pressure ?? 0) < 0.3 
                              ? "时间充裕，就像马拉松，可以慢慢跑。"
                              : (recommendation.riskFactors?.time_pressure ?? 0) < 0.7
                              ? "时间适中，就像中长跑，需要合理配速。"
                              : "时间紧迫，就像短跑，需要全力冲刺。")}
                          </span>
                        </div>
                      </div>
                      
                      {/* 推荐方案 - 简化 */}
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-xs font-medium text-foreground mb-2">✨ 为您推荐的方案：</p>
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">
                              {recommendation.recommendedRisk === "low" ? "稳健型" : recommendation.recommendedRisk === "medium" ? "平衡型" : "激进型"}
                            </span>
                            {recommendation.recommendedRisk === "low" 
                              ? " - 就像存银行，安全但收益有限。"
                              : recommendation.recommendedRisk === "medium"
                              ? " - 就像混合基金，风险和收益各占一半。"
                              : " - 就像股票投资，收益高但波动大。"}
                          </div>
                          
                          <div>
                            <span className="font-medium text-foreground">预期收益：</span>
                            <span className="font-medium text-green-600">{recommendation.expectedReturn?.toFixed(1) ?? 0}%</span>/年。
                            简单说，投入10万，一年后大约有 <span className="font-medium text-green-600">{((recommendation.expectedReturn ?? 0) / 100 * 10).toFixed(1)}万</span> 收益。
                          </div>
                          
                          <div>
                            <span className="font-medium text-foreground">达成时间：</span>
                            约 <span className="font-medium">{Math.round((recommendation.targetMonths ?? 0) / 12)}年{((recommendation.targetMonths ?? 0) % 12)}个月</span>。
                            就像种树，需要时间才能长成参天大树。
                          </div>
                          
                          <div>
                            <span className="font-medium text-foreground">资产增长：</span>
                            从 <span className="font-medium">¥{((recommendation.targetAmount ?? 0) / 10000).toFixed(0)}万</span> 到 <span className="font-medium text-green-600">¥{((recommendation.expectedFinalAmount ?? 0) / 10000).toFixed(1)}万</span>。
                            就像滚雪球，越滚越大。
                          </div>
                        </div>
                      </div>
                      
                      {/* 总结 - 简化 */}
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-xs text-muted-foreground/90 italic leading-relaxed">
                          💬 {recommendation.recommendedRisk === "low" 
                            ? "这个方案就像稳健的储蓄罐，安全可靠，适合追求稳定的您。"
                            : recommendation.recommendedRisk === "medium"
                            ? "这个方案就像平衡的跷跷板，在风险和收益之间找到了最佳平衡点。"
                            : "这个方案就像高速列车，收益高但需要您能承受颠簸。"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 风险评分和因子 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BarChart3 className="w-3 h-3" />
                    风险评分
                  </div>
                  <div className="text-base sm:text-lg font-bold text-primary">
                    {((recommendation.riskScore ?? 0) * 100).toFixed(0)}
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${((recommendation.riskScore ?? 0) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground/80">综合评估您的风险承受能力</div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="w-3 h-3" />
                    预期收益
                  </div>
                  <div className="text-base sm:text-lg font-bold text-green-600">
                    {(recommendation.expectedReturn ?? 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">年化收益率</div>
                  <div className="text-xs text-muted-foreground/80">基于历史数据和市场分析</div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="w-3 h-3" />
                    夏普比率
                  </div>
                  <div className="text-base sm:text-lg font-bold">
                    {(recommendation.sharpeRatio ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">风险调整收益</div>
                  <div className="text-xs text-muted-foreground/80">数值越高，风险收益比越好</div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingDown className="w-3 h-3" />
                    波动率
                  </div>
                  <div className="text-base sm:text-lg font-bold text-orange-600">
                    {(recommendation.volatility ?? 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">预期波动</div>
                  <div className="text-xs text-muted-foreground/80">资产价格可能的波动范围</div>
                </div>
              </div>

              {/* 风险因子详情 */}
              {recommendation.riskFactors && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-muted-foreground">风险评估因子</div>
                    <div className="text-xs text-muted-foreground/70">基于多因子模型计算</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(recommendation.riskFactors).map(([key, value]) => {
                      const labels: Record<string, string> = {
                        asset_coverage: "资产覆盖率",
                        time_pressure: "时间压力",
                        age_factor: "年龄因子",
                        income_stability: "收入稳定性"
                      }
                      const descriptions: Record<string, string> = {
                        asset_coverage: "当前资产占目标金额的比例",
                        time_pressure: "达成目标的时间紧迫程度",
                        age_factor: "年龄对风险承受能力的影响",
                        income_stability: "收入水平对风险承受能力的影响"
                      }
                      const numValue = typeof value === 'number' ? value : 0
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-foreground">{labels[key] || key}</div>
                            <span className="text-xs font-semibold text-primary">
                              {(numValue * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-accent h-1.5 rounded-full transition-all"
                              style={{ width: `${numValue * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground/70 leading-tight">
                            {descriptions[key] || ""}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 资产配置 */}
              {recommendation.assetAllocation && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-muted-foreground">推荐资产配置</div>
                    <div className="text-xs text-muted-foreground/70">基于现代投资组合理论</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">债券</span>
                        <span className="font-medium">{((recommendation.assetAllocation.bonds ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${(recommendation.assetAllocation.bonds ?? 0) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground/70">稳健收益</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">股票</span>
                        <span className="font-medium">{((recommendation.assetAllocation.stocks ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${(recommendation.assetAllocation.stocks ?? 0) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground/70">成长潜力</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">现金</span>
                        <span className="font-medium">{((recommendation.assetAllocation.cash ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-gray-400 h-2 rounded-full transition-all"
                          style={{ width: `${(recommendation.assetAllocation.cash ?? 0) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground/70">流动性保障</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 预期结果 */}
              <div className="pt-2 border-t border-border/50">
                <div className="text-xs font-semibold text-muted-foreground mb-2">预期达成结果</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">目标金额</div>
                    <div className="font-semibold text-sm">¥{((recommendation.targetAmount ?? 0) / 10000).toFixed(0)}万</div>
                    <div className="text-xs text-muted-foreground/70">您设定的理财目标</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">预期最终金额</div>
                    <div className="font-semibold text-sm text-green-600">
                      ¥{((recommendation.expectedFinalAmount ?? 0) / 10000).toFixed(1)}万
                    </div>
                    <div className="text-xs text-muted-foreground/70">考虑复利后的预期金额</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">预计时间</div>
                    <div className="font-semibold text-sm">{recommendation.targetMonths ?? 0}个月</div>
                    <div className="text-xs text-muted-foreground/70">约{Math.round((recommendation.targetMonths ?? 0) / 12)}年{((recommendation.targetMonths ?? 0) % 12)}个月</div>
                  </div>
                </div>
                {recommendation.maxDrawdown && (
                  <div className="mt-3 pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">最大回撤风险</span>
                      <span className="font-medium text-orange-600">{(recommendation.maxDrawdown ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      在极端市场情况下，资产可能出现的最大跌幅
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-3 sm:p-4 mb-4 sm:mb-5 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-primary/20">
            <div className="flex gap-2 sm:gap-2.5 items-start">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold mb-1 text-sm sm:text-base flex items-center gap-2">AI智能分析</h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  根据您的目标、当前资产
                  <span className="font-medium text-foreground">（¥{financialData.currentAsset.toLocaleString()}）</span>
                  和月收入
                  <span className="font-medium text-foreground">（¥{financialData.monthlyIncome.toLocaleString()}）</span>
                  ， AI为您推荐了<span className="font-bold text-primary">{allPaths[recommendedRisk].name}</span>路径。
                  当然，您也可以选择其他路径。
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Path Cards */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 mb-4 sm:mb-5">
          {paths.map((path, index) => {
            const isRecommended = path.riskLevel === recommendedRisk
            const isSelected = selectedPath?.id === path.id
            const isOtherSelected = selectedPath && selectedPath.id !== path.id

            return (
              <Card
                key={path.id}
                className={`p-3 sm:p-4 md:p-5 transition-all duration-300 cursor-pointer hover:shadow-xl relative ${
                  isSelected
                    ? "ring-2 ring-primary shadow-xl scale-[1.02] sm:scale-105"
                    : isOtherSelected
                      ? "opacity-50"
                      : "hover:scale-[1.02] sm:hover:scale-105 active:scale-95"
                } ${isRecommended ? "border-primary/50" : ""}`}
                onClick={() => !isLoading && handleSelectPath(path)}
              >
                {isRecommended && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <Sparkles className="w-3 h-3" />
                    AI推荐
                  </div>
                )}

                {/* Icon and Name */}
                <div className="flex items-start gap-2 sm:gap-2.5 mb-2.5 sm:mb-3">
                  <div
                    className={`p-1.5 sm:p-2 rounded-xl flex-shrink-0 ${
                      path.riskLevel === "low"
                        ? "bg-chart-3/10 text-chart-3"
                        : path.riskLevel === "medium"
                          ? "bg-chart-2/10 text-chart-2"
                          : "bg-chart-1/10 text-chart-1"
                    }`}
                  >
                    {React.cloneElement(path.icon as React.ReactElement, {
                      className: "w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7",
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold mb-0.5">{path.name}</h3>
                    <p className="text-xs text-muted-foreground">{path.description}</p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="space-y-2 mb-2.5 sm:mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">月存金额</span>
                    <span className="text-sm sm:text-base font-bold">¥{path.monthlySave.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">预期年化收益</span>
                    <span className="text-sm sm:text-base font-bold text-chart-1">{path.expectedReturn}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">预计实现时间</span>
                    <span className="text-sm sm:text-base font-bold">{path.targetMonths}个月</span>
                  </div>
                </div>

                {/* Risk Level */}
                <div className="mb-2.5 sm:mb-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted-foreground">风险等级</span>
                    <span className="text-xs font-medium capitalize">{path.riskLevel}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getRiskColor(path.riskLevel)} transition-all`}
                      style={{
                        width: path.riskLevel === "low" ? "33%" : path.riskLevel === "medium" ? "66%" : "100%",
                      }}
                    />
                  </div>
                </div>

                {/* Select Button */}
                <Button
                  className="w-full h-9 sm:h-10 text-xs sm:text-sm active:scale-95"
                  variant={isSelected ? "default" : isRecommended ? "default" : "outline"}
                  disabled={isLoading}
                >
                  {isSelected && isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      生成故事中...
                    </>
                  ) : isSelected ? (
                    "已选择"
                  ) : isRecommended ? (
                    "选择推荐路径"
                  ) : (
                    "选择此路径"
                  )}
                </Button>
              </Card>
            )
          })}
        </div>

        {/* Info Box */}
        <Card className="p-3 sm:p-4 bg-accent/10 border-accent/20">
          <div className="flex gap-2 sm:gap-2.5">
            <TrendingUp className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold mb-0.5 text-xs sm:text-sm">关于AI推荐</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI综合分析了您的财务状况、目标金额和风险承受能力，为您推荐了最适合的路径。
                选择路径后，AI将生成一个专属于您的财务故事，展示从现在到实现目标的完整旅程。
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
