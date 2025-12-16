# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt, time
from pymongo import MongoClient, UpdateOne
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from functools import wraps
import os
import bcrypt
import requests
import re
import joblib
import pandas as pd
from model import recommend

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Config ---
MONGO_URI = os.getenv("MONGO_URI")
JWT_SECRET = os.getenv("JWT_SECRET", "supersecret")
JWT_EXPIRE = int(os.getenv("JWT_EXPIRE", 3600))

# --- DB setup ---
client = MongoClient(MONGO_URI)
db = client["careerdb"]
users = db["users"]
roadmaps_collection = db["careerRoadmaps"]
master_skills = db["master_skills"]
master_interests = db["master_interests"]
master_strengths = db["master_strengths"]
master_weaknesses = db["master_weaknesses"]

for coll in (master_skills, master_interests, master_strengths, master_weaknesses):
    try:
        coll.create_index("name", unique=True)
    except Exception:
        pass

def get_email_from_token(auth_header):
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2:
        token = parts[1]
    else:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("email")
    except Exception:
        return None

def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        email = get_email_from_token(request.headers.get("Authorization"))
        if not email:
            return jsonify({"success": False, "message": "Unauthorized"}), 401
        return f(email=email, *args, **kwargs)
    return wrapper

def pick_format_hint(learning_formats):
    """
    Simple heuristic based on user's preferred learning formats.
    Adjust strings to match whatever you actually store.
    """
    if not learning_formats:
        return "Use a mix of video, text, and projects."

    lf = [str(s).lower() for s in learning_formats]

    if any("video" in s for s in lf):
        return "Prefer video courses and recorded lectures."
    if any("project" in s or "hands-on" in s for s in lf):
        return "Prefer project-based resources and practical tasks."
    if any("text" in s or "reading" in s for s in lf):
        return "Prefer articles, documentation, and books."

    return "Use a mix of video, text, and projects."


def personalize_roadmap(roadmap_doc, profile):
    """
    Takes a roadmap template and a user profile dict,
    returns a personalized roadmap structure.
    """
    # User skills
    user_skills = [s.lower() for s in profile.get("skills", []) if isinstance(s, str)]
    user_skills_set = set(user_skills)

    # Learning preferences
    learning_formats = profile.get("learning_formats", []) or []
    learning_pace = (profile.get("learning_pace") or "moderate").lower()

    # Skills from roadmap
    core_skills = [s.lower() for s in roadmap_doc.get("core_skills", [])]
    nice_skills = [s.lower() for s in roadmap_doc.get("nice_to_have_skills", [])]

    # Gaps: skills in roadmap but not in user profile
    core_gaps = [s for s in core_skills if s not in user_skills_set]
    nice_gaps = [s for s in nice_skills if s not in user_skills_set]

    # Learning pace → duration multiplier
    pace_factor_map = {
        "fast": 0.75,
        "moderate": 1.0,
        "slow": 1.5
    }
    pace_factor = pace_factor_map.get(learning_pace, 1.0)

    personalized_phases = []
    for phase in roadmap_doc.get("phases", []):
        base_duration = phase.get("recommended_duration_months", 3)

        phase_copy = {
            "id": phase.get("id"),
            "title": phase.get("title"),
            "recommended_duration_months": base_duration,
            "personalized_duration_months": round(base_duration * pace_factor, 1),
        }

        personalized_tasks = []
        for task in phase.get("tasks", []):
            related = [s.lower() for s in task.get("related_skills", [])]
            task_copy = {
                "id": task.get("id"),
                "title": task.get("title"),
                "description": task.get("description"),
                "level": task.get("level"),
                "related_skills": task.get("related_skills", []),
            }

            # Priority + status
            if related and all(skill in user_skills_set for skill in related):
                priority = "low"
                status = "already strong"
            elif any(skill in core_gaps + nice_gaps for skill in related):
                priority = "high"
                status = "focus"
            else:
                priority = "medium"
                status = "normal"

            task_copy["priority"] = priority
            task_copy["status"] = status
            task_copy["preferred_format_hint"] = pick_format_hint(learning_formats)

            personalized_tasks.append(task_copy)

        phase_copy["tasks"] = personalized_tasks
        personalized_phases.append(phase_copy)

    return {
        "career": roadmap_doc.get("career"),
        "slug": roadmap_doc.get("slug"),
        "short_description": roadmap_doc.get("short_description"),
        "skill_gaps": {
            "core_missing": core_gaps,
            "nice_to_have_missing": nice_gaps
        },
        "phases": personalized_phases,
        "recommended_courses": roadmap_doc.get("recommended_courses", [])
    }

@app.post("/api/register")
def register():
    data = request.json or {}
    fullname = data.get("fullname")
    email = data.get("email")
    password = data.get("password")
    

    if not fullname or not email or not password:
        return jsonify({"success": False, "message": "All fields required"}), 400

    if users.find_one({"email": email}):
        return jsonify({"success": False, "message": "Email already registered"}), 400

    # use werkzeug's generate_password_hash for storage
    hashed = generate_password_hash(password)
    users.insert_one({
        "fullname": fullname,
        "email": email,
        "password": hashed,
        "auth_provider": "local",
        "created_at": time.time()
    })

    token = jwt.encode({"email": email, "exp": time.time() + JWT_EXPIRE}, JWT_SECRET, algorithm="HS256")
    return jsonify({"success": True, "token": token, "user": {"fullname": fullname, "email": email}})

@app.post("/api/login")
def login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")
    user = users.find_one({"email": email})
    if not user or not check_password_hash(user.get("password", ""), password):
        return jsonify({"success": False, "msg": "Invalid credentials"}), 401

    token = jwt.encode({"email": email, "exp": time.time() + JWT_EXPIRE}, JWT_SECRET, algorithm="HS256")
    return jsonify({"success": True, "token": token, "user": {"fullname": user.get("fullname", ""), "email": user["email"]}})


@app.post("/api/google-login")
def google_login():
    data = request.json or {}
    credential = data.get("credential")
    if not credential:
        return jsonify({"success": False, "message": "Missing credential"}), 400

    # verify with Google
    resp = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential}, timeout=5)
    if resp.status_code != 200:
        return jsonify({"success": False, "message": "Invalid Google token"}), 401

    payload = resp.json()
    email = payload.get("email")
    if not email:
        return jsonify({"success": False, "message": "Google token missing email"}), 400

    fullname = payload.get("name") or payload.get("given_name") or ""
    picture = payload.get("picture")

    # Upsert user
    user = users.find_one({"email": email})
    if not user:
        users.insert_one({
            "fullname": fullname,
            "email": email,
            "auth_provider": "google",
            "picture": picture,
            "created_at": time.time()
        })
    else:
        update = {}
        if fullname and user.get("fullname") != fullname:
            update["fullname"] = fullname
        if picture and user.get("picture") != picture:
            update["picture"] = picture
        if update:
            users.update_one({"email": email}, {"$set": update})

    token = jwt.encode({"email": email, "exp": time.time() + JWT_EXPIRE}, JWT_SECRET, algorithm="HS256")
    return jsonify({"success": True, "token": token, "user": {"name": fullname, "email": email, "picture": picture}})


@app.get("/api/get-skills")
def get_skills():
    # project only "name" and ignore broken docs
    docs = master_skills.find({}, {"_id": 0, "name": 1}).sort("name", 1).limit(500)
    names = [
        d["name"]
        for d in docs
        if isinstance(d.get("name"), str) and d["name"].strip()
    ]
    return jsonify(names)

@app.get("/api/get-interests")
def get_interests():
    docs = master_interests.find({}, {"_id": 0}).sort("name", 1).limit(500)
    return jsonify([d["name"] for d in docs])

@app.get("/api/get-strengths")
def get_strengths():
    docs = master_strengths.find({}, {"_id": 0}).sort("name", 1).limit(500)
    return jsonify([d["name"] for d in docs])

@app.get("/api/get-weaknesses")
def get_weaknesses():
    docs = master_weaknesses.find({}, {"_id": 0}).sort("name", 1).limit(500)
    return jsonify([d["name"] for d in docs])

@app.get("/api/search-skills")
def search_skills():
    q = request.args.get("q", "")
    regex = re.compile(re.escape(q), re.IGNORECASE)
    docs = master_skills.find({"name": regex}, {"_id": 0, "name": 1}).sort("name", 1).limit(50)
    return jsonify([
        d["name"]
        for d in docs
        if isinstance(d.get("name"), str) and d["name"].strip()
    ])

@app.get("/api/search-interests")
def search_interests():
    q = request.args.get("q", "")
    regex = re.compile(re.escape(q), re.IGNORECASE)
    docs = master_interests.find({"name": regex}, {"_id": 0}).sort("name", 1).limit(50)
    return jsonify([d["name"] for d in docs])

@app.get("/api/search-strengths")
def search_strengths():
    q = request.args.get("q", "")
    regex = re.compile(re.escape(q), re.IGNORECASE)
    docs = master_strengths.find({"name": regex}, {"_id": 0}).sort("name", 1).limit(50)
    return jsonify([d["name"] for d in docs])

@app.get("/api/search-weaknesses")
def search_weaknesses():
    q = request.args.get("q", "")
    regex = re.compile(re.escape(q), re.IGNORECASE)
    docs = master_weaknesses.find({"name": regex}, {"_id": 0}).sort("name", 1).limit(50)
    return jsonify([d["name"] for d in docs])

@app.post("/api/save-fullinfo")
@auth_required
def save_fullinfo(email):
    payload = request.json or {}

    # If client sends wrapped { section, data }
    section = payload.get("section")
    section_data = payload.get("data")

    try:
        if section and isinstance(section, str):
            # update only that section (safe merge)
            users.update_one(
                {"email": email},
                {"$set": {f"profile.{section}": section_data}},
                upsert=True
            )
            # Normalize keys for master updates below
            to_index = {section: section_data}
        else:
            # Deep merge incoming profile with existing profile
            existing = users.find_one({"email": email}, {"profile": 1})
            existing_profile = existing.get("profile", {}) if existing else {}

            def deep_merge(a, b):
                for k, v in b.items():
                    if (
                        k in a and isinstance(a[k], dict) and isinstance(v, dict)
                    ):
                        deep_merge(a[k], v)
                    else:
                        a[k] = v
                return a

            merged_profile = deep_merge(existing_profile, payload)
            print("[DEBUG] Saving merged profile for", email)
            import pprint; pprint.pprint(merged_profile)
            users.update_one({"email": email}, {"$set": {"profile": merged_profile}}, upsert=True)
            to_index = merged_profile
    except Exception as e:
        return jsonify({"success": False, "message": "DB update failed", "error": str(e)}), 500

    # Auto-grow master lists if present in the payload (support both section update or full profile)
    try:
        # skills
        skills = None
        if isinstance(to_index, dict):
            # sectioned payload might have keys like {"skills": [...]} or {"profile": {"skills": [...]} }
            if "skills" in to_index:
                skills = to_index.get("skills")
            elif isinstance(to_index.get("profile"), dict) and "skills" in to_index.get("profile"):
                skills = to_index.get("profile").get("skills")
        if skills:
            ops = [UpdateOne({"name": s}, {"$setOnInsert": {"name": s}}, upsert=True) for s in (skills or [])]
            if ops:
                master_skills.bulk_write(ops, ordered=False)

        # interests
        interests = None
        if isinstance(to_index, dict):
            if "interests" in to_index:
                interests = to_index.get("interests")
            elif isinstance(to_index.get("profile"), dict) and "interests" in to_index.get("profile"):
                interests = to_index.get("profile").get("interests")
        if interests:
            ops = [UpdateOne({"name": i}, {"$setOnInsert": {"name": i}}, upsert=True) for i in (interests or [])]
            if ops:
                master_interests.bulk_write(ops, ordered=False)

        # strengths
        strengths = None
        if isinstance(to_index, dict):
            if "strengths" in to_index:
                strengths = to_index.get("strengths")
            elif isinstance(to_index.get("profile"), dict) and "strengths" in to_index.get("profile"):
                strengths = to_index.get("profile").get("strengths")
        if strengths:
            ops = [UpdateOne({"name": s}, {"$setOnInsert": {"name": s}}, upsert=True) for s in (strengths or [])]
            if ops:
                master_strengths.bulk_write(ops, ordered=False)

        # weaknesses
        weaknesses = None
        if isinstance(to_index, dict):
            if "weaknesses" in to_index:
                weaknesses = to_index.get("weaknesses")
            elif isinstance(to_index.get("profile"), dict) and "weaknesses" in to_index.get("profile"):
                weaknesses = to_index.get("profile").get("weaknesses")
        if weaknesses:
            ops = [UpdateOne({"name": w}, {"$setOnInsert": {"name": w}}, upsert=True) for w in (weaknesses or [])]
            if ops:
                master_weaknesses.bulk_write(ops, ordered=False)

        # achievements removed from auto-indexing to avoid missing master collection

    except Exception as e:
        # non-fatal: indexing failure shouldn't block save
        print("master list update error:", e)

    return jsonify({"success": True})

@app.post("/api/save-section")
@auth_required
def save_section(email):
    try:
        # Get JSON data from request
        data = request.get_json(force=True, silent=True)
        
        if not data:
            print(f"DEBUG: No JSON data. request.json={request.json}, content_type={request.content_type}")
            return jsonify({"success": False, "message": "No JSON data received"}), 400
        
        section = data.get("section")
        section_data = data.get("data")
        
        print(f"DEBUG: Received section={section}, data={section_data}")

        if not section:
            return jsonify({"success": False, "message": "Missing section"}), 400
        
        if section_data is None:
            return jsonify({"success": False, "message": "Missing data"}), 400

        # update profile.section
        users.update_one(
            {"email": email},
            {"$set": {f"profile.{section}": section_data}},
            upsert=True
        )

        # update master lists only for these:
        if section == "skills":
            skills_list = section_data if isinstance(section_data, list) else section_data.get("skills", [])
            ops = [UpdateOne({"name": s}, {"$setOnInsert": {"name": s}}, upsert=True) 
                   for s in skills_list]
            if ops: master_skills.bulk_write(ops, ordered=False)

        if section == "interests":
            interests_list = section_data if isinstance(section_data, list) else section_data.get("interests", [])
            ops = [UpdateOne({"name": i}, {"$setOnInsert": {"name": i}}, upsert=True) 
                   for i in interests_list]
            if ops: master_interests.bulk_write(ops, ordered=False)

         # achievements indexing removed to avoid reliance on master_achievements collection

        if section == "strengthsWeaknesses":
            strengths = section_data.get("strengths", []) if isinstance(section_data, dict) else []
            weaknesses = section_data.get("weaknesses", []) if isinstance(section_data, dict) else []

            ops_s = [UpdateOne({"name": s}, {"$setOnInsert": {"name": s}}, upsert=True) for s in strengths]
            ops_w = [UpdateOne({"name": w}, {"$setOnInsert": {"name": w}}, upsert=True) for w in weaknesses]

            if ops_s: master_strengths.bulk_write(ops_s, ordered=False)
            if ops_w: master_weaknesses.bulk_write(ops_w, ordered=False)

        print(f"DEBUG: Successfully saved section {section}")
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error in save_section: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@app.get("/api/get-fullinfo")
@auth_required
def get_fullinfo(email):
    user = users.find_one({"email": email}, {"password": 0, "_id": 0})
    return jsonify({"success": True, "profile": user.get("profile", {})})

@app.get("/api/get_profile")
@auth_required
def get_profile(email):
    user = users.find_one({"email": email}, {"password": 0, "_id": 0})
    return jsonify({
        "success": True,
        "profile": user.get("profile", {})
    })

@app.get("/api/user-info")
@auth_required
def user_info(email):
    user = users.find_one({"email": email}, {"password": 0, "_id": 0})
    if not user:
        return jsonify({"success": False}), 404
    return jsonify({"success": True, "user": {"email": user["email"], "fullname": user.get("fullname", ""), "picture": user.get("picture")}})

@app.post("/predict-career")
def predict():
    data = request.json
    df = pd.DataFrame([data])
    # Encode categorical columns
    for col, encoder in label_encoders.items():
        df[col] = encoder.transform(df[col].astype(str))
    # Predict
    pred = model.predict(df)[0]
    career = career_encoder.inverse_transform([pred])[0]
    return jsonify({"recommended_career": career})

@app.post("/api/recommend")
def api_recommend():
    profile = request.json.get("profile")   # FULL profile dict
    results = recommend(profile)
    return {
        "success": True,
        "results": results
    }

@app.route("/api/roadmap", methods=["POST"])
def get_roadmap():
    """
    Personalized roadmap.
    Body:
    {
      "career": "AI Engineer",
      "profile": { ...user profile object... }
    }
    """
    data = request.get_json() or {}
    career = data.get("career")
    profile = data.get("profile")

    if not career:
        return jsonify({"error": "career is required"}), 400

    if not profile:
        return jsonify({"error": "profile is required"}), 400

    # 1. Find roadmap template
    roadmap_doc = roadmaps_collection.find_one({"career": career}, {"_id": 0})

    if not roadmap_doc:
        roadmap_doc = roadmaps_collection.find_one(
            {"career": {"$regex": f"^{career}$", "$options": "i"}},
            {"_id": 0}
        )

    if not roadmap_doc:
        return jsonify({"error": f"No roadmap found for career '{career}'"}), 404

    # 2. Personalize using profile
    personalized = personalize_roadmap(roadmap_doc, profile)

    return jsonify(personalized), 200


@app.route("/api/debug-roadmaps", methods=["GET"])
def debug_roadmaps():
    """
    Quick debug: check if Flask can read from careerRoadmaps collection.
    No auth, no profile, just raw data.
    """
    docs = list(roadmaps_collection.find({}, {"career": 1, "slug": 1, "_id": 0}))
    return jsonify({
        "count": len(docs),
        "careers": docs
    }), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)