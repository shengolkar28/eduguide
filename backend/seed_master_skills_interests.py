# seed_master_skills_interests.py

import os
import json
import pandas as pd
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv

# -----------------------------
# CONFIG
# -----------------------------
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")

DB_NAME = "careerdb"
DATA_PATH = r"C:\Users\ASUS\Documents\career project\ml_data\final_dataset.csv"

# -----------------------------
# HELPERS
# -----------------------------
def parse_list(x):
    """Parse JSON list / python list / comma string -> python list."""
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return []
    if isinstance(x, list):
        return x
    if isinstance(x, str):
        s = x.strip()
        if not s:
            return []
        # try json
        try:
            v = json.loads(s)
            if isinstance(v, list):
                return v
        except Exception:
            # fallback: comma separated
            return [i.strip() for i in s.split(",") if i.strip()]
    return []

# -----------------------------
# CONNECT MONGO
# -----------------------------
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

master_skills = db["master_skills"]
master_interests = db["master_interests"]

print("Connected to Mongo:", DB_NAME)

# -----------------------------
# LOAD DATASET
# -----------------------------
print("Loading dataset from:", DATA_PATH)
df = pd.read_csv(DATA_PATH)
print("Rows:", len(df))

# -----------------------------
# COLLECT UNIQUE SKILLS / INTERESTS
# -----------------------------
skills_set = set()
interests_set = set()

if "skills" not in df.columns or "interests" not in df.columns:
    raise RuntimeError("Dataset must contain 'skills' and 'interests' columns")

for _, row in df.iterrows():
    for s in parse_list(row["skills"]):
        if s:
            skills_set.add(str(s).strip())

    for i in parse_list(row["interests"]):
        if i:
            interests_set.add(str(i).strip())

print(f"Unique skills found: {len(skills_set)}")
print(f"Unique interests found: {len(interests_set)}")

# -----------------------------
# SEED master_skills
# -----------------------------
skill_ops = [
    UpdateOne({"name": name}, {"$setOnInsert": {"name": name}}, upsert=True)
    for name in sorted(skills_set)
]

if skill_ops:
    result = master_skills.bulk_write(skill_ops, ordered=False)
    print("master_skills upserted:", result.upserted_count)
else:
    print("No skills to insert.")

# -----------------------------
# SEED master_interests
# -----------------------------
interest_ops = [
    UpdateOne({"name": name}, {"$setOnInsert": {"name": name}}, upsert=True)
    for name in sorted(interests_set)
]

if interest_ops:
    result = master_interests.bulk_write(interest_ops, ordered=False)
    print("master_interests upserted:", result.upserted_count)
else:
    print("No interests to insert.")

# Add manual skills that should always be available
manual_skills = ["Web Development"]
for skill in manual_skills:
    master_skills.update_one(
        {"name": skill},
        {"$setOnInsert": {"name": skill}},
        upsert=True
    )
    print(f"Ensured skill '{skill}' exists")

print("Seeding complete.")
