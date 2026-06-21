from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    APP_SECRET: str
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    JWT_SECRET: str = ""
    DEV_MODE: bool = False
    FRONTEND_URL: str = "http://localhost:5173"
    DEV_EVENT_ID: str = "415e7b26-90e3-40f1-b64b-e753c6b9d930"
    DEV_EVALUATOR_ID: str = "11111111-1111-4111-8111-111111111111"
    DEV_PARTICIPANT_ID: str = "17f32689-3b2e-40ae-b681-5104cf3148b1"

    # This is the correct Pydantic v2 syntax.
    # Do not include a "class Config:" block!
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()