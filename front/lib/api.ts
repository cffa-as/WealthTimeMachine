// API配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface FinancialData {
  goal: string
  currentAsset: number
  monthlyIncome: number
}

export interface Path {
  id: number
  name: string
  monthlySave: number
  expectedReturn: number
  targetMonths: number
  riskLevel: string
}

export interface Chapter {
  title: string
  content: string
  data?: Record<string, any>
  timeline?: Array<{ date: string; event: string }>
  imageQuery?: string
}

export interface StoryResponse {
  success: boolean
  chapters: Chapter[]
  message?: string
}

export interface StoryRequest {
  goal: string
  currentAsset: number
  monthlyIncome: number
  selectedPath: Path
}

export interface RecommendationResponse {
  success: boolean
  recommendedRisk: "low" | "medium" | "high"  // 主要推荐的风险等级
  recommendations: {  // 三种风险等级的完整推荐
    low: RecommendationDetail
    medium: RecommendationDetail
    high: RecommendationDetail
  }
  message?: string
}

export interface RecommendationDetail {
  recommendedRisk: "low" | "medium" | "high"
  reason: string
  monthlySave: number
  expectedReturn: number
  targetMonths: number
  targetAmount: number
  expectedFinalAmount: number
  sharpeRatio: number
  sortinoRatio: number
  var95: number
  cvar95: number
  volatility: number
  maxDrawdown: number
  assetAllocation: {
    bonds: number
    stocks: number
    cash: number
  }
  monteCarloSimulation: {
    expectedValue: number
    median: number
    confidenceInterval5: number
    confidenceInterval95: number
    confidenceInterval: [number, number]
  }
  riskScore: number
  riskFactors: {
    asset_coverage: number
    time_pressure: number
    age_factor: number
    income_stability: number
  }
}

/**
 * 调用后端API生成故事（流式）
 */
export async function generateStoryFromAPIStream(
  financialData: FinancialData,
  selectedPath: Path,
  onChunk: (chunk: string) => void,
  onComplete: (chapters: Chapter[]) => void,
  onError: (error: string) => void,
  onImageUpdate?: (update: { type: string; chapterIndex: number; imageUrl?: string; chapterTitle?: string }) => void
): Promise<void> {
  try {
    // 先检查后端服务是否可用
    try {
      const healthCheck = await fetch(`${API_BASE_URL}/`, { method: "GET" })
      if (!healthCheck.ok) {
        throw new Error(`后端服务不可用 (${healthCheck.status})，请确保后端服务已启动在 ${API_BASE_URL}`)
      }
    } catch (healthError) {
      throw new Error(`无法连接到后端服务 (${API_BASE_URL})，请确保后端服务已启动。错误: ${healthError instanceof Error ? healthError.message : String(healthError)}`)
    }

    const response = await fetch(`${API_BASE_URL}/api/story/generate-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal: financialData.goal,
        currentAsset: financialData.currentAsset,
        monthlyIncome: financialData.monthlyIncome,
        selectedPath: selectedPath,
      }),
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`接口不存在 (404)。请检查后端路由是否正确，或后端服务是否正常运行在 ${API_BASE_URL}`)
      }
      const errorText = await response.text().catch(() => "")
      throw new Error(`HTTP错误 ${response.status}: ${errorText || response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    if (!reader) {
      throw new Error("无法读取响应流")
    }

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6))
            
                  if (data.type === "chunk") {
                    onChunk(data.content)
                  } else if (data.type === "complete") {
                    console.log("收到complete事件，章节数据:", data.chapters)
                    if (data.chapters && Array.isArray(data.chapters) && data.chapters.length > 0) {
                      onComplete(data.chapters)
                    } else {
                      console.error("章节数据格式不正确:", data)
                      onError("章节数据格式不正确")
                    }
                    // 注意：不return，继续监听图片更新事件
                  } else if (data.type === "image_generating") {
                    // 图片生成中
                    console.log("图片生成中:", data.chapterIndex, data.chapterTitle)
                    if (onImageUpdate) {
                      onImageUpdate({
                        type: "image_generating",
                        chapterIndex: data.chapterIndex,
                        chapterTitle: data.chapterTitle
                      })
                    }
                  } else if (data.type === "image_complete") {
                    // 图片生成完成
                    console.log("图片生成完成:", data.chapterIndex, data.imageUrl)
                    if (onImageUpdate) {
                      onImageUpdate({
                        type: "image_complete",
                        chapterIndex: data.chapterIndex,
                        imageUrl: data.imageUrl
                      })
                    }
                  } else if (data.type === "image_failed") {
                    // 图片生成失败
                    console.log("图片生成失败:", data.chapterIndex)
                    if (onImageUpdate) {
                      onImageUpdate({
                        type: "image_failed",
                        chapterIndex: data.chapterIndex
                      })
                    }
                  } else if (data.type === "error") {
                    console.error("收到error事件:", data.message)
                    onError(data.message)
                    return
                  } else if (data.type === "start") {
                    console.log("收到start事件:", data.message)
                  }
          } catch (e) {
            console.error("解析SSE数据失败:", e)
          }
        }
      }
    }
  } catch (error) {
    console.error("生成故事失败:", error)
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : "生成故事失败"
    onError(errorMessage)
  }
}

/**
 * 调用后端API获取理财路径推荐
 */
export async function getRecommendation(
  financialData: FinancialData
): Promise<RecommendationResponse> {
  try {
    // 先检查后端服务是否可用
    try {
      const healthCheck = await fetch(`${API_BASE_URL}/`, { method: "GET" })
      if (!healthCheck.ok) {
        throw new Error(`后端服务不可用 (${healthCheck.status})，请确保后端服务已启动在 ${API_BASE_URL}`)
      }
    } catch (healthError) {
      throw new Error(`无法连接到后端服务 (${API_BASE_URL})，请确保后端服务已启动。错误: ${healthError instanceof Error ? healthError.message : String(healthError)}`)
    }

    const response = await fetch(`${API_BASE_URL}/api/planning/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal: financialData.goal,
        currentAsset: financialData.currentAsset,
        monthlyIncome: financialData.monthlyIncome,
      }),
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`接口不存在 (404)。请检查后端路由 /api/planning/recommend 是否正确注册，或访问 ${API_BASE_URL}/docs 查看可用接口`)
      }
      const errorText = await response.text().catch(() => "")
      throw new Error(`HTTP错误 ${response.status}: ${errorText || response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("获取推荐失败:", error)
    throw error
  }
}

/**
 * 调用后端API生成故事（非流式，兼容旧接口）
 */
export async function generateStoryFromAPI(
  financialData: FinancialData,
  selectedPath: Path
): Promise<StoryResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/story/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal: financialData.goal,
        currentAsset: financialData.currentAsset,
        monthlyIncome: financialData.monthlyIncome,
        selectedPath: selectedPath,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("生成故事失败:", error)
    throw error
  }
}

/**
 * 获取支持的音色列表
 */
export async function getTTSVoices(): Promise<Record<string, { name: string; description: string; dialect: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tts/voices`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.voices || {}
  } catch (error) {
    console.error("获取音色列表失败:", error)
    throw error
  }
}

/**
 * 调用后端API生成语音（TTS）
 */
export async function generateTTS(text: string, voice?: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tts/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        voice: voice || "Cherry", // 默认使用芊悦音色
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.audio_data || data.audioData || ""
  } catch (error) {
    console.error("生成语音失败:", error)
    throw error
  }
}


