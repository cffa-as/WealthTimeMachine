"use client"

import React from "react"

import type { ReactNode } from "react"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Shield, Scale, Rocket, ArrowLeft, ArrowRight, TrendingUp, Sparkles, BarChart3, Info, TrendingDown, Volume2, VolumeX, Loader2, MessageCircle, Crown } from "lucide-react"
import { getRecommendation, generateTTS, getTTSVoices, type RecommendationResponse } from "@/lib/api"

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

// 生成大白话解释文本
function generatePlainExplanation(
  recommendations: RecommendationResponse["recommendations"] | null,
  recommendedRisk: "low" | "medium" | "high",
  financialData: FinancialData
): string {
  if (!recommendations || !recommendations[recommendedRisk]) {
    return "基于您的财务状况分析，为您推荐最适合的理财路径。"
  }
  
  const rec = recommendations[recommendedRisk]
  const riskName = recommendedRisk === "low" ? "稳健型" : recommendedRisk === "medium" ? "平衡型" : "激进型"
  
  // 资产覆盖率分析
  const assetCoverage = rec.riskFactors?.asset_coverage ?? 0
  let assetText = ""
  if (assetCoverage < 0.2) {
    assetText = "您目前距离目标还有一段距离，就像刚起步爬山，需要稳扎稳打，一步一步来。"
  } else if (assetCoverage < 0.5) {
    assetText = "您已经完成了目标的一小半，就像爬山已经走了一段路，可以适当加快速度了。"
  } else {
    assetText = "您已经非常接近目标了，就像爬山快到山顶了，可以更稳健地前进。"
  }
  
  // 风险承受能力分析
  const riskScore = rec.riskScore ?? 0
  let riskText = ""
  if (riskScore < 0.4) {
    riskText = "您的风险承受能力比较保守，就像开车，您更适合平稳驾驶，安全第一。"
  } else if (riskScore < 0.7) {
    riskText = "您的风险承受能力适中，就像开车，您可以适当超车，但要注意安全。"
  } else {
    riskText = "您的风险承受能力很强，就像开车，您可以在高速路上驰骋。"
  }
  
  // 时间压力分析
  const timePressure = rec.riskFactors?.time_pressure ?? 0
  let timeText = ""
  if (timePressure < 0.3) {
    timeText = "您的时间很充裕，就像跑马拉松，可以慢慢来，不用着急。"
  } else if (timePressure < 0.7) {
    timeText = "您的时间适中，就像中长跑，需要合理配速，不能太快也不能太慢。"
  } else {
    timeText = "您的时间比较紧迫，就像短跑，需要全力冲刺才能达成目标。"
  }
  
  // 方案说明
  const schemeText = riskName === "稳健型" 
    ? "这个方案就像存银行，安全可靠，收益虽然不高但很稳定，适合追求安稳的您。"
    : riskName === "平衡型"
    ? "这个方案就像混合基金，风险和收益各占一半，在稳定和增长之间找到了平衡。"
    : "这个方案就像股票投资，收益高但波动也大，需要您能承受一定的市场波动。"
  
  // 收益说明
  const annualReturn = rec.expectedReturn ?? 0
  const returnText = `预期年化收益率是${annualReturn.toFixed(1)}%，简单说，如果您投入10万元，一年后大约能获得${(annualReturn / 100 * 10).toFixed(1)}万元的收益，总资产将达到${(10 + annualReturn / 100 * 10).toFixed(1)}万元。`
  
  // 时间说明
  const months = rec.targetMonths ?? 0
  const years = Math.round(months / 12)
  const remainingMonths = months % 12
  const timeDetailText = `预计需要${years}年${remainingMonths}个月的时间，就像种树一样，需要时间才能长成参天大树。`
  
  // 资产增长说明 - 从当前资产到最终资产
  const currentAsset = financialData.currentAsset
  const finalAmount = rec.expectedFinalAmount ?? rec.targetAmount ?? currentAsset
  const growthAmount = finalAmount - currentAsset
  const growthText = `您的资产会从${(currentAsset / 10000).toFixed(1)}万元增长到${(finalAmount / 10000).toFixed(1)}万元，累计增长${(growthAmount / 10000).toFixed(1)}万元，就像滚雪球一样，越滚越大。`
  
  return `${assetText} ${riskText} ${timeText} 基于这些分析，我们为您推荐${riskName}理财方案。${schemeText} ${returnText} ${timeDetailText} ${growthText}`
}

// 格式化关怀版解释文本，添加强调样式
function formatCaringExplanation(text: string, rec: any): React.ReactNode {
  if (!text) return text
  
  // 高亮数字（包括百分比、金额、年份等）
  const parts: React.ReactNode[] = []
  const regex = /(\d+\.?\d*[%万元年个月])|(稳健型|平衡型|激进型)|(预期年化收益率|投入10万元|一年后|总资产将达到|预计需要|资产会从|增长到|累计增长|基于这些分析|我们为您推荐)/g
  let lastIndex = 0
  let match
  let key = 0
  
  while ((match = regex.exec(text)) !== null) {
    // 添加前面的文本
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    
    // 添加高亮的部分
    if (match[1]) {
      // 数字
      parts.push(
        <span key={key++} className="font-bold text-primary">
          {match[1]}
        </span>
      )
    } else if (match[2]) {
      // 方案名称
      parts.push(
        <span key={key++} className="font-bold text-primary">
          {match[2]}
        </span>
      )
    } else if (match[3]) {
      // 关键词
      parts.push(
        <span key={key++} className="font-semibold text-foreground">
          {match[3]}
        </span>
      )
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 0 ? <>{parts}</> : text
}

// 可拖拽按钮组件
function DraggableButton({
  position,
  onPositionChange,
  isDragging,
  onDraggingChange
}: {
  position: { x: number; y: number }
  onPositionChange: (pos: { x: number; y: number }) => void
  isDragging: boolean
  onDraggingChange: (dragging: boolean) => void
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const clickStartTimeRef = useRef(0)
  const clickStartPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 如果点击的是按钮本身，不开始拖拽
      if (target.closest('button')) {
        return
      }
      clickStartTimeRef.current = Date.now()
      clickStartPosRef.current = { x: e.clientX, y: e.clientY }
      onDraggingChange(true)
      dragOffsetRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffsetRef.current.x
        const newY = e.clientY - dragOffsetRef.current.y
        const maxX = window.innerWidth - 60
        const maxY = window.innerHeight - 60
        onPositionChange({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        })
      }
    }

    const handleMouseUp = () => {
      const wasClick = !isDragging || (
        Date.now() - clickStartTimeRef.current < 200 &&
        Math.abs(clickStartPosRef.current.x - (dragOffsetRef.current.x + position.x)) < 5 &&
        Math.abs(clickStartPosRef.current.y - (dragOffsetRef.current.y + position.y)) < 5
      )
      onDraggingChange(false)
    }

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      // 如果点击的是按钮本身，不开始拖拽
      if (target.closest('button')) {
        return
      }
      const touch = e.touches[0]
      clickStartTimeRef.current = Date.now()
      clickStartPosRef.current = { x: touch.clientX, y: touch.clientY }
      onDraggingChange(true)
      dragOffsetRef.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault() // 现在可以调用preventDefault，因为使用了非passive监听器
        const touch = e.touches[0]
        const newX = touch.clientX - dragOffsetRef.current.x
        const newY = touch.clientY - dragOffsetRef.current.y
        const maxX = window.innerWidth - 60
        const maxY = window.innerHeight - 60
        onPositionChange({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        })
      }
    }

    const handleTouchEnd = () => {
      onDraggingChange(false)
    }

    // 使用非passive事件监听器
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [position, isDragging, onPositionChange, onDraggingChange])

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: isDragging ? 'scale(1.1)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s'
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          router.push("/voice-assistant")
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  )
}

export default function PlanningPage() {
  const router = useRouter()
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [selectedPath, setSelectedPath] = useState<Path | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [recommendedRisk, setRecommendedRisk] = useState<"low" | "medium" | "high">("medium")
  const [recommendations, setRecommendations] = useState<RecommendationResponse["recommendations"] | null>(null)
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(true)
  const [viewMode, setViewMode] = useState<"normal" | "professional" | "caring">("normal")  // 普通版、专业版、关怀版
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false) // 生成语音中
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<string>("Cherry") // 选中的音色
  const [availableVoices, setAvailableVoices] = useState<Record<string, { name: string; description: string; dialect: string }>>({})
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 }) // 浮动按钮位置
  const [isDragging, setIsDragging] = useState(false) // 是否正在拖拽
  const [showProfileCard, setShowProfileCard] = useState(true) // 专属画像折叠
  const [showModelCard, setShowModelCard] = useState(true) // 模型分析折叠
  
  // 初始化按钮位置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setButtonPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 })
    }
  }, [])
  
  // 生成大白话解释文本
  const plainExplanation = recommendations && financialData 
    ? generatePlainExplanation(recommendations, recommendedRisk, financialData)
    : ""
  
  // 加载音色列表
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const voices = await getTTSVoices()
        setAvailableVoices(voices)
      } catch (error) {
        console.error("加载音色列表失败:", error)
      }
    }
    loadVoices()
  }, [])
  
  // 处理语音播放
  const handlePlayAudio = async () => {
    if (!plainExplanation) return
    
    try {
      setIsGeneratingAudio(true) // 开始生成语音
      const response = await generateTTS(plainExplanation, selectedVoice)
      
      if (response) {
        // 后端返回的是base64编码的PCM数据
        // 需要转换为WAV格式才能在浏览器播放
        const audioBytes = Uint8Array.from(atob(response), c => c.charCodeAt(0))
        
        // 创建WAV文件头（24kHz, 16bit, 单声道）
        const sampleRate = 24000
        const numChannels = 1
        const bitsPerSample = 16
        const dataLength = audioBytes.length
        const wavLength = 44 + dataLength
        
        const wavBuffer = new ArrayBuffer(wavLength)
        const view = new DataView(wavBuffer)
        
        // WAV文件头
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i))
          }
        }
        
        writeString(0, 'RIFF')
        view.setUint32(4, wavLength - 8, true)
        writeString(8, 'WAVE')
        writeString(12, 'fmt ')
        view.setUint32(16, 16, true) // fmt chunk size
        view.setUint16(20, 1, true) // audio format (PCM)
        view.setUint16(22, numChannels, true)
        view.setUint32(24, sampleRate, true)
        view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true) // byte rate
        view.setUint16(32, numChannels * bitsPerSample / 8, true) // block align
        view.setUint16(34, bitsPerSample, true)
        writeString(36, 'data')
        view.setUint32(40, dataLength, true)
        
        // 复制PCM数据
        const wavBytes = new Uint8Array(wavBuffer)
        wavBytes.set(audioBytes, 44)
        
        // 创建Blob和URL
        const blob = new Blob([wavBuffer], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        
        // 创建Audio元素播放
        setIsGeneratingAudio(false) // 生成完成
        const audio = new Audio(url)
        audio.onended = () => {
          setIsPlayingAudio(false)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          setIsPlayingAudio(false)
          setIsGeneratingAudio(false)
          URL.revokeObjectURL(url)
        }
        
        setIsPlayingAudio(true) // 开始播放
        setAudioElement(audio)
        setAudioUrl(url)
        await audio.play()
      }
    } catch (error) {
      console.error("播放语音失败:", error)
      setIsPlayingAudio(false)
      setIsGeneratingAudio(false)
    }
  }
  
  // 停止播放
  const handleStopAudio = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    setIsPlayingAudio(false)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioElement(null)
  }

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
        
        if (result && result.recommendations) {
          console.log("推荐详情:", result.recommendations)
          setRecommendations(result.recommendations)
          setRecommendedRisk(result.recommendedRisk)
          // 保存推荐数据到sessionStorage，供智能客服页面使用
          sessionStorage.setItem("recommendationData", JSON.stringify({
            recommendations: result.recommendations,
            recommendedRisk: result.recommendedRisk
          }))
        } else {
          console.warn("后端返回数据格式不正确:", result)
          throw new Error("后端返回数据格式不正确")
        }
      } catch (error) {
        console.error("获取推荐失败，使用本地计算:", error)
        // 回退到本地计算
        const recommended = recommendPath(parsedData)
        setRecommendedRisk(recommended)
        setRecommendations(null) // 清除推荐数据，使用回退方案
      } finally {
        setIsLoadingRecommendation(false)
      }
    }
    
    loadRecommendation()
  }, [router])

  // 使用后端推荐数据或默认值构建路径
  // 现在支持三种风险等级的完整推荐数据
  const getPathData = (riskLevel: "low" | "medium" | "high") => {
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
    
    // 如果有推荐数据，使用推荐数据；否则使用默认值
    if (recommendations && recommendations[riskLevel]) {
      const rec = recommendations[riskLevel]
      return {
        monthlySave: rec.monthlySave ?? baseData[riskLevel].monthlySave,
        expectedReturn: rec.expectedReturn ?? baseData[riskLevel].expectedReturn,
        targetMonths: rec.targetMonths ?? baseData[riskLevel].targetMonths,
      }
    }
    
    return baseData[riskLevel]
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

  // 显示所有三种推荐方案，AI推荐的方案放在第一位
  const paths = [
    allPaths[recommendedRisk],  // AI推荐的方案放在第一位
    ...Object.values(allPaths).filter(path => path.riskLevel !== recommendedRisk)  // 其他方案按顺序排列
  ]

  // 路径轮播当前索引
  const [pathIndex, setPathIndex] = useState(0)

  const visiblePath = paths[pathIndex] || paths[0]

  const handlePrevPath = () => {
    setPathIndex((prev) => (prev - 1 + paths.length) % paths.length)
  }

  const handleNextPath = () => {
    setPathIndex((prev) => (prev + 1) % paths.length)
  }

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
          <div className="flex items-start justify-between gap-4 mb-2 sm:mb-3">
            <Button variant="ghost" onClick={() => router.push("/")} className="-ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            {/* 模式切换 */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === "normal" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("normal")}
                className="text-xs"
              >
                普通版
              </Button>
              <Button
                variant={viewMode === "caring" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("caring")}
                className="text-xs"
              >
                关怀版
              </Button>
              <Button
                variant={viewMode === "professional" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("professional")}
                className="text-xs relative"
              >
                <Crown className="w-3 h-3 mr-1 text-yellow-500 fill-yellow-500" />
                专业版
              </Button>
            </div>
          </div>
          <h1 className={`font-bold mb-1.5 sm:mb-2 text-balance ${
            viewMode === "caring" 
              ? "text-2xl sm:text-3xl md:text-4xl lg:text-5xl" 
              : "text-xl sm:text-2xl md:text-3xl lg:text-4xl"
          }`}>
            AI为您推荐财务路径
          </h1>
          <p className={`text-muted-foreground line-clamp-2 ${
            viewMode === "caring" ? "text-base sm:text-lg" : "text-sm sm:text-base"
          }`}>
            {financialData.goal}
          </p>
        </div>

        {/* 金融模型推荐分析 */}
        {isLoadingRecommendation ? (
          <Card className="p-3 sm:p-4 mb-4 sm:mb-5">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">正在分析您的财务状况...</p>
            </div>
          </Card>
        ) : recommendations ? (
          <>
            {/* 用户画像卡片 - 展示个性化因素 */}
            <Card
              className={`mb-4 sm:mb-5 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border-primary/20 ${
                showProfileCard ? "p-3 sm:p-4" : "p-2 sm:p-3"
              }`}
            >
              <div className="p-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <h4 className="text-sm sm:text-base font-semibold">您的专属画像</h4>
                  <span className="ml-auto text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                    千人千面 · 个性化推荐
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowProfileCard((v) => !v)}
                  >
                    {showProfileCard ? "收起" : "展开"}
                  </Button>
                </div>

                {showProfileCard && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3">
                      {/* 资产覆盖率 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">资产完成度</div>
                        <div className="text-lg font-bold text-primary">
                          {Math.min(100, ((recommendations?.[recommendedRisk]?.riskFactors?.asset_coverage ?? 0) * 100)).toFixed(0)}%
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((recommendations?.[recommendedRisk]?.riskFactors?.asset_coverage ?? 0) * 100))}%` }}
                          />
                        </div>
                      </div>

                      {/* 目标金额 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">目标金额</div>
                        <div className="text-lg font-bold text-foreground">
                          ¥{((recommendations?.[recommendedRisk]?.targetAmount ?? 0) / 10000).toFixed(0)}万
                        </div>
                        <div className="text-[11px] text-muted-foreground/80">您的理财目标</div>
                      </div>

                      {/* 当前资产 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">当前资产</div>
                        <div className="text-lg font-bold text-foreground">
                          ¥{((financialData?.currentAsset ?? 0) / 10000).toFixed(1)}万
                        </div>
                        <div className="text-[11px] text-muted-foreground/80">起点资产基数</div>
                      </div>

                      {/* 月收入 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">月收入</div>
                        <div className="text-lg font-bold text-foreground">
                          ¥{(financialData?.monthlyIncome ?? 0).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-muted-foreground/80">收入稳定性参考</div>
                      </div>

                      {/* 时间压力 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">时间紧迫度</div>
                        <div className="text-lg font-bold text-orange-600">
                          {((recommendations?.[recommendedRisk]?.riskFactors?.time_pressure ?? 0) * 100).toFixed(0)}%
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-orange-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${((recommendations?.[recommendedRisk]?.riskFactors?.time_pressure ?? 0) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* 年龄优势 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">年龄优势</div>
                        <div className="text-lg font-bold text-green-600">
                          {((recommendations?.[recommendedRisk]?.riskFactors?.age_factor ?? 0) * 100).toFixed(0)}%
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${((recommendations?.[recommendedRisk]?.riskFactors?.age_factor ?? 0) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* 收入稳定性 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">收入稳定性</div>
                        <div className="text-lg font-bold text-blue-600">
                          {((recommendations?.[recommendedRisk]?.riskFactors?.income_stability ?? 0) * 100).toFixed(0)}%
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${((recommendations?.[recommendedRisk]?.riskFactors?.income_stability ?? 0) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 个性化说明 */}
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">✨ 个性化分析：</span>
                        基于您的资产完成度 <span className="font-medium">{Math.min(100, ((recommendations?.[recommendedRisk]?.riskFactors?.asset_coverage ?? 0) * 100)).toFixed(0)}%</span>、
                        时间紧迫度 <span className="font-medium">{((recommendations?.[recommendedRisk]?.riskFactors?.time_pressure ?? 0) * 100).toFixed(0)}%</span>、
                        年龄优势 <span className="font-medium">{((recommendations?.[recommendedRisk]?.riskFactors?.age_factor ?? 0) * 100).toFixed(0)}%</span> 和
                        收入稳定性 <span className="font-medium">{((recommendations?.[recommendedRisk]?.riskFactors?.income_stability ?? 0) * 100).toFixed(0)}%</span>，
                        我们的AI模型为您计算出风险评分 <span className="font-bold text-primary">{((recommendations?.[recommendedRisk]?.riskScore ?? 0) * 100).toFixed(0)}分</span>，
                        为您推荐最适合的理财方案。
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card
              className={`mb-4 sm:mb-5 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-primary/20 ${
                viewMode === "caring" ? "p-4 sm:p-6" : "p-3 sm:p-4"
              }`}
            >
            <div className="space-y-4">
              {/* 推荐标题 */}
              <div className="flex gap-2 sm:gap-2.5 items-start">
                <Sparkles className={`text-primary flex-shrink-0 mt-0.5 ${
                  viewMode === "caring" ? "w-6 h-6" : "w-5 h-5"
                }`} />
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold mb-1 flex items-center gap-2 ${
                    viewMode === "caring" ? "text-base sm:text-lg" : "text-sm sm:text-base"
                  }`}>
                    金融模型智能分析
                  </h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs mt-[-4px]"
                  onClick={() => setShowModelCard((v) => !v)}
                >
                  {showModelCard ? "收起" : "展开"}
                </Button>
              </div>

              {showModelCard && (
                <div className="space-y-4">
                  {/* 关怀版语音播放按钮和音色选择 */}
                  {viewMode === "caring" && plainExplanation && (
                    <div className="flex items-center gap-3 mt-3">
                      {/* 音色选择器 */}
                      <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg border-2 border-primary/30 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                        disabled={isPlayingAudio || isGeneratingAudio}
                      >
                        {Object.entries(availableVoices).length > 0 ? (
                          Object.entries(availableVoices).map(([key, voice]) => (
                            <option key={key} value={key}>
                              {voice.name} ({voice.dialect})
                            </option>
                          ))
                        ) : (
                          <option value="Cherry">芊悦 (普通话)</option>
                        )}
                      </select>
                      <Button
                        variant="default"
                        size="icon"
                        onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
                        disabled={isGeneratingAudio}
                        className="w-14 h-14 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
                        title={isGeneratingAudio ? "生成语音中..." : isPlayingAudio ? "停止播放" : "语音播放"}
                      >
                        {isGeneratingAudio ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : isPlayingAudio ? (
                          <VolumeX className="w-6 h-6" />
                        ) : (
                          <Volume2 className="w-6 h-6" />
                        )}
                      </Button>
                    </div>
                  )}
                  {/* 根据模式显示不同的内容 */}
                  {viewMode === "normal" && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-2">
                      {plainExplanation || recommendations?.[recommendedRisk]?.reason || "基于您的财务状况分析，为您推荐最适合的理财路径。"}
                    </p>
                  )}
                  {viewMode === "professional" && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-2">
                      <span className="font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">✨ 采用前沿的机器学习增强的多因子决策模型（MPT-ML），我们深度分析了您的财务状况、风险偏好、时间维度和市场环境等多维度因子，通过AI智能算法精准匹配最优理财策略。</span>{" "}
                      {recommendations?.[recommendedRisk]?.reason || "基于这些深度分析，为您推荐最适合的理财路径。"}
                    </p>
                  )}
                  {viewMode === "caring" && (
                    <div className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-2">
                      {formatCaringExplanation(
                        plainExplanation || recommendations?.[recommendedRisk]?.reason || "基于您的财务状况分析，为您推荐最适合的理财路径。",
                        recommendations?.[recommendedRisk]
                      )}
                    </div>
                  )}
                  {/* 根据模式显示不同内容 */}
                  {/* 普通版：显示详细的大白话解释 */}
                  {viewMode === "normal" && (
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
                            您的目标是 <span className="font-medium text-foreground">¥{((recommendations?.[recommendedRisk]?.targetAmount ?? 0) / 10000).toFixed(0)}万</span>，
                            目前完成了 <span className="font-medium text-primary">{Math.min(100, ((recommendations?.[recommendedRisk]?.riskFactors?.asset_coverage ?? 0) * 100)).toFixed(0)}%</span>。
                            {((recommendations?.[recommendedRisk]?.riskFactors?.asset_coverage ?? 0) < 0.2 
                              ? " 就像刚起步，需要稳扎稳打。"
                              : (recommendations?.[recommendedRisk]?.riskFactors?.asset_coverage ?? 0) < 0.5
                              ? " 已经走了一段路，可以适当加速。"
                              : " 已经接近山顶，可以更稳健地前进。")}
                          </span>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">⚖️</span>
                          <span>
                            <span className="font-medium text-foreground">您的风险承受能力：</span>
                            <span className="font-medium text-primary">{((recommendations?.[recommendedRisk]?.riskScore ?? 0) * 100).toFixed(0)}分</span>（满分100）。
                            {((recommendations?.[recommendedRisk]?.riskScore ?? 0) < 0.4 
                              ? " 就像开车，您更适合平稳驾驶。"
                              : (recommendations?.[recommendedRisk]?.riskScore ?? 0) < 0.7
                              ? " 就像开车，您可以适当超车，但要注意安全。"
                              : " 就像开车，您可以在高速路上驰骋。")}
                          </span>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">⏰</span>
                          <span>
                            <span className="font-medium text-foreground">时间压力：</span>
                            {((recommendations?.[recommendedRisk]?.riskFactors?.time_pressure ?? 0) < 0.3 
                              ? "时间充裕，就像马拉松，可以慢慢跑。"
                              : (recommendations?.[recommendedRisk]?.riskFactors?.time_pressure ?? 0) < 0.7
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
                              {recommendedRisk === "low" ? "稳健型" : recommendedRisk === "medium" ? "平衡型" : "激进型"}
                            </span>
                            {recommendedRisk === "low" 
                              ? " - 就像存银行，安全但收益有限。"
                              : recommendedRisk === "medium"
                              ? " - 就像混合基金，风险和收益各占一半。"
                              : " - 就像股票投资，收益高但波动大。"}
                          </div>
                          
                          <div>
                            <span className="font-medium text-foreground">预期收益：</span>
                            <span className="font-medium text-green-600">{recommendations?.[recommendedRisk]?.expectedReturn?.toFixed(1) ?? 0}%</span>/年。
                            简单说，投入10万，一年后大约有 <span className="font-medium text-green-600">{((recommendations?.[recommendedRisk]?.expectedReturn ?? 0) / 100 * 10).toFixed(1)}万</span> 收益。
                          </div>
                          
                          <div>
                            <span className="font-medium text-foreground">达成时间：</span>
                            约 <span className="font-medium">{Math.round((recommendations?.[recommendedRisk]?.targetMonths ?? 0) / 12)}年{((recommendations?.[recommendedRisk]?.targetMonths ?? 0) % 12)}个月</span>。
                            就像种树，需要时间才能长成参天大树。
                          </div>
                          
                          <div>
                            <span className="font-medium text-foreground">资产增长：</span>
                            从 <span className="font-medium">¥{((recommendations?.[recommendedRisk]?.targetAmount ?? 0) / 10000).toFixed(0)}万</span> 到 <span className="font-medium text-green-600">¥{((recommendations?.[recommendedRisk]?.expectedFinalAmount ?? 0) / 10000).toFixed(1)}万</span>。
                            就像滚雪球，越滚越大。
                          </div>
                        </div>
                      </div>
                      
                      {/* 总结 - 简化 */}
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-xs text-muted-foreground/90 italic leading-relaxed">
                          💬 {recommendedRisk === "low" 
                            ? "这个方案就像稳健的储蓄罐，安全可靠，适合追求稳定的您。"
                              : recommendedRisk === "medium"
                            ? "这个方案就像平衡的跷跷板，在风险和收益之间找到了最佳平衡点。"
                            : "这个方案就像高速列车，收益高但需要您能承受颠簸。"}
                        </p>
                      </div>
                    </div>
                  </div>
                  )}
                  
                </div>
              )}
            {/* 专业指标 - 只在专业版显示 */}
            {viewMode === "professional" && (
              <>
                {/* 风险评分和因子 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BarChart3 className="w-3 h-3" />
                    风险评分
                  </div>
                  <div className="text-base sm:text-lg font-bold text-primary">
                    {((recommendations?.[recommendedRisk]?.riskScore ?? 0) * 100).toFixed(0)}
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${((recommendations?.[recommendedRisk]?.riskScore ?? 0) * 100)}%` }}
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
                    {(recommendations?.[recommendedRisk]?.expectedReturn ?? 0).toFixed(1)}%
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
                    {(recommendations?.[recommendedRisk]?.sharpeRatio ?? 0).toFixed(2)}
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
                    {(recommendations?.[recommendedRisk]?.volatility ?? 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">预期波动</div>
                  <div className="text-xs text-muted-foreground/80">资产价格可能的波动范围</div>
                </div>
              </div>

              {/* 风险因子详情 */}
              {recommendations?.[recommendedRisk]?.riskFactors && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-muted-foreground">风险评估因子</div>
                    <div className="text-xs text-muted-foreground/70">基于多因子模型计算</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(recommendations?.[recommendedRisk]?.riskFactors || {}).map(([key, value]) => {
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
              {recommendations?.[recommendedRisk]?.assetAllocation && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-muted-foreground">推荐资产配置</div>
                    <div className="text-xs text-muted-foreground/70">基于现代投资组合理论</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">债券</span>
                        <span className="font-medium">{((recommendations?.[recommendedRisk]?.assetAllocation.bonds ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${(recommendations?.[recommendedRisk]?.assetAllocation.bonds ?? 0) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground/70">稳健收益</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">股票</span>
                        <span className="font-medium">{((recommendations?.[recommendedRisk]?.assetAllocation.stocks ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${(recommendations?.[recommendedRisk]?.assetAllocation.stocks ?? 0) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground/70">成长潜力</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">现金</span>
                        <span className="font-medium">{((recommendations?.[recommendedRisk]?.assetAllocation.cash ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-gray-400 h-2 rounded-full transition-all"
                          style={{ width: `${(recommendations?.[recommendedRisk]?.assetAllocation.cash ?? 0) * 100}%` }}
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
                    <div className="font-semibold text-sm">¥{((recommendations?.[recommendedRisk]?.targetAmount ?? 0) / 10000).toFixed(0)}万</div>
                    <div className="text-xs text-muted-foreground/70">您设定的理财目标</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">预期最终金额</div>
                    <div className="font-semibold text-sm text-green-600">
                      ¥{((recommendations?.[recommendedRisk]?.expectedFinalAmount ?? 0) / 10000).toFixed(1)}万
                    </div>
                    <div className="text-xs text-muted-foreground/70">考虑复利后的预期金额</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">预计时间</div>
                    <div className="font-semibold text-sm">{recommendations?.[recommendedRisk]?.targetMonths ?? 0}个月</div>
                    <div className="text-xs text-muted-foreground/70">约{Math.round((recommendations?.[recommendedRisk]?.targetMonths ?? 0) / 12)}年{((recommendations?.[recommendedRisk]?.targetMonths ?? 0) % 12)}个月</div>
                  </div>
                </div>
                {recommendations?.[recommendedRisk]?.maxDrawdown && (
                  <div className="mt-3 pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">最大回撤风险</span>
                      <span className="font-medium text-orange-600">{(recommendations?.[recommendedRisk]?.maxDrawdown ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      在极端市场情况下，资产可能出现的最大跌幅
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </Card>
          </>
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

        {/* Path Carousel */}
        <div className="mb-4 sm:mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">理财路径</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevPath}
                disabled={isLoading || paths.length <= 1}
                className="h-9 w-9"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPath}
                disabled={isLoading || paths.length <= 1}
                className="h-9 w-9"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {visiblePath && (
            <Card
              key={visiblePath.id}
              className={`p-3 sm:p-4 md:p-5 transition-all duration-300 relative ${
                selectedPath?.id === visiblePath.id
                  ? "ring-2 ring-primary shadow-xl scale-[1.01]"
                  : "hover:shadow-lg"
              } ${visiblePath.riskLevel === recommendedRisk ? "border-primary/50" : ""}`}
            >
              {visiblePath.riskLevel === recommendedRisk && (
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                  <Sparkles className="w-3 h-3" />
                  AI推荐
                </div>
              )}

              {/* Icon and Name */}
              <div className="flex items-start gap-2 sm:gap-2.5 mb-2.5 sm:mb-3">
                <div
                  className={`p-1.5 sm:p-2 rounded-xl flex-shrink-0 ${
                    visiblePath.riskLevel === "low"
                      ? "bg-chart-3/10 text-chart-3"
                      : visiblePath.riskLevel === "medium"
                        ? "bg-chart-2/10 text-chart-2"
                        : "bg-chart-1/10 text-chart-1"
                  }`}
                >
                  {React.cloneElement(visiblePath.icon as React.ReactElement<any>, {
                    className: "w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7",
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold mb-0.5">{visiblePath.name}</h3>
                  <p className="text-xs text-muted-foreground">{visiblePath.description}</p>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="space-y-2 mb-2.5 sm:mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">月存金额</span>
                  <span className="text-sm sm:text-base font-bold">¥{visiblePath.monthlySave.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">预期年化收益</span>
                  <span className="text-sm sm:text-base font-bold text-chart-1">{visiblePath.expectedReturn}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">预计实现时间</span>
                  <span className="text-sm sm:text-base font-bold">{visiblePath.targetMonths}个月</span>
                </div>
              </div>

              {/* Risk Level */}
              <div className="mb-2.5 sm:mb-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-muted-foreground">风险等级</span>
                  <span className="text-xs font-medium capitalize">{visiblePath.riskLevel}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getRiskColor(visiblePath.riskLevel)} transition-all`}
                    style={{
                      width: visiblePath.riskLevel === "low" ? "33%" : visiblePath.riskLevel === "medium" ? "66%" : "100%",
                    }}
                  />
                </div>
              </div>

              {/* 微众银行真实理财产品 */}
              <div className="mb-2.5 sm:mb-3 pt-2 border-t border-border/30">
                <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <span className="text-[10px]">🏦</span>
                  微众银行真实理财产品
                </div>
                <div className="space-y-2">
                  {visiblePath.riskLevel === "low" && (
                    <>
                      <div className="bg-background/50 rounded-lg p-2 border border-border/50">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">微众银行+活期+</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">灵活申赎</div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-sm font-bold text-red-500">2.71%</div>
                            <div className="text-[10px] text-muted-foreground">年化收益</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">较低风险 | 1元起购</div>
                      </div>
                      <div className="bg-background/50 rounded-lg p-2 border border-border/50">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">微众银行+定期+</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">3个月定期</div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-sm font-bold text-red-500">3.20%</div>
                            <div className="text-[10px] text-muted-foreground">年化收益</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">较低风险 | 1000元起购</div>
                      </div>
                    </>
                  )}
                  {visiblePath.riskLevel === "medium" && (
                    <>
                      <div className="bg-background/50 rounded-lg p-2 border border-border/50">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">微众银行+稳健+</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">混合型理财</div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-sm font-bold text-red-500">4.50%</div>
                            <div className="text-[10px] text-muted-foreground">年化收益</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">中等风险 | 1元起购</div>
                      </div>
                      <div className="bg-background/50 rounded-lg p-2 border border-border/50">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">微众银行+平衡+</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">6个月持有</div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-sm font-bold text-red-500">4.80%</div>
                            <div className="text-[10px] text-muted-foreground">年化收益</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">中等风险 | 1元起购</div>
                      </div>
                    </>
                  )}
                  {visiblePath.riskLevel === "high" && (
                    <>
                      <div className="bg-background/50 rounded-lg p-2 border border-border/50">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">微众银行+成长+</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">股票型理财</div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-sm font-bold text-red-500">7.50%</div>
                            <div className="text-[10px] text-muted-foreground">年化收益</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">较高风险 | 1元起购</div>
                      </div>
                      <div className="bg-background/50 rounded-lg p-2 border border-border/50">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">微众银行+进取+</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">混合型理财</div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-sm font-bold text-red-500">8.20%</div>
                            <div className="text-[10px] text-muted-foreground">年化收益</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">较高风险 | 1元起购</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-2 italic">
                  * 以上为微众银行真实理财产品，收益率仅供参考，实际收益以产品公告为准
                </div>
              </div>

              {/* Select Button */}
              <Button
                className="w-full h-9 sm:h-10 text-xs sm:text-sm active:scale-95"
                variant={selectedPath?.id === visiblePath.id ? "default" : visiblePath.riskLevel === recommendedRisk ? "default" : "outline"}
                disabled={isLoading}
                onClick={() => !isLoading && handleSelectPath(visiblePath)}
              >
                {selectedPath?.id === visiblePath.id && isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    生成故事中...
                  </>
                ) : selectedPath?.id === visiblePath.id ? (
                  "已选择"
                ) : visiblePath.riskLevel === recommendedRisk ? (
                  "选择推荐路径"
                ) : (
                  "选择此路径"
                )}
              </Button>
            </Card>
          )}
        </div>

        {/* Info Box */}
        <Card className="p-3 sm:p-4 bg-accent/10 border-accent/20">
          <div className="flex gap-2 sm:gap-2.5">
            <TrendingUp className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold mb-0.5 text-xs sm:text-sm flex items-center gap-2">
                关于AI推荐
                <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">千人千面</span>
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">✨ 个性化推荐：</span>
                我们的AI模型采用机器学习增强的多因子决策算法，深度分析您的
                <span className="font-medium">资产水平（{financialData?.currentAsset ? (financialData.currentAsset / 10000).toFixed(1) : 0}万）</span>、
                <span className="font-medium">月收入（{financialData?.monthlyIncome ? (financialData.monthlyIncome / 1000).toFixed(1) : 0}千）</span>、
                <span className="font-medium">理财目标（{financialData?.goal || "未设置"}）</span> 等多维度因子，
                为您计算出专属的风险评分和推荐方案。每个用户的推荐都不同，真正做到千人千面。
                选择路径后，AI将生成一个专属于您的财务故事，展示从现在到实现目标的完整旅程。
              </p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* 可拖拽的语音助手浮动按钮 */}
      <DraggableButton
        position={buttonPosition}
        onPositionChange={setButtonPosition}
        isDragging={isDragging}
        onDraggingChange={setIsDragging}
      />
    </div>
  )
}
