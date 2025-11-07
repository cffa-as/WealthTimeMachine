interface FinancialData {
  goal: string
  currentAsset: number
  monthlyIncome: number
}

interface Path {
  id: number
  name: string
  monthlySave: number
  expectedReturn: number
  targetMonths: number
  riskLevel: string
}

interface Chapter {
  title: string
  content: string
  data?: Record<string, any>
  timeline?: Array<{ date: string; event: string }>
  imageQuery?: string
}

export function generateStory(financialData: FinancialData, selectedPath: Path) {
  const { goal, currentAsset, monthlyIncome } = financialData
  const { name, monthlySave, expectedReturn, targetMonths, riskLevel } = selectedPath

  // Calculate target amount (simplified)
  const targetAmount = currentAsset + monthlySave * targetMonths * (1 + expectedReturn / 100 / 12)

  // Determine goal type
  const goalType = goal.includes("买房")
    ? "house"
    : goal.includes("买车")
      ? "car"
      : goal.includes("教育")
        ? "education"
        : goal.includes("自由")
          ? "freedom"
          : "general"

  // Generate chapters based on goal type and path
  const chapters: Chapter[] = [
    generateChapter1(financialData, targetAmount, goalType),
    generateChapter2(selectedPath, goalType),
    generateChapter3(selectedPath, targetMonths, goalType),
    generateChapter4(financialData, selectedPath, targetAmount, goalType),
    generateChapter5(goalType),
  ]

  return { chapters }
}

function generateChapter1(data: FinancialData, targetAmount: number, goalType: string): Chapter {
  const assetLevel = data.currentAsset < 50000 ? "low" : data.currentAsset < 200000 ? "medium" : "high"

  let content = ""
  let imageQuery = ""

  if (assetLevel === "low") {
    content = `你坐在出租屋里，打开手机银行，看着账户里的${(data.currentAsset / 10000).toFixed(1)}万元。这是你工作以来，一点一滴攒下的积蓄。

你想起了自己的目标：${data.goal}。这个梦想看起来有些遥远，但你知道，每一个伟大的旅程都始于第一步。

你的月收入是${data.monthlyIncome.toLocaleString()}元，虽然不算很高，但你相信，只要有计划、有坚持，梦想终会实现。

你打开了"财务时光机"，输入了自己的目标。AI告诉你：要实现这个目标，你需要准备约${(targetAmount / 10000).toFixed(0)}万元。

这个数字让你有点紧张，但更多的是期待。因为你知道，从今天开始，你的人生将翻开新的一页。`
    imageQuery =
      "cartoon style illustration of a young person sitting in a cozy apartment room, looking at phone with banking app, warm lighting, hopeful expression, simple furniture, dreamy atmosphere"
  } else if (assetLevel === "medium") {
    content = `周末的下午，你坐在咖啡厅里，一边喝着拿铁，一边思考着未来。

账户里的${(data.currentAsset / 10000).toFixed(1)}万元，是你这几年努力工作的成果。你的月收入${data.monthlyIncome.toLocaleString()}元，生活算是稳定，但你知道，这还不够。

你有一个更大的目标：${data.goal}。

你打开"财务时光机"，认真地输入了自己的信息。AI分析后告诉你：要实现这个目标，你需要准备约${(targetAmount / 10000).toFixed(0)}万元。

你算了算，如果按照现在的存钱速度，可能需要很长时间。但你不想等那么久，你想要一个更清晰、更高效的计划。

今天，就是改变的开始。`
    imageQuery =
      "cartoon style illustration of a person sitting in a modern cafe with laptop and coffee, thoughtful expression, bright natural lighting, plants in background, planning future"
  } else {
    content = `你站在落地窗前，俯瞰着城市的夜景。账户里的${(data.currentAsset / 10000).toFixed(1)}万元，是你多年积累的财富。

但你知道，财富不应该只是躺在账户里的数字，它应该为你的梦想服务。

你的目标是：${data.goal}。这不仅仅是一个财务目标，更是你对未来生活的期待。

你打开"财务时光机"，输入了自己的信息。AI告诉你：要实现这个目标，你需要准备约${(targetAmount / 10000).toFixed(0)}万元。

凭借你现在的资产基础和月收入${data.monthlyIncome.toLocaleString()}元，这个目标完全可以实现。关键是，你需要一个科学的资产配置方案。

是时候让财富为梦想加速了。`
    imageQuery =
      "cartoon style illustration of a successful person standing by floor-to-ceiling window overlooking city skyline at night, confident posture, modern office or apartment, inspiring view"
  }

  return {
    title: "第1章：现在的你",
    content,
    imageQuery,
    data: {
      currentAsset: data.currentAsset,
      targetAmount: Math.round(targetAmount),
      progress: data.currentAsset / targetAmount,
    },
  }
}

function generateChapter2(path: Path, goalType: string): Chapter {
  const pathStyle = path.riskLevel === "low" ? "conservative" : path.riskLevel === "medium" ? "balanced" : "aggressive"

  let content = ""
  let imageQuery = ""

  if (pathStyle === "conservative") {
    content = `面对三条不同的路径，你选择了${path.name}。

你知道自己的性格：稳重、谨慎，不喜欢冒险。你更愿意用时间换取安全感，而不是用风险换取速度。

${path.name}意味着：每月存${path.monthlySave.toLocaleString()}元，主要投资于低风险的理财产品，预期年化收益${path.expectedReturn}%。

虽然收益不是最高的，但你知道，这条路最适合你。因为在实现梦想的路上，最重要的不是跑得最快，而是跑到终点。

你深吸一口气，点击了"确认"。从今天开始，你的财务计划正式启动。`
    imageQuery =
      "cartoon style illustration of a person standing at a crossroads with three paths, choosing the safe steady path, protective shield symbol, calm colors, thoughtful decision-making scene"
  } else if (pathStyle === "balanced") {
    content = `三条路径摆在你面前，你选择了${path.name}。

你不是一个极端的人。你既不想过于保守错失机会，也不想过于激进承担太大风险。你相信，最好的策略是在风险和收益之间找到平衡。

${path.name}意味着：每月存${path.monthlySave.toLocaleString()}元，采用"稳健+成长"的组合投资策略，预期年化收益${path.expectedReturn}%。

这个方案让你感到舒适。它既有稳定的基础，又有成长的空间。就像人生一样，需要在稳定和冒险之间找到最佳平衡点。

你点击了"确认"，心中充满期待。`
    imageQuery =
      "cartoon style illustration of a person balancing on a scale with stability and growth symbols, harmonious colors, confident expression, balanced composition showing wisdom"
  } else {
    content = `看着三条路径，你毫不犹豫地选择了${path.name}。

你知道自己还年轻，有足够的时间和能力承担风险。与其慢慢积累，不如大胆一搏。你相信，高风险才能带来高回报。

${path.name}意味着：每月存${path.monthlySave.toLocaleString()}元，主要投资于股票、基金等高成长性资产，预期年化收益${path.expectedReturn}%。

这个方案让你兴奋。虽然路上可能会有波动，但你相信，只要方向正确，短期的波动都不是问题。

你坚定地点击了"确认"。年轻就是最大的资本，是时候为梦想加速了！`
    imageQuery =
      "cartoon style illustration of a determined person running on an upward trending arrow path, dynamic pose, energetic colors, rocket or growth symbols, ambitious and bold atmosphere"
  }

  return {
    title: "第2章：做出选择",
    content,
    imageQuery,
    data: {
      monthlySave: path.monthlySave,
      expectedReturn: path.expectedReturn / 100,
      targetDate: `${path.targetMonths}个月后`,
    },
  }
}

function generateChapter3(path: Path, targetMonths: number, goalType: string): Chapter {
  const midPoint = Math.floor(targetMonths / 2)
  const currentDate = new Date()

  const timeline = [
    {
      date: formatDate(addMonths(currentDate, 0)),
      event: "开始执行财务计划",
    },
    {
      date: formatDate(addMonths(currentDate, Math.floor(targetMonths * 0.25))),
      event: "第一个季度，养成储蓄习惯",
    },
    {
      date: formatDate(addMonths(currentDate, midPoint)),
      event: "完成一半进度，资产稳步增长",
    },
    {
      date: formatDate(addMonths(currentDate, Math.floor(targetMonths * 0.75))),
      event: "进入冲刺阶段，目标越来越近",
    },
  ]

  let content = ""
  let imageQuery = ""

  if (path.riskLevel === "low") {
    content = `时间一个月一个月地过去。

每个月发工资的那天，你都会第一时间转出${path.monthlySave.toLocaleString()}元到理财账户。这已经成为了你的习惯，就像呼吸一样自然。

第${Math.floor(targetMonths * 0.3)}个月，你的朋友约你去旅游，你犹豫了一下，还是拒绝了。你知道，每一次消费都是在延迟梦想的实现。

第${midPoint}个月，你打开账户，发现资产已经增长了不少。虽然增长速度不快，但每一分钱都是实实在在的，这让你感到踏实。

市场偶尔会有波动，但因为你选择的是稳健型投资，波动对你的影响很小。你继续坚持着，一步一个脚印。

第${Math.floor(targetMonths * 0.75)}个月，你发现目标已经近在眼前。你开始研究${goalType === "house" ? "房源信息" : goalType === "car" ? "车型配置" : "具体实施方案"}，为最后的冲刺做准备。`
    imageQuery =
      "cartoon style illustration of a person climbing steady steps up a mountain, progress bar filling up, calendar pages flying, determined expression, steady pace, encouraging atmosphere"
  } else if (path.riskLevel === "medium") {
    content = `计划开始执行了。

每个月，你都会准时存入${path.monthlySave.toLocaleString()}元。你采用的是"稳健+成长"的组合策略，一部分资金投资于稳定的理财产品，另一部分投资于成长性资产。

第${Math.floor(targetMonths * 0.2)}个月，市场出现了一次小幅下跌。你的账户从增长转为小幅亏损。你有点紧张，但你记得AI的建议："短期波动是正常的，关键是长期趋势。"你选择了坚持。

第${midPoint}个月，市场回暖，你的账户不仅收复了失地，还创了新高。你开始理解什么叫"风险和收益并存"。

你继续坚持着每月的储蓄计划。有时候会想放弃，但每次打开"财务时光机"，看到自己的进度条在不断前进，你就又有了动力。

第${Math.floor(targetMonths * 0.8)}个月，你发现自己已经完成了80%的目标。你开始认真规划${goalType === "house" ? "买房" : goalType === "car" ? "买车" : "实现目标"}的具体步骤。`
    imageQuery =
      "cartoon style illustration of a person navigating through ups and downs on a wavy path, showing resilience, chart with fluctuations in background, perseverance theme, hopeful colors"
  } else {
    content = `这是一段充满刺激的旅程。

每个月，你都会投入${path.monthlySave.toLocaleString()}元到高成长性资产中。你知道这意味着更大的波动，但你已经做好了心理准备。

第${Math.floor(targetMonths * 0.15)}个月，市场大跌。你的账户从盈利10%变成了亏损5%。你的朋友劝你赶紧止损，但你选择了加仓。你相信，危机就是机会。

第${Math.floor(targetMonths * 0.4)}个月，市场反弹，你的账户收益率达到了25%。你的坚持得到了回报。你开始理解什么叫"高风险高收益"。

第${midPoint}个月，你的资产已经超过了预期进度。你没有因此放松，反而更加专注。你知道，市场随时可能变化，只有坚持到最后才能真正胜利。

期间经历了几次大的波动，但你都挺过来了。你发现，最大的敌人不是市场，而是自己的情绪。

第${Math.floor(targetMonths * 0.85)}个月，你发现目标已经触手可及。你开始为${goalType === "house" ? "买房" : goalType === "car" ? "买车" : "实现梦想"}做最后的准备。`
    imageQuery =
      "cartoon style illustration of a person riding a roller coaster of market ups and downs, exciting and dynamic, showing courage and determination, vibrant energetic colors, thrilling journey"
  }

  return {
    title: "第3章：坚持的路上",
    content,
    imageQuery,
    timeline,
  }
}

function generateChapter4(data: FinancialData, path: Path, targetAmount: number, goalType: string): Chapter {
  const finalAsset = Math.round(targetAmount * 1.05)
  const achievedEarly = path.riskLevel === "high"

  let content = ""
  let imageQuery = ""

  if (goalType === "house") {
    content = `第${path.targetMonths}个月，你终于攒够了首付。

那天，你站在售楼处，手里拿着银行卡，心情既激动又紧张。从${(data.currentAsset / 10000).toFixed(1)}万到${(finalAsset / 10000).toFixed(1)}万，从一个模糊的梦想到一个具体的地址，你用了${path.targetMonths}个月。

签约的那一刻，你想起了这${path.targetMonths}个月的点点滴滴：每个月准时的储蓄、市场波动时的坚持、朋友聚会时的克制...

现在，这一切都值得了。

你站在新房的阳台上，看着窗外的风景。这个小小的空间，承载着你的梦想和努力。你明白了：财务规划不是限制生活，而是让生活更有方向。

更重要的是，你学会了一种能力：把梦想变成计划，把计划变成现实。`
    imageQuery =
      "cartoon style illustration of a happy person standing on balcony of new home, holding keys, beautiful view, warm sunset lighting, achievement and joy, dream come true atmosphere"
  } else if (goalType === "car") {
    content = `第${path.targetMonths}个月，你走进了4S店。

销售顾问问你："全款还是贷款？"你微笑着说："全款。"

从${(data.currentAsset / 10000).toFixed(1)}万到${(finalAsset / 10000).toFixed(1)}万，你用了${path.targetMonths}个月。这${path.targetMonths}个月里，你每次路过4S店都会停下来看看，想象着自己开着新车的样子。

现在，梦想成真了。

提车的那天，你坐在驾驶座上，双手握着方向盘，感受着新车的气息。这不仅仅是一辆车，更是你努力的证明。

你发动引擎，驶向回家的路。你知道，这只是开始。有了这次经验，你可以实现更多的梦想。`
    imageQuery =
      "cartoon style illustration of a proud person sitting in driver seat of new car, holding steering wheel, excited smile, shiny new car interior, accomplishment and freedom theme"
  } else if (goalType === "education") {
    content = `第${path.targetMonths}个月，你终于攒够了教育基金。

你打开银行账户，看着那个数字：${(finalAsset / 10000).toFixed(1)}万元。这是你为孩子准备的未来。

从${(data.currentAsset / 10000).toFixed(1)}万到${(finalAsset / 10000).toFixed(1)}万，你用了${path.targetMonths}个月。这${path.targetMonths}个月里，你减少了很多不必要的开支，把每一分钱都用在刀刃上。

现在，你可以自信地告诉孩子："无论你想学什么，爸爸/妈妈都能支持你。"

你明白了，最好的爱不是给孩子留下多少钱，而是教会他们如何规划人生、实现梦想。`
    imageQuery =
      "cartoon style illustration of a parent and child looking at bright future together, books and graduation cap symbols, warm family atmosphere, hope and love, educational theme"
  } else if (goalType === "freedom") {
    content = `第${path.targetMonths}个月，你的资产达到了${(finalAsset / 10000).toFixed(1)}万元。

这个数字，意味着你有了更多的选择权。你可以选择继续工作，也可以选择暂时休息；可以选择稳定的生活，也可以选择冒险创业。

从${(data.currentAsset / 10000).toFixed(1)}万到${(finalAsset / 10000).toFixed(1)}万，你用了${path.targetMonths}个月。这${path.targetMonths}个月的经历，让你明白了什么是真正的财务自由。

财务自由不是不工作，而是有选择的权利；不是挥霍无度，而是不为钱发愁。

你打开窗户，深呼吸。你知道，人生的新篇章，才刚刚开始。`
    imageQuery =
      "cartoon style illustration of a liberated person with arms spread wide on mountain top, birds flying, sunrise, freedom and possibilities, inspiring landscape, achievement of independence"
  } else {
    content = `第${path.targetMonths}个月，你实现了自己的目标。

账户里的${(finalAsset / 10000).toFixed(1)}万元，是你${path.targetMonths}个月努力的成果。从${(data.currentAsset / 10000).toFixed(1)}万到${(finalAsset / 10000).toFixed(1)}万，你证明了：只要有计划、有坚持，梦想就能实现。

这${path.targetMonths}个月的经历，改变的不仅仅是你的资产数字，更是你的思维方式。你学会了：

- 把梦想转化为具体的数字和计划
- 在诱惑面前保持定力
- 在波动中保持冷静
- 相信时间的力量

现在，你站在新的起点上。你知道，这只是开始，未来还有更多的梦想等着你去实现。`
    imageQuery =
      "cartoon style illustration of a victorious person reaching the summit with flag, celebrating achievement, trophy or medal, success symbols, triumphant and joyful atmosphere"
  }

  return {
    title: "第4章：实现目标",
    content,
    imageQuery,
    data: {
      finalAsset,
      targetAmount: Math.round(targetAmount),
      achievedEarly,
      monthsEarly: achievedEarly ? 2 : 0,
    },
  }
}

function generateChapter5(goalType: string): Chapter {
  const content = `故事到这里，似乎应该结束了。

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

你的故事，未完待续...`

  const imageQuery =
    "cartoon style illustration of a person standing at a new starting line with multiple paths ahead, sunrise or dawn, open book transforming into a bright future, hope and endless possibilities"

  return {
    title: "尾声：新的开始",
    content,
    imageQuery,
    data: {
      nextGoal: "设定你的下一个目标",
    },
  }
}

// Helper functions
function addMonths(date: Date, months: number): Date {
  const newDate = new Date(date)
  newDate.setMonth(newDate.getMonth() + months)
  return newDate
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}
