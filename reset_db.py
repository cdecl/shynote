import os

# 1. .env 파일 수동 로드
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    print(f"Loading .env from {env_path}")
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                # 따옴표 제거
                key = key.strip()
                value = value.strip().strip("'").strip('"')
                os.environ[key] = value
else:
    print("No .env file found.")

print("Environment loaded.")
postgres_url = os.getenv("POSTGRES_URL")
if postgres_url:
    # 보안상 URL 전체 출력 대신 호스트 부분만 출력
    safe_url = postgres_url.split('@')[-1] if '@' in postgres_url else '***'
    print(f"Target Database: PostgreSQL ({safe_url})")
else:
    print("Warning: POSTGRES_URL not found. Falling back to default configuration.")

# 2. 모델 및 DB 엔진 로드
try:
    from api import database, models
    
    print("Connecting to database...")
    engine = database.engine
    
    # 3. 모든 테이블 삭제 (Drop All)
    print("Dropping all tables...")
    models.Base.metadata.drop_all(bind=engine)
    print("All tables dropped successfully.")
    
    # 4. 모든 테이블 생성 (Create All)
    print("Creating all tables...")
    models.Base.metadata.create_all(bind=engine)
    print("All tables created successfully.")
    
except Exception as e:
    print(f"Error during DB reset: {e}")
    import traceback
    traceback.print_exc()
