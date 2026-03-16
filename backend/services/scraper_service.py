import httpx
import json
import re
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# Common career page path alternatives to try when the given URL fails
CAREER_PATHS = ["/careers", "/jobs", "/join", "/recruitment", "/talent",
                "/about/careers", "/en/careers", "/career", "/work-with-us",
                "/zh/careers", "/cn/careers"]

JINA_BASE = "https://r.jina.ai/"


class ScraperService:
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

    # ── Fetch helpers ──────────────────────────────────────────────────────────

    def _fetch_direct(self, url: str) -> Optional[str]:
        """Fetch page HTML; returns None on failure (no raise)."""
        try:
            with httpx.Client(
                headers=HEADERS,
                timeout=25,
                follow_redirects=True,
                verify=False,       # many Chinese sites have SSL issues
            ) as client:
                resp = client.get(url)
                if resp.status_code in (403, 404, 406, 410):
                    return None
                resp.raise_for_status()
                return resp.text
        except Exception:
            return None

    def _fetch_via_jina(self, url: str) -> Optional[str]:
        """
        Fallback: use Jina Reader (r.jina.ai) to render JS-heavy pages.
        Returns plain text/markdown. Free, no key needed.
        """
        jina_url = JINA_BASE + url
        try:
            with httpx.Client(timeout=40, follow_redirects=True) as client:
                resp = client.get(jina_url, headers={"Accept": "text/plain"})
                if resp.status_code == 200 and len(resp.text.strip()) > 100:
                    return resp.text
        except Exception:
            pass
        return None

    def _try_alternative_urls(self, base_url: str) -> Optional[tuple]:
        """
        Given a failed careers URL, try alternative paths and domain variants.
        Returns (working_url, html_text) or None.
        """
        parsed = urlparse(base_url)
        netloc = parsed.netloc  # e.g. careers.anta.com or job.lining.com
        scheme = parsed.scheme

        # Build candidate origins: original + www.maindomain
        origins = [f"{scheme}://{netloc}"]
        # Strip common career subdomains to get main domain
        parts = netloc.split(".")
        if len(parts) >= 3 and parts[0].lower() in ("careers", "job", "jobs", "hr", "recruit", "talent", "join"):
            main_domain = ".".join(parts[1:])
            origins.append(f"{scheme}://www.{main_domain}")
            origins.append(f"{scheme}://{main_domain}")

        tried = {base_url}
        for origin in origins:
            for path in CAREER_PATHS:
                candidate = origin + path
                if candidate in tried:
                    continue
                tried.add(candidate)
                html = self._fetch_direct(candidate)
                if html and len(html) > 500:
                    return candidate, html
        return None

    def _fetch_page(self, url: str) -> tuple:
        """
        Multi-strategy fetch. Returns (final_url, text_content).
        Raises RuntimeError only when all strategies fail.

        Strategy order:
          1. Direct HTTP (verify=False)
          2. Alternative paths on same domain / main domain
          3. Jina Reader on original URL (handles JS-rendered SPAs)
          4. Jina Reader on plausible main-domain career paths
        """
        # 1. Try the URL as-is
        html = self._fetch_direct(url)
        if html and len(html) > 500:
            return url, html

        # 2. Try alternative paths
        alt = self._try_alternative_urls(url)
        if alt:
            return alt

        # 3. Jina on original URL
        text = self._fetch_via_jina(url)
        if text and len(text) > 200:
            return url, text

        # 4. Jina on main-domain alternatives (for broken subdomains like careers.anta.com)
        parsed = urlparse(url)
        parts = parsed.netloc.split(".")
        if len(parts) >= 3 and parts[0].lower() in ("careers", "job", "jobs", "hr", "recruit", "talent", "join"):
            main_domain = ".".join(parts[1:])
            for path in ["/careers", "/jobs", "/join", "/talent"]:
                jina_text = self._fetch_via_jina(f"{parsed.scheme}://www.{main_domain}{path}")
                if jina_text and len(jina_text) > 300:
                    return f"https://www.{main_domain}{path}", jina_text

        raise RuntimeError(f"所有抓取策略均失败（原始URL: {url}）")

    # ── Text extraction ────────────────────────────────────────────────────────

    def _extract_text(self, content: str) -> str:
        """Strip HTML to readable text. If content looks like markdown (Jina), pass through."""
        # Jina returns markdown/plain text, not HTML
        if not content.lstrip().startswith("<"):
            lines = [l.strip() for l in content.splitlines() if l.strip()]
            return "\n".join(lines)[:14000]

        soup = BeautifulSoup(content, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "meta", "noscript", "iframe"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        return "\n".join(lines)[:14000]

    # ── AI job extraction ──────────────────────────────────────────────────────

    def extract_jobs_with_ai(self, page_text: str, company_name: str, careers_url: str) -> List[Dict[str, Any]]:
        """Use DeepSeek to extract structured job listings from page text."""
        prompt = f"""以下是「{company_name}」招聘页面的文本内容（来源：{careers_url}）。

请从中提取所有招聘岗位，返回 JSON 数组。如果页面中没有找到任何岗位信息，返回空数组 []。

每个岗位包含：
- title: 岗位名称
- location: 工作地点（城市）
- description: 岗位职责简述（100字以内，没有则留空字符串）
- requirements: 任职要求简述（100字以内，没有则留空字符串）
- salary_range: 薪资范围（没有则留空字符串）
- job_url: 该岗位的详情链接（没有则留空字符串）

只返回 JSON 数组，不要其他文字。

页面内容：
{page_text}"""

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        try:
            jobs = json.loads(text)
            return jobs if isinstance(jobs, list) else []
        except json.JSONDecodeError:
            return []

    # ── Public API ─────────────────────────────────────────────────────────────

    def scrape_company(self, company_name: str, careers_url: str, company_stage: str = "") -> List[Dict[str, Any]]:
        """Full pipeline: fetch (with fallbacks) → parse → AI-extract jobs."""
        if not careers_url:
            raise ValueError("careers_url 不能为空")

        final_url, raw_content = self._fetch_page(careers_url)
        page_text = self._extract_text(raw_content)

        if len(page_text) < 150:
            raise RuntimeError("页面内容太少，无法提取岗位信息")

        jobs = self.extract_jobs_with_ai(page_text, company_name, final_url)

        for job in jobs:
            job["company_name"] = company_name
            job["company_stage"] = company_stage

        return jobs
