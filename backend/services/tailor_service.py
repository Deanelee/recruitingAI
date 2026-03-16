import json
import re
from typing import Dict, Any
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()


class TailorService:
    def __init__(self):
        self._client = None
        self.model = "deepseek-chat"

    @property
    def client(self):
        if self._client is None:
            self._client = OpenAI(
                api_key=os.getenv("DEEPSEEK_API_KEY"),
                base_url="https://api.deepseek.com/v1",
            )
        return self._client

    def _call(self, prompt: str, max_tokens: int = 2000) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        return text

    def tailor_resume(
        self,
        resume_raw_text: str,
        job_title: str,
        company_name: str,
        job_description: str,
        job_requirements: str,
    ) -> Dict[str, Any]:
        """Analyze the resume against a specific JD and return tailoring suggestions."""

        prompt = f"""你是一位专业的简历优化顾问。请分析以下简历和职位描述，给出针对性的简历优化建议。

【求职者简历原文】
{resume_raw_text[:4000]}

【目标职位】
公司：{company_name}
职位：{job_title}
岗位职责：{job_description[:1500]}
任职要求：{job_requirements[:1000]}

请返回 JSON（只返回 JSON，不要其他文字）：
{{
  "tailored_summary": "针对该职位重写的个人简介（2-3句话，突出与JD最相关的经验和技能）",
  "key_highlights": ["最应突出的技能或经验1", "最应突出的技能或经验2", "最应突出的技能或经验3", "最应突出的技能或经验4"],
  "suggested_changes": [
    {{"section": "工作经历", "original": "原始描述片段", "improved": "优化后的描述", "reason": "优化原因"}},
    {{"section": "技能", "original": "原始描述片段", "improved": "优化后的描述", "reason": "优化原因"}}
  ],
  "keywords_to_add": ["JD中出现但简历中缺少的关键词1", "关键词2", "关键词3"],
  "match_tips": "一句话总结：该求职者与该岗位的匹配情况及投递建议"
}}"""

        text = self._call(prompt, max_tokens=2000)
        try:
            result = json.loads(text)
            return {
                "tailored_summary": result.get("tailored_summary", ""),
                "key_highlights": result.get("key_highlights", []),
                "suggested_changes": result.get("suggested_changes", []),
                "keywords_to_add": result.get("keywords_to_add", []),
                "match_tips": result.get("match_tips", ""),
            }
        except Exception:
            return {
                "tailored_summary": "",
                "key_highlights": [],
                "suggested_changes": [],
                "keywords_to_add": [],
                "match_tips": "简历解析失败，请手动调整",
            }

    def generate_email(
        self,
        user_name: str,
        resume_summary: Dict[str, Any],
        job_title: str,
        company_name: str,
        job_description: str,
        job_requirements: str,
    ) -> Dict[str, str]:
        """Generate a professional application email."""

        prompt = f"""你是一位职场写作专家。请为以下求职者撰写一封专业的求职邮件。

求职者信息：
- 姓名：{user_name}
- 行业：{resume_summary.get('industry', '')}
- 职级：{resume_summary.get('seniority_level', '')}
- 工作年限：{resume_summary.get('years_experience', 0)} 年
- 核心技能：{', '.join(resume_summary.get('key_skills', [])[:6])}
- 个人摘要：{resume_summary.get('summary', '')}

目标职位：
- 公司：{company_name}
- 职位：{job_title}
- 岗位描述：{job_description[:800]}
- 任职要求：{job_requirements[:600]}

要求：
1. 邮件要显得真诚、专业，不能让人一眼看出是 AI 写的
2. 字数控制在 300-400 字
3. 语气诚恳，重点突出求职者与岗位的契合点
4. 结尾礼貌，期待面试机会
5. 使用中文

返回 JSON（只返回 JSON，不要其他文字）：
{{
  "subject": "邮件主题（格式：应聘XX岗位-姓名-工作年限）",
  "body": "完整邮件正文（包括称呼、正文、落款）"
}}"""

        text = self._call(prompt, max_tokens=1000)
        try:
            result = json.loads(text)
            return {
                "subject": result.get("subject", f"应聘{job_title}岗位 - {user_name}"),
                "body": result.get("body", ""),
            }
        except Exception:
            return {
                "subject": f"应聘{job_title}岗位 - {user_name}",
                "body": "",
            }
