from openai import OpenAI
import json
import re
import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()


class ClaudeService:
    def __init__(self):
        self.client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com/v1",
        )
        self.model = "deepseek-chat"

    def analyze_resume(self, text: str) -> dict:
        system_prompt = """你是一位资深 HR 顾问和简历评估专家。请仔细分析简历并返回结构化 JSON。
只返回 JSON，不要任何其他文字。

返回如下字段：
{
  "industry": "所属行业（中文，如：服装零售/品牌营销、互联网产品、金融科技）",
  "current_location": "简历中提到的当前所在城市（如：杭州、上海，若未提及写空字符串）",
  "seniority_level": "职级，只能是以下之一：Junior / Mid-level / Senior / Lead / Executive",
  "resume_quality_score": 综合评分（1-10的数字，精确到0.1）,
  "score_breakdown": {
    "experience": 工作经历丰富度评分（1-10）,
    "skills": 技能匹配度评分（1-10）,
    "achievements": 成果量化程度评分（1-10）,
    "presentation": 简历表达规范度评分（1-10）
  },
  "key_skills": ["核心技能1", "核心技能2", "核心技能3", ...最多8个],
  "years_experience": 工作年限（数字）,
  "summary": "2-3句话的职业概述（中文）",
  "strengths": ["优势亮点1", "优势亮点2", "优势亮点3"],
  "weaknesses": ["待改进项1", "待改进项2"],
  "suggestions": ["具体改进建议1", "具体改进建议2", "具体改进建议3"]
}

评分标准：
- 8-10分：经验丰富、成果突出、可冲击大厂
- 6-7.9分：中等水平，有竞争力，适合中型企业
- 1-5.9分：经验或表达有明显短板，建议先加强
strengths/weaknesses/suggestions 需针对简历具体内容，不要泛泛而谈。"""

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"请分析以下简历：\n\n{text}"},
            ],
        )

        response_text = response.choices[0].message.content.strip()
        if response_text.startswith("```"):
            response_text = re.sub(r"^```(?:json)?\n?", "", response_text)
            response_text = re.sub(r"\n?```$", "", response_text)

        result = json.loads(response_text)
        breakdown = result.get("score_breakdown", {})

        return {
            "industry": result.get("industry", "Unknown"),
            "current_location": result.get("current_location", ""),
            "seniority_level": result.get("seniority_level", "Mid-level"),
            "resume_quality_score": float(result.get("resume_quality_score", 5.0)),
            "score_breakdown": {
                "experience": float(breakdown.get("experience", 5)),
                "skills": float(breakdown.get("skills", 5)),
                "achievements": float(breakdown.get("achievements", 5)),
                "presentation": float(breakdown.get("presentation", 5)),
            },
            "key_skills": result.get("key_skills", []),
            "years_experience": float(result.get("years_experience", 0)),
            "summary": result.get("summary", ""),
            "strengths": result.get("strengths", []),
            "weaknesses": result.get("weaknesses", []),
            "suggestions": result.get("suggestions", []),
        }

    def chat_onboarding(self, messages: List[Dict[str, str]], resume_summary: Optional[Dict[str, Any]] = None) -> str:
        resume_context = ""
        if resume_summary:
            current_location = resume_summary.get('current_location', '')
            city_hint = f"\n- 当前所在城市（从简历中提取）：{current_location}" if current_location else ""
            resume_context = f"""
求职者的简历已分析完毕：
- 行业：{resume_summary.get('industry', '未知')}
- 职级：{resume_summary.get('seniority_level', '未知')}
- 工作年限：{resume_summary.get('years_experience', 0)} 年
- 核心技能：{', '.join(resume_summary.get('key_skills', []))}
- 简历综合评分：{resume_summary.get('resume_quality_score', 5)} / 10
- 简历摘要：{resume_summary.get('summary', '')}
{city_hint}

薪资建议参考（你需要根据行业、职级、工作年限和评分自行估算合理区间，供提问时使用）：
- 评分 8+、Senior 及以上：年薪通常在 40-80 万区间
- 评分 6-8、Mid-level：年薪通常在 20-45 万区间
- 评分 5 以下、Junior：年薪通常在 10-20 万区间
- 以上为参考基线，需结合具体行业和城市做调整
"""

        system_prompt = f"""你是一个专业、亲切的 AI 求职助手，正在帮助求职者设置求职偏好。你需要通过自然对话收集以下 6 项信息：

1. target_cities（目标城市）：希望工作的城市，可多选
2. salary（薪资期望）：期望的年薪范围（最低和最高，单位：元/年）
3. work_type（工作方式）：全职到岗 / 完全远程 / 弹性混合
4. blacklist_companies（屏蔽公司）：不想投递的公司，没有可跳过
5. blacklist_industries（屏蔽行业）：想回避的行业，没有可跳过
6. extra_notes（其他需求）：其他特殊要求，没有可跳过

{resume_context}

对话规则：
- 用中文交流，语气亲切自然，不要机械照本宣科
- 每次只问 1-2 个问题，不要一次全问
- 对用户的回答给予简短的认可后再继续
- 回答模糊时适当追问
- 每次回复末尾必须附上当前收集进度（JSON 格式），放在 <progress> 标签内

⚠️ 进度追踪极其重要：
- 每次生成 <progress> 前，必须先回顾**完整的对话历史**，统计所有已明确收集到答案的字段
- collected 是**累计列表**，只增不减，不能因为本轮没问某字段就把它从 collected 里移除
- 只要用户在任何一轮回复中给出了某字段的答案，该字段就应加入 collected
- pending = 6个字段全集 - collected

进度 JSON 格式：
<progress>
{{"collected": ["target_cities", "salary"], "pending": ["work_type", "blacklist_companies", "blacklist_industries", "extra_notes"], "current_topic": "work_type"}}
</progress>

- collected：整个对话至今已收集的字段（累计，不可减少）
- pending：尚未收集的字段
- current_topic：本轮正在询问的字段名

⚠️ 触发完成的规则（非常重要）：
只要 collected 列表中已包含全部 6 个字段，无论用户说什么（包括"好"、"可以"、"谢谢"等简短确认），都必须立即在本条回复末尾同时输出 <progress> 和 <preferences>。不需要等待用户二次确认，不需要再次总结。

当所有 6 项信息都收集完毕（或用户明确表示跳过某些项）后，立即在同一条回复中做总结，并在末尾附上：

<preferences>
{{
  "target_cities": ["城市1", "城市2"],
  "salary_min": 200000,
  "salary_max": 300000,
  "work_type": "hybrid",
  "blacklist_companies": [],
  "blacklist_industries": [],
  "extra_notes": "其他补充"
}}
</preferences>

对话中关于薪资的提问规则（重要）：
- 不要直接让用户填薪资，而是先根据简历的行业、职级、工作年限、评分和目标城市，主动给出一个建议区间
- 表达方式示例："根据你的经验和背景，我估计市场薪资大概在 XX-XX 万/年，你觉得这个范围合适吗？还是你有不同的期望？"
- 用户确认或调整后，将最终数字记录为 salary 字段

开场规则（第一条消息）：
1. 简短热情地问候用户
2. 关于目标城市：
   - 如果简历中有"当前所在城市"，则直接说"AI 检测到你目前在 XX，是否主要找 XX 的机会？也可以告诉我你还想考虑哪些城市"
   - 如果简历中没有城市信息，则直接问"请问你希望在哪些城市工作？"
3. 不要一次问超过2个问题"""

        formatted_messages = [
            {"role": "system", "content": system_prompt},
        ] + [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
        ]

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=2048,
            messages=formatted_messages,
        )

        return response.choices[0].message.content

    def generate_company_list(self, resume_summary: Dict[str, Any], preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
        quality_score = float(resume_summary.get("resume_quality_score", 5))
        industry = resume_summary.get("industry", "")
        cities = preferences.get("target_cities", [])
        salary_max = preferences.get("salary_max")
        blacklist = preferences.get("blacklist_companies", [])
        blacklist_industries = preferences.get("blacklist_industries", [])

        if quality_score >= 7.5:
            company_tier = "头部大厂和知名上市公司（如行业龙头、500强等）"
        elif quality_score >= 5:
            company_tier = "中等规模公司、成长期创业公司（B轮及以上）、活跃的中小企业"
        else:
            company_tier = "活跃的初创公司、中小企业、有招聘需求的成长型企业"

        # Build city priority instruction
        if len(cities) == 0:
            city_instruction = "城市不限"
        elif len(cities) == 1:
            city_instruction = f"⚠️ 城市硬性要求：只推荐总部或主要办公地点在【{cities[0]}】的公司，不接受其他城市。"
        else:
            primary = cities[0]
            secondary = "、".join(cities[1:])
            city_instruction = (
                f"⚠️ 城市分配硬性要求：30家公司中至少20家必须总部或主要办公地点在【{primary}】，"
                f"其余最多10家可以是【{secondary}】。严格按此比例，不得随意增加其他城市。"
                f"列表中【{primary}】的公司必须排在前面。"
            )

        extra_notes = preferences.get("extra_notes", "").strip()

        # Parse hard constraints from extra_notes
        hard_constraints = ""
        if extra_notes:
            hard_constraints = f"""
⚠️ 用户额外硬性要求（必须严格遵守，违反则不得推荐该公司）：
"{extra_notes}"

请逐条解析上述要求并在筛选时严格执行。常见示例：
- "不要大公司" → 只推荐中小型企业（规模 <2000人），禁止推荐500强、上市大厂
- "不要两年以内成立的公司" → 公司成立时间必须在2年以上（即2024年前成立）
- "要双休" → 排除已知加班严重、单双休的公司
- "B轮以后" → 只推荐B轮及以上融资阶段或已上市的公司
"""

        prompt = f"""请根据以下求职者信息，推荐 30 家最合适的目标公司，并评估每家公司的发展前景。
{hard_constraints}
求职者信息：
- 行业：{industry}
- 职级：{resume_summary.get('seniority_level', '')}
- 工作年限：{resume_summary.get('years_experience', 0)} 年
- 核心技能：{', '.join(resume_summary.get('key_skills', []))}
- {city_instruction}
- 期望薪资上限：{f'{salary_max/10000:.0f}万/年' if salary_max else '不限'}
- 屏蔽公司：{', '.join(blacklist) if blacklist else '无'}
- 屏蔽行业：{', '.join(blacklist_industries) if blacklist_industries else '无'}

公司层级要求：优先推荐{company_tier}（但如果与用户额外要求冲突，以用户额外要求为准）。

请返回 JSON 数组，每个元素包含：
- name: 公司名称（中文）
- industry: 所属细分行业
- size: 公司规模（"大型 >2000人" / "中型 200-2000人" / "小型 <200人"）
- stage: 发展阶段（"上市公司" / "独角兽" / "D轮+" / "B/C轮" / "天使/A轮" / "成熟民企" / "外资"）
- city: 总部城市
- careers_url: 官网招聘页面 URL（优先使用 /careers、/jobs、/join 等标准路径；如确实不确定则写空字符串，不要乱猜）
- prospect_score: 发展前景评分 1-10
- prospect_reason: 前景评分理由（1句话）
- match_reason: 为什么推荐给该求职者（1句话）

只返回 JSON 数组，不要其他文字。"""

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=5000,
            messages=[
                {"role": "user", "content": prompt}
            ],
        )

        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        return json.loads(text)
