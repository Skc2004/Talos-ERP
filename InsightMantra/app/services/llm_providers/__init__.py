from app.config import LLM_PROVIDER
import logging

logger = logging.getLogger(__name__)

if LLM_PROVIDER == "gemini":
    from .gemini import call_llm
elif LLM_PROVIDER == "groq":
    from .groq import call_llm
elif LLM_PROVIDER == "openai":
    from .openai_llm import call_llm
else:
    raise ValueError(f"Unsupported LLM: {LLM_PROVIDER}")

logger.info(f"Loaded LLM Provider: {LLM_PROVIDER}")
