import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client["careerdb"]

strengths = [
    "Leadership", "Communication", "Teamwork", "Creativity", "Discipline",
    "Critical Thinking", "Time Management", "Adaptability", "Problem Solving",
    "Decision Making", "Emotional Intelligence", "Strategic Planning",
    "Quick Learning", "Attention to Detail", "Resilience", "Collaboration",
    "Work Ethics", "Confidence", "Organizational Skills", "Active Listening",
    "Presentation Skills", "Conflict Resolution", "Innovation",
    "Goal Orientation", "Motivation", "Technical Ability", "Self-Management",
    "Patience", "Resourcefulness", "Open-Mindedness", "Multi-tasking", "Coding", "Programming"
]

weaknesses = [
    "Public Speaking", "Procrastination", "Impatience", "Overthinking",
    "Self-Doubt", "Perfectionism", "Difficulty Delegating",
    "Easily Distracted", "Taking on Too Much Work", "Fear of Failure",
    "Trouble Saying No", "Stress Management", "Time Estimation Issues",
    "Disorganization", "Emotional Overreaction", "Inconsistent Focus",
    "Avoiding Conflict", "Low Risk-Taking", "Social Anxiety",
    "Slow Decision Making", "Overcommitting", "Underestimating Tasks",
    "Detail Overload", "Work-Life Balance Issues", "Lack of Assertiveness",
    "Difficulty Prioritizing", "Introversion in Groups"
]

def seed_collection(collection_name, items):
    collection = db[collection_name]

    # Clear previous entries
    collection.delete_many({})

    # Insert new
    docs = [{"name": item} for item in items]
    collection.insert_many(docs)

    print(f"[✓] Seeded {len(items)} items into '{collection_name}'.")


if __name__ == "__main__":
    seed_collection("master_strengths", strengths)
    seed_collection("master_weaknesses", weaknesses)

    print("\nDone seeding strengths & weaknesses!")