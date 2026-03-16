import json
import re
from typing import Dict, Any, List
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()


class MatchingService:
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

    def match_job(self, job: Dict[str, Any], resume_summary: Dict[str, Any], preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Score a single job against user resume and preferences. Returns score + reasons."""

        prompt = f"""请评估以下岗位与求职者的匹配程度，返回 JSON。

求职者信息：
- 行业：{resume_summary.get('industry', '')}
- 职级：{resume_summary.get('seniority_level', '')}
- 工作年限：{resume_summary.get('years_experience', 0)} 年
- 核心技能：{', '.join(resume_summary.get('key_skills', []))}
- 简历摘要：{resume_summary.get('summary', '')}
- 目标城市：{', '.join(preferences.get('target_cities', []))}
- 薪资范围：{preferences.get('salary_min', '不限')} - {preferences.get('salary_max', '不限')} 元/年
- 其他要求：{preferences.get('extra_notes', '无')}

岗位信息：
- 公司：{job.get('company_name', '')}
- 职位：{job.get('title', '')}
- 地点：{job.get('location', '')}
- 职责：{job.get('description', '')}
- 要求：{job.get('requirements', '')}
- 薪资：{job.get('salary_range', '未知')}

返回 JSON（只返回 JSON，不要其他文字）：
{{
  "match_score": 0到100的整数（综合匹配分），
  "match_reasons": ["匹配点1", "匹配点2", "匹配点3"],
  "gap_reasons": ["差距点1", "差距点2"],
  "recommendation": "强烈推荐" 或 "推荐" 或 "一般" 或 "不推荐"
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        try:
            result = json.loads(text)
            return {
                "match_score": float(result.get("match_score", 50)),
                "match_reasons": result.get("match_reasons", []),
                "gap_reasons": result.get("gap_reasons", []),
                "recommendation": result.get("recommendation", "一般"),
            }
        except Exception:
            return {
                "match_score": 50.0,
                "match_reasons": [],
                "gap_reasons": [],
                "recommendation": "一般",
            }

    def batch_match(self, jobs: List[Dict], resume_summary: Dict, preferences: Dict) -> List[Dict]:
        """Match multiple jobs, return sorted by score descending."""
        results = []
        for job in jobs:
            try:
                score_data = self.match_job(job, resume_summary, preferences)
                results.append({**job, **score_data})
            except Exception:
                results.append({**job, "match_score": 0, "match_reasons": [], "gap_reasons": [], "recommendation": "一般"})
        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results
