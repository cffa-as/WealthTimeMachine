import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { goal, currentAsset, monthlyIncome, selectedPath } = body

    // In a real implementation, this would call DeepSeek API
    // For now, we return a mock response structure

    // This is where you would integrate with DeepSeek:
    // const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    //   },
    //   body: JSON.stringify({
    //     model: 'deepseek-chat',
    //     messages: [
    //       {
    //         role: 'system',
    //         content: '你是一个专业的财务故事讲述者...'
    //       },
    //       {
    //         role: 'user',
    //         content: `生成财务故事，目标：${goal}，资产：${currentAsset}...`
    //       }
    //     ]
    //   })
    // })

    return NextResponse.json({
      success: true,
      message: "故事生成成功（当前使用本地生成，可接入DeepSeek API）",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "生成故事失败" }, { status: 500 })
  }
}
